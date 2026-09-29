const Sheet=require('../models/scoreSheet.model'),Assessment=require('../models/assessment.model'),Attendance=require('../models/assessmentAttendance.model'),Course=require('../models/timetableCourse.model'),Result=require('../models/result.model'),Audit=require('../models/auditLog.model');
const AppError=require('../utils/appError'),grade=require('../utils/resultCalculator');
const {transaction,finished}=require('./assessment.service');
async function access(courseId,actor,session){const course=await Course.findById(courseId).session(session||null);if(!course)throw new AppError('Course not found',404);if(!(actor.role==='admin'&&actor.adminType==='timetable_admin')&&!(actor.role==='lecturer'&&String(course.lecturerId)===actor.userId))throw new AppError('This course is not assigned to you',403);return course}
async function attendanceRows(courseId,session){
 const assessments=await Assessment.find({course:courseId,state:{$ne:'cancelled'}}).session(session),test=assessments.find(a=>a.kind==='test'),exam=assessments.find(a=>a.kind==='exam');
 if(!finished(test)||!finished(exam))throw new AppError('Both test and exam attendance must be closed before preparing or submitting the score sheet',409);
 for(const a of assessments)await Assessment.updateOne({_id:a.id},{$inc:{revision:1}},{session});
 const records=await Attendance.find({assessment:{$in:assessments.map(a=>a.id)}}).session(session);
 if(records.some(r=>r.status==='pending_exception'))throw new AppError('Resolve pending attendance exceptions before preparing or submitting this sheet',409);
 const students=new Map([...test.roster,...exam.roster].map(r=>[String(r.student),r.toObject()]));
 return [...students.values()].map(r=>{const status=a=>{const present=records.find(e=>String(e.assessment)===a.id&&String(e.student)===String(r.student)&&e.status==='present');return present?present.method:'absent'};return {...r,testStatus:status(test),examStatus:status(exam),test:null,exam:null,total:null,grade:null}}).sort((a,b)=>a.name.localeCompare(b.name));
}
function score(value,max){if(value==null||value==='')return null;if(typeof value==='boolean'||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>max)throw new AppError(`Score must be between 0 and ${max}`,400);return Number(value)}
function totals(row){row.total=row.test==null||row.exam==null?null:row.test+row.exam;row.grade=row.total==null?null:grade(row.total);return row}
async function prepare(courseId,actor){return transaction(async session=>{
 const course=await access(courseId,actor,session);if(!course.lecturerId||!(course.creditUnit>0))throw new AppError('Assign a lecturer and set credit units first',400);
 let sheet=await Sheet.findOne({course:courseId}).session(session);if(sheet)return sheet;
 const rows=await attendanceRows(courseId,session);
 [sheet]=await Sheet.create([{course:courseId,lecturer:course.lecturerId,courseCode:course.courseCode,courseName:course.courseName,session:course.session,semester:course.semester,creditUnit:course.creditUnit,rows}],{session});return sheet;
})}
async function save(courseId,input,actor,submit=false){return transaction(async session=>{
 await access(courseId,actor,session);if(actor.role!=='lecturer')throw new AppError('Only the assigned lecturer enters draft scores',403);
 const sheet=await Sheet.findOne({course:courseId}).session(session);if(!sheet||sheet.state!=='draft')throw new AppError('Only draft score sheets can be edited by the lecturer',409);
 if(input.version!==sheet.__v)throw new AppError('This sheet changed in another tab. Reload before editing.',409);
 if(!Array.isArray(input.rows)||input.rows.length!==sheet.rows.length||new Set(input.rows.map(r=>String(r.student))).size!==sheet.rows.length)throw new AppError('Provide exactly one entry for every roster student',400);
 const attendance=await attendanceRows(courseId,session);
 if(attendance.length!==sheet.rows.length)throw new AppError('Attendance roster changed; contact the academic officer',409);
 for(const row of sheet.rows){const item=input.rows.find(r=>String(r.student)===String(row.student)),record=attendance.find(r=>String(r.student)===String(row.student));if(!item||!record)throw new AppError('Invalid student on score sheet',400);
 row.testStatus=record.testStatus;row.examStatus=record.examStatus;row.test=score(item.test,40);row.exam=score(item.exam,60);
 for(const field of ['test','exam']){if(row[`${field}Status`]==='absent'&&row[field]!=null)throw new AppError(`Cannot enter ${field} marks for an absent student; request an academic correction`,400);if(submit&&row[`${field}Status`]!=='absent'&&row[field]==null)throw new AppError(`Enter every attended ${field} score before submission`,400)}totals(row)}
 if(submit){sheet.state='submitted';sheet.submittedAt=new Date()}await sheet.save({session});
 if(submit)await Audit.create([{performedBy:actor.userId,action:'UPDATE',targetType:'SCORE_SHEET',targetId:sheet.id,description:`Lecturer submitted ${sheet.courseCode}; sheet locked pending academic review`}],{session});
 return sheet;
})}
function resultFields(sheet,row){return {courseName:sheet.courseName,creditUnit:sheet.creditUnit,test:row.test,exam:row.exam,total:row.total,grade:row.grade,sourceSheet:sheet._id,outcome:row.grade?'graded':'absent'}}
async function release(courseId,actor){return transaction(async session=>{
 await access(courseId,actor,session);const sheet=await Sheet.findOne({course:courseId}).session(session);if(!sheet||sheet.state!=='submitted')throw new AppError('Only a submitted sheet can be released',409);
 for(const row of sheet.rows)await Result.findOneAndUpdate({student:row.student,courseCode:sheet.courseCode,session:sheet.session,semester:sheet.semester},{$set:resultFields(sheet,row)},{upsert:true,runValidators:true,session});
 sheet.state='released';sheet.releasedAt=new Date();sheet.releasedBy=actor.userId;await sheet.save({session});await Audit.create([{performedBy:actor.userId,adminType:actor.adminType,action:'UPDATE',targetType:'SCORE_SHEET',targetId:sheet.id,description:`Academic officer released ${sheet.courseCode} grades`}],{session});return sheet;
})}
async function correct(courseId,input,actor){return transaction(async session=>{
 await access(courseId,actor,session);const sheet=await Sheet.findOne({course:courseId}).session(session);if(!sheet||sheet.state==='draft')throw new AppError('Academic corrections apply after lecturer submission',409);
 const reason=String(input.reason||'').trim();if(reason.length<10||reason.length>1000)throw new AppError('Enter a correction reason (10–1000 characters)',400);
 const row=sheet.rows.find(r=>String(r.student)===String(input.studentId));if(!row)throw new AppError('Student is not on this sheet',404);
 const before={test:row.test,exam:row.exam};row.test=score(input.test,40);row.exam=score(input.exam,60);totals(row);
 sheet.corrections.push({student:row.student,reason,actor:actor.userId,at:new Date(),before,after:{test:row.test,exam:row.exam}});await sheet.save({session});
 if(sheet.state==='released')await Result.findOneAndUpdate({student:row.student,courseCode:sheet.courseCode,session:sheet.session,semester:sheet.semester},{$set:resultFields(sheet,row)},{upsert:true,runValidators:true,session});
 await Audit.create([{performedBy:actor.userId,adminType:actor.adminType,action:'UPDATE',targetType:'SCORE_SHEET',targetId:sheet.id,affectedStudent:row.student,description:`Academic score correction: ${reason}`,changes:{before,after:{test:row.test,exam:row.exam}}}],{session});return sheet;
})}
module.exports={access,prepare,save,release,correct};
