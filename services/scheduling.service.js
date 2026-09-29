const mongoose = require('mongoose');
const Timetable = require('../models/timetable.model');
const Course = require('../models/timetableCourse.model');
const Department = require('../models/department.model');
const { DAYS, TIME_SLOTS } = require('../constants/timetable.constants');
const AppError = require('../utils/appError');
const logAction = require('../utils/logAction');
const normal = value => String(value || '').trim().toUpperCase();
const Lock = mongoose.models.ScheduleLock || mongoose.model('ScheduleLock', new mongoose.Schema({ _id: String, revision: { type: Number, default: 0 } }));
function conflict(a,b) {
  if (a.session !== b.session || a.semester !== b.semester || a.day !== b.day || a.time !== b.time) return false;
  if (normal(a.courseCode) === normal(b.courseCode)) return false; // one shared lecture
  return (normal(a.department) === normal(b.department) && Number(a.level) === Number(b.level)) ||
    (normal(a.lecturer) && normal(a.lecturer) === normal(b.lecturer)) ||
    (normal(a.venue) && normal(a.venue) === normal(b.venue));
}
function identity(row) { return `${normal(row.courseCode)}|${normal(row.department)}|${row.level}|${row.session}|${row.semester}`; }
async function audience(course) {
  const pairs = new Map();
  for (const target of course.targets) {
    const query = target.type === 'department' ? { name: new RegExp(`^${String(target.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`,'i') } : {};
    const departments = await Department.find(query).populate('faculty');
    for (const department of departments) {
      if (target.type === 'faculty' && normal(department.faculty?.name) !== normal(target.name)) continue;
      if (Number(target.level) < department.minLevel || Number(target.level) > department.maxLevel) throw new AppError(`Invalid course target level: ${target.name}`,400);
      pairs.set(`${normal(department.name)}|${target.level}`, { department:normal(department.name),level:Number(target.level) });
    }
  }
  if (!pairs.size) throw new AppError(`Course ${course.courseCode} has no valid target departments`,400);
  return [...pairs.values()];
}
async function plan({session,semester}) {
  if(!session || !['First','Second','Summer'].includes(semester)) throw new AppError('Choose a session and semester',400);
  const courses=await Course.find({session,semester}).sort({courseCode:1});
  if(!courses.length) throw new AppError('No courses for this semester',404);
  const existing=await Timetable.find({session,semester}).lean();
  const scheduled=[...existing], entries=[], unscheduled=[];
  const expanded=[];
  for(const course of courses) expanded.push({course,targets:await audience(course)});
  // Large shared classes first; deterministic ordering makes retries predictable.
  expanded.sort((a,b)=>b.targets.length-a.targets.length || a.course.courseCode.localeCompare(b.course.courseCode));
  for(const {course,targets} of expanded) {
    const base={session,semester,courseCode:normal(course.courseCode),courseName:course.courseName,creditUnit:course.creditUnit,lecturer:normal(course.lecturer),lecturerPhone:course.lecturerPhone,venue:null};
    const current=existing.filter(e=>normal(e.courseCode)===base.courseCode);
    if(new Set(current.map(e=>`${e.day}|${e.time}`)).size>1) throw new AppError(`${base.courseCode} has inconsistent published slots; correct it before generating`,409);
    const slots=current.length ? [{day:current[0].day,time:current[0].time}] : DAYS.flatMap(day=>TIME_SLOTS.map(time=>({day,time})));
    let placed=false;
    for(const slot of slots) {
      const candidate=targets.map(t=>({...base,...t,...slot}));
      if(candidate.some(row=>scheduled.some(old=>conflict(row,old)))) continue;
      const added=candidate.filter(row=>!scheduled.some(old=>identity(old)===identity(row)));
      entries.push(...added);scheduled.push(...added);placed=true;break;
    }
    if(!placed) unscheduled.push({courseCode:base.courseCode,reason:'No conflict-free slot available'});
  }
  return {data:entries,existing,unscheduled,summary:{totalCourses:courses.length,newEntries:entries.length,existingEntries:existing.length,unscheduled:unscheduled.length}};
}
async function persist({entries,performedBy,ipAddress,entryId}) {
  if(!Array.isArray(entries) || !entries.length || entries.length>5000) throw new AppError('Provide 1 to 5000 timetable entries',400);
  const {session,semester}=entries[0];
  const lockId=`${session}|${semester}`;
  try { await Lock.updateOne({_id:lockId},{$setOnInsert:{revision:0}},{upsert:true}); } catch(e) { if(e.code!==11000) throw e; }
  const transaction=await mongoose.startSession();let saved=[];
  try {
    await transaction.withTransaction(async()=>{
      saved=[];await Lock.updateOne({_id:lockId},{$inc:{revision:1}},{session:transaction});
      let existing=await Timetable.find({session,semester}).session(transaction).lean();
      let editing;
      if(entryId) {
        editing=existing.find(e=>String(e._id)===String(entryId));
        if(!editing) throw new AppError('Timetable entry not found',404);
        existing=existing.filter(e=>normal(e.courseCode)!==normal(editing.courseCode));
      }
      const batch=[];
      for(const raw of entries) {
        if(raw.session!==session || raw.semester!==semester || !DAYS.includes(raw.day) || !TIME_SLOTS.includes(raw.time)) throw new AppError('Entries must have one valid semester and valid days/times',400);
        const course=await Course.findOne({courseCode:normal(raw.courseCode),session,semester}).session(transaction);
        if(!course) throw new AppError(`Course ${raw.courseCode} does not exist in this semester`,400);
        const targets=await audience(course);
        if(!targets.some(t=>t.department===normal(raw.department) && t.level===Number(raw.level))) throw new AppError('Entry does not match course targets',400);
        const row={day:raw.day,time:raw.time,session,semester,courseCode:normal(course.courseCode),courseName:course.courseName,creditUnit:course.creditUnit,lecturer:normal(raw.lecturer || course.lecturer),lecturerPhone:course.lecturerPhone,venue:normal(raw.venue)||null,department:normal(raw.department),level:Number(raw.level)};
        const all=[...existing,...batch];
        const same=all.find(e=>identity(e)===identity(row));
        if(same) { if(same.day===row.day && same.time===row.time && normal(same.lecturer)===normal(row.lecturer) && normal(same.venue)===normal(row.venue)) continue; throw new AppError(`${row.courseCode} is already published. Use Edit to move it.`,409); }
        if(all.some(e=>normal(e.courseCode)===row.courseCode && (e.day!==row.day || e.time!==row.time))) throw new AppError('Shared course entries must have the same slot',409);
        const clash=all.find(e=>conflict(row,e));
        if(clash) throw new AppError(`Clash: ${row.courseCode} and ${clash.courseCode} on ${row.day} ${row.time}`,409);
        batch.push(row);
      }
      if(editing) await Timetable.deleteMany({session,semester,courseCode:editing.courseCode}).session(transaction);
      if(batch.length) saved=await Timetable.insertMany(batch,{session:transaction});
    });
  } finally { await transaction.endSession(); }
  await logAction({performedBy,ipAddress,action:entryId?'UPDATE':'CREATE',targetType:'TIMETABLE',description:`Timetable saved: ${session} ${semester}, ${saved.length} entries`});
  return {data:{saved,errors:[],summary:{total:entries.length,success:saved.length,failed:0}}};
}
async function update(input) {
  const old=await Timetable.findById(input.entryId);
  if(!old) throw new AppError('Entry not found',404);
  const shared=await Timetable.find({session:old.session,semester:old.semester,courseCode:old.courseCode}).lean();
  const entries=shared.map(row=>({...row,day:input.day||row.day,time:input.time||row.time,lecturer:input.lecturer||row.lecturer,venue:input.venue??row.venue}));
  const result=await persist({...input,entries});
  return {data:result.data.saved.find(r=>normal(r.department)===normal(old.department) && r.level===old.level)};
}
module.exports={plan,persist,update,conflict,audience};
