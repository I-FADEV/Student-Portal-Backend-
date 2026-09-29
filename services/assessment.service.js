const mongoose=require('mongoose');
const Assessment=require('../models/assessment.model'),Attendance=require('../models/assessmentAttendance.model'),Course=require('../models/timetableCourse.model'),Student=require('../models/student.model'),Enrollment=require('../models/enrollment.model'),Audit=require('../models/auditLog.model');
const AppError=require('../utils/appError');
const Lock=mongoose.models.AssessmentLock||mongoose.model('AssessmentLock',new mongoose.Schema({_id:String,revision:{type:Number,default:0}}));
const normal=value=>String(value||'').trim().toUpperCase();
const isOpen=(a,now=new Date())=>a.state==='published'&&a.startAt<=now&&a.endAt>now;
const finished=a=>a&&a.state!=='cancelled'&&(a.state==='closed'||a.endAt<=new Date());
async function transaction(fn){const session=await mongoose.startSession();try{let result;await session.withTransaction(async()=>{result=await fn(session)});return result}finally{await session.endSession()}}
async function lock(session){try{await Lock.updateOne({_id:'schedule'},{$setOnInsert:{revision:0}},{upsert:true})}catch(e){if(e.code!==11000)throw e}await Lock.updateOne({_id:'schedule'},{$inc:{revision:1}},{session})}
async function roster(course){
 const queries=await require('../utils/studentCourseResolver').buildStudentQueriesForTargets(course.targets);if(!queries.length)return [];
 const all=await Enrollment.find({session:course.session,semester:course.semester}).select('student');
 const enrolled=await Enrollment.find({session:course.session,semester:course.semester,$or:queries});
 const students=await Student.find({status:{$nin:['archived','graduated']},$or:[{_id:{$in:enrolled.map(e=>e.student)}},{_id:{$nin:all.map(e=>e.student)},$or:queries}]}).select('name matricNumber department level').sort({name:1});
 return students.map(s=>{const e=enrolled.find(e=>String(e.student)===s.id);return {student:s._id,name:s.name,matricNumber:s.matricNumber,department:e?.department||s.department,level:e?.level||s.level}});
}
function conflict(a,b){
 if(a.startAt>=b.endAt||b.startAt>=a.endAt)return false;
 const ids=new Set(a.roster.map(r=>String(r.student)));
 return normal(a.venue)===normal(b.venue)||a.lecturer&&b.lecturer&&String(a.lecturer)===String(b.lecturer)||b.roster.some(r=>ids.has(String(r.student)));
}
function slot(input){
 const startAt=new Date(input.startAt),endAt=new Date(input.endAt),venue=normal(input.venue),capacity=Number(input.capacity);
 if(!Number.isFinite(+startAt)||!Number.isFinite(+endAt)||endAt<=startAt||endAt-startAt>12*3600000||!venue||venue.length>100||!Number.isInteger(capacity)||capacity<1||capacity>10000)throw new AppError('Each slot needs valid start/end times (up to 12 hours), venue and capacity',400);
 return {startAt,endAt,venue,capacity};
}
async function courseDetails(id,kind){
 if(!['test','exam'].includes(kind))throw new AppError('Choose test or exam',400);
 const course=await Course.findById(id);if(!course)throw new AppError('Course not found',404);
 const lecturer=course.lecturerId&&await require('../models/staff.model').findOne({_id:course.lecturerId,role:'lecturer',status:'active'});
 if(!lecturer)throw new AppError(`Assign an active lecturer to ${course.courseCode} first`,400);
 const students=await roster(course);if(!students.length)throw new AppError(`No eligible students for ${course.courseCode}`,400);
 return {course:course._id,courseCode:course.courseCode,courseName:course.courseName,session:course.session,semester:course.semester,lecturer:lecturer._id,kind,roster:students};
}
async function preview(input){
 if(!input.session||!['First','Second','Summer'].includes(input.semester)||!['test','exam'].includes(input.kind)||!Array.isArray(input.slots)||!input.slots.length||input.slots.length>500)throw new AppError('Choose session, semester, assessment type and 1–500 available slots',400);
 const slots=input.slots.map(slot).sort((a,b)=>a.startAt-b.startAt);if(slots.some(s=>s.endAt<=new Date()))throw new AppError('Slots must finish in the future',400);
 const filter={session:input.session,semester:input.semester};
 if(input.courseIds!==undefined){if(!Array.isArray(input.courseIds)||!input.courseIds.length||input.courseIds.length>1000||input.courseIds.some(id=>!mongoose.isValidObjectId(id)))throw new AppError('Invalid course selection',400);filter._id={$in:input.courseIds}}
 const courses=await Course.find(filter).sort({courseCode:1});if(!courses.length)throw new AppError('No courses match this session',404);
 const existing=await Assessment.find({state:{$ne:'cancelled'}}).lean(),expanded=[],unscheduled=[];
 for(const course of courses){if(existing.some(a=>String(a.course)===course.id&&a.kind===input.kind))continue;try{expanded.push(await courseDetails(course.id,input.kind))}catch(e){if(e.status)unscheduled.push({courseCode:course.courseCode,reason:e.message});else throw e}}
 expanded.sort((a,b)=>b.roster.length-a.roster.length);const planned=[];
 for(const course of expanded){const selected=slots.find(s=>s.capacity>=course.roster.length&&![...existing,...planned].some(old=>conflict({...course,...s},old)));if(selected)planned.push({...course,...selected});else unscheduled.push({courseCode:course.courseCode,reason:'No slot with sufficient capacity and no student, lecturer or venue clash'})}
 return {data:planned.map(({roster,...a})=>({...a,studentCount:roster.length})),unscheduled};
}
async function publish(entries,actor){
 if(!Array.isArray(entries)||!entries.length||entries.length>1000)throw new AppError('Provide 1–1000 assessment entries',400);
 return transaction(async session=>{await lock(session);const existing=await Assessment.find({state:{$ne:'cancelled'}}).session(session).lean();const planned=[];
 for(const input of entries){const candidate={...await courseDetails(input.course,input.kind),...slot(input),createdBy:actor.userId};if(candidate.endAt<=new Date())throw new AppError('Cannot publish an assessment which has already ended',400);
 if([...existing,...planned].some(a=>String(a.course)===String(candidate.course)&&a.kind===candidate.kind))throw new AppError('A test/exam already exists for this course',409);
 if(candidate.roster.length>candidate.capacity)throw new AppError(`${candidate.courseCode} exceeds venue capacity`,409);
 if([...existing,...planned].some(a=>conflict(candidate,a)))throw new AppError(`${candidate.courseCode} clashes with a student, lecturer or venue booking`,409);planned.push(candidate)}
 const docs=await Assessment.insertMany(planned,{session});await Audit.create([{performedBy:actor.userId,adminType:actor.adminType,action:'CREATE',targetType:'ASSESSMENT',description:`Published ${docs.length} dated assessments`}],{session});return docs.map(doc=>{const out=doc.toObject();delete out.roster;return {...out,studentCount:doc.roster.length}});
 });
}
async function transition(id,action,actor){
 if(!['open','close','cancel'].includes(action))throw new AppError('Invalid assessment action',400);
 return transaction(async session=>{await lock(session);const doc=await Assessment.findById(id).session(session);if(!doc||doc.state!=='published')throw new AppError('Published assessment not found',409);
 if(action==='open'){if(doc.endAt<=new Date())throw new AppError('Assessment has ended',409);doc.startAt=new Date();doc.openedAt=new Date();const others=await Assessment.find({_id:{$ne:doc.id},state:{$ne:'cancelled'}}).session(session);if(others.some(a=>conflict(doc,a)))throw new AppError('Opening now would cause an attendance/venue clash',409)}
 else{if(action==='cancel'&&await Attendance.exists({assessment:id}).session(session))throw new AppError('Attendance already exists; close this assessment instead',409);if(action==='close'){if(doc.startAt>new Date())throw new AppError('This assessment has not started; use cancel instead',409);doc.endAt=new Date(Math.min(+doc.endAt,Date.now()))}doc.state=action==='close'?'closed':'cancelled';doc.closedAt=new Date()}
 doc.revision++;await doc.save({session});await Audit.create([{performedBy:actor.userId,adminType:actor.adminType,action:'UPDATE',targetType:'ASSESSMENT',targetId:doc.id,description:`Assessment ${action}`}],{session});return doc;
 });
}
async function touchOpen(id,session){const doc=await Assessment.findOneAndUpdate({_id:id,state:'published',startAt:{$lte:new Date()},endAt:{$gt:new Date()}},{$inc:{revision:1}},{session,new:true});if(!doc)throw new AppError('Check-in is not open for this assessment',409);return doc}
async function exception(id,input,actor){
 const station=String(input.station||'').trim(),reason=String(input.reason||'').trim();if(station.length<2||station.length>80||reason.length<10||reason.length>1000)throw new AppError('Enter a station label and a reason of 10–1000 characters',400);
 return transaction(async session=>{const doc=await touchOpen(id,session);if(!doc.roster.some(r=>String(r.student)===String(input.studentId)))throw new AppError('Student is not enrolled for this assessment',403);
 if(!await Student.exists({_id:input.studentId,status:{$nin:['archived','graduated']}}).session(session))throw new AppError('Student is no longer active',409);
 let entry=await Attendance.findOne({assessment:id,student:input.studentId}).session(session);if(entry)return entry;
 [entry]=await Attendance.create([{assessment:id,student:input.studentId,operator:actor.userId,station,reason,status:'pending_exception',method:'exception'}],{session});return entry;
 });
}
async function approveException(id,reason,actor,accepted=true){
 if(typeof reason!=='string'||reason.trim().length<10||reason.length>1000)throw new AppError('Enter the academic officer approval reason (10–1000 characters)',400);
 return transaction(async session=>{const entry=await Attendance.findById(id).session(session);if(!entry||entry.status!=='pending_exception')throw new AppError('Pending exception not found',409);
 const assessment=await Assessment.findById(entry.assessment).session(session);if(!assessment||assessment.state==='cancelled')throw new AppError('Assessment unavailable',409);
 const sheet=await require('../models/scoreSheet.model').findOne({course:assessment.course}).session(session);if(sheet&&sheet.state!=='draft')throw new AppError('Score sheet already submitted; use an audited academic score correction',409);
 await Assessment.updateOne({_id:assessment.id},{$inc:{revision:1}},{session});
 entry.status=accepted?'present':'rejected_exception';entry.approvedBy=actor.userId;entry.approvedAt=new Date();if(accepted)entry.checkedInAt=entry.createdAt;await entry.save({session});
 await Audit.create([{performedBy:actor.userId,adminType:actor.adminType,action:'UPDATE',targetType:'ATTENDANCE',targetId:entry.id,affectedStudent:entry.student,description:`Academic officer ${accepted?'approved':'rejected'} non-biometric attendance exception`,changes:{after:{reason:reason.trim(),station:entry.station}}}],{session});return entry;
 });
}
module.exports={roster,preview,publish,transition,isOpen,finished,exception,approveException,transaction};
