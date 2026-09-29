const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs/promises');
const mongoose=require('mongoose');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
const request=require('supertest');
const sharp=require('sharp');
const {PDFDocument}=require('pdf-lib');
const ExcelJS=require('exceljs');
process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-test-key-never-use-in-production-123456789';
process.env.FRONTEND_URL='http://localhost:5173';
process.env.MONGOMS_DOWNLOAD_DIR=path.join(__dirname,'../.cache/mongodb');
const Admin=require('../models/admin.model');const Student=require('../models/student.model');
const Faculty=require('../models/faculty.model');const Department=require('../models/department.model');
const Session=require('../models/session.model');const Course=require('../models/timetableCourse.model');
const Result=require('../models/result.model');const Finance=require('../models/finance.model');const IdCard=require('../models/idcard.model');
const token=require('../utils/generateToken');
const app=require('../app');
const pushKeys=require('web-push').generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY=pushKeys.publicKey;process.env.VAPID_PRIVATE_KEY=pushKeys.privateKey;process.env.VAPID_SUBJECT='mailto:ict@example.org';
let db,dir,actors,student,student2,dept,dept2,faculty,course;
const bearer=user=>`Bearer ${token(user.id,user.role,user.adminType,user.tokenVersion)}`;
const api=(method,url,user,body)=>{const r=request(app)[method](url).set('Authorization',bearer(user));return body?r.send(body):r};
before(async()=>{dir=await fs.mkdtemp(path.join(os.tmpdir(),'ifatoss-tests-'));process.env.UPLOAD_DIR=dir;db=await MongoMemoryReplSet.create({instanceOpts:[{launchTimeout:60000}],replSet:{count:1,storageEngine:'wiredTiger'}});await mongoose.connect(db.getUri());for(const model of Object.values(mongoose.models))await model.init();});
after(async()=>{await mongoose.disconnect();await db?.stop();if(dir)await fs.rm(dir,{recursive:true,force:true});});
beforeEach(async()=>{
 for(const model of Object.values(mongoose.models))await model.deleteMany({});
 actors={};for(const type of ['general_admin','finance_admin','registry_admin','idcard_admin','timetable_admin'])actors[type]=await Admin.create({username:type,password:'FixturePassword123!',adminType:type});
 faculty=await Faculty.create({name:'Science'});
 dept=await Department.create({name:'Computer Science',faculty:faculty.id,minLevel:100,maxLevel:400,abbreviation:'CSC'});
 dept2=await Department.create({name:'Biochemistry',faculty:faculty.id,minLevel:100,maxLevel:400,abbreviation:'BCH'});
 student=await Student.create({name:'Student Alpha',matricNumber:'I-FAT/29/CSC/0001',password:'FixturePassword123!',department:'COMPUTER SCIENCE',faculty:'SCIENCE',level:100});
 student2=await Student.create({name:'Student Beta',matricNumber:'I-FAT/29/BCH/0002',password:'FixturePassword123!',department:'BIOCHEMISTRY',faculty:'SCIENCE',level:100});
 await Session.create({session:'2026/2027',phase:'first',status:'active',createdBy:actors.general_admin.id});
 course=await Course.create({courseCode:'CSC101',courseName:'Computing',creditUnit:3,lecturer:'Dr Alpha',targets:[{type:'department',name:dept.name,level:100}],session:'2026/2027',semester:'First'});
});

const Announcement=require('../models/announcement.model');
const Receipt=require('../models/announcementReceipt.model');
const Subscription=require('../models/pushSubscription.model');
const Delivery=require('../models/pushDelivery.model');
const push=require('../services/push.service');
const Staff=require('../models/staff.model');
async function workflowStaff(){const lecturer=await Staff.create({name:'Dr Lecturer',phone:'+2348000000001',username:'+2348000000001',role:'lecturer',password:'LecturerFixture123!',mustChangePassword:false,createdBy:actors.timetable_admin.id});const invigilator=await Staff.create({name:'External exam desk',username:'exam-desk',role:'invigilator',password:'InvigilatorFixture123!',mustChangePassword:false,createdBy:actors.timetable_admin.id});await Course.updateOne({_id:course.id},{$set:{lecturerId:lecturer.id,lecturer:lecturer.name,lecturerPhone:lecturer.phone}});return {lecturer,invigilator}}
test('staff credentials enforce first password change and revoke concurrent invigilator sessions',async()=>{
 const r=await api('post','/staff',actors.timetable_admin,{name:'Dr Teacher',role:'lecturer',phone:'+2348111222333',password:'InitialPassword123!'});assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(r.body.data.password,undefined);
 const login=await request(app).post('/staff/login').send({username:'+2348111222333',password:'InitialPassword123!'});assert.equal(login.status,200);const old=login.body.token;
 assert.equal((await request(app).get('/assessments/courses').set('Authorization',`Bearer ${old}`)).status,403);
 assert.equal((await request(app).put('/staff/password').set('Authorization',`Bearer ${old}`).send({currentPassword:'InitialPassword123!',newPassword:'ChangedPassword123!',confirmPassword:'ChangedPassword123!'})).status,200);
 assert.equal((await request(app).get('/staff/me').set('Authorization',`Bearer ${old}`)).status,401);
 const fresh=await request(app).post('/staff/login').send({username:'+2348111222333',password:'ChangedPassword123!'});assert.equal(fresh.body.user.mustChangePassword,false);
 const inv=await api('post','/staff',actors.timetable_admin,{name:'External Desk',role:'invigilator',username:'shared-exam',password:'InvigilatorPassword123!'});assert.equal(inv.status,201);
 const one=await request(app).post('/staff/login').send({username:'shared-exam',password:'InvigilatorPassword123!'}),two=await request(app).post('/staff/login').send({username:'shared-exam',password:'InvigilatorPassword123!'});
 for(const t of [one.body.token,two.body.token])assert.equal((await request(app).get('/assessments').set('Authorization',`Bearer ${t}`)).status,200);
 assert.notEqual(one.body.token,two.body.token);
 assert.equal((await request(app).post('/staff/logout').set('Authorization',`Bearer ${one.body.token}`)).status,200);
 assert.equal((await request(app).get('/assessments').set('Authorization',`Bearer ${one.body.token}`)).status,401);
 assert.equal((await request(app).get('/assessments').set('Authorization',`Bearer ${two.body.token}`)).status,200);
 assert.equal((await api('put',`/staff/${inv.body.data._id}`,actors.timetable_admin,{name:'External Desk',username:'new-exam',password:'NewInvigilator123!'})).status,200);
 for(const t of [one.body.token,two.body.token])assert.equal((await request(app).get('/assessments').set('Authorization',`Bearer ${t}`)).status,401);
 assert.equal((await api('post','/staff',actors.idcard_admin,{name:'No permission'})).status,403);
});
test('staff announcements are available to every admin, target lecturers, and remain separate from students',async()=>{
 const {lecturer,invigilator}=await workflowStaff();
 const draft=await api('post','/announcements',actors.finance_admin,{channel:'staff',title:'Staff update',body:'Meeting tomorrow',audience:{kind:'lecturers',levels:[]}});assert.equal(draft.status,201,JSON.stringify(draft.body));
 assert.equal((await api('post',`/announcements/${draft.body.data._id}/publish`,actors.timetable_admin)).status,403);
 assert.equal((await api('post',`/announcements/${draft.body.data._id}/publish`,actors.finance_admin)).status,200);
 assert.equal((await api('get','/announcements/inbox',lecturer)).body.data.length,1);assert.equal((await api('get','/announcements/inbox',student)).body.data.length,0);assert.equal((await api('get','/announcements/inbox',invigilator)).status,403);
 assert.equal((await api('post','/announcements',lecturer,{channel:'staff',title:'No',body:'No'})).status,403);
});
test('assessment scheduling prevents student, lecturer and venue overlaps and enforces exam opening windows',async()=>{
 const {invigilator}=await workflowStaff();const starts=new Date(Date.now()+3600000),ends=new Date(+starts+3600000);
 const preview=await api('post','/assessments/preview',actors.timetable_admin,{session:'2026/2027',semester:'First',kind:'exam',slots:[{startAt:starts,endAt:ends,venue:'Hall A',capacity:50}]});assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.data.length,1);assert.equal(preview.body.unscheduled.length,0);
 const published=await api('post','/assessments/publish',actors.timetable_admin,{entries:preview.body.data});assert.equal(published.status,201,JSON.stringify(published.body));const id=published.body.data[0]._id;
 assert.equal((await api('get',`/assessments/${id}`,invigilator)).status,409);
 assert.equal((await api('post','/assessments/publish',actors.timetable_admin,{entries:preview.body.data})).status,409);
 assert.equal((await api('post','/assessments/publish',actors.timetable_admin,{entries:[{...preview.body.data[0],kind:'test'}]})).status,409);
 assert.equal((await api('post',`/assessments/${id}/state`,actors.timetable_admin,{action:'open'})).status,200);
 assert.equal((await api('get',`/assessments/${id}`,invigilator)).status,200);
 assert.equal((await api('post',`/assessments/${id}/scan`,invigilator,{matched:true,studentId:student.id})).status,503);
 const requests=await Promise.all([api('post',`/assessments/${id}/exception`,invigilator,{station:'Station A',studentId:student.id,reason:'Physical student identity checked.'}),api('post',`/assessments/${id}/exception`,invigilator,{station:'Station B',studentId:student.id,reason:'Physical student identity checked.'})]);for(const r of requests)assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(await require('../models/assessmentAttendance.model').countDocuments(),1);
 assert.equal((await api('post',`/assessments/${id}/exception`,invigilator,{station:'Station A',studentId:student2.id,reason:'Physical student identity checked.'})).status,403);
 assert.equal((await api('post',`/assessments/${id}/state`,actors.timetable_admin,{action:'close'})).status,200);
 assert.equal((await api('get',`/assessments/${id}`,invigilator)).status,409);
});
test('lecturer score sheets require attendance, lock at submission, release grades only, and audit academic corrections',async()=>{
 const {lecturer,invigilator}=await workflowStaff();
 for(const kind of ['test','exam']){
 const p=await api('post','/assessments/publish',actors.timetable_admin,{entries:[{course:course.id,kind,startAt:new Date(),endAt:new Date(Date.now()+3600000),venue:'Hall A',capacity:50}]});assert.equal(p.status,201,JSON.stringify(p.body));const id=p.body.data[0]._id;
 const attendance=await api('post',`/assessments/${id}/exception`,invigilator,{studentId:student.id,station:'Station A',reason:'Identity verified against student card'});assert.equal(attendance.status,201);
 assert.equal((await api('post',`/assessments/exceptions/${attendance.body.data._id}/approve`,invigilator,{reason:'Cannot approve own check-in'})).status,403);
 assert.equal((await api('post',`/assessments/exceptions/${attendance.body.data._id}/approve`,actors.timetable_admin,{reason:'Student identity and physical presence confirmed'})).status,200);
 await api('post',`/assessments/${id}/state`,actors.timetable_admin,{action:'close'});
 }
 let r=await api('post',`/assessments/sheets/${course.id}/prepare`,lecturer);assert.equal(r.status,200,JSON.stringify(r.body));
 const other=await Staff.create({name:'Other Lecturer',username:'+2348000000009',phone:'+2348000000009',role:'lecturer',password:'OtherLecturer123!',mustChangePassword:false,createdBy:actors.timetable_admin.id});
 assert.equal((await api('get',`/assessments/sheets/${course.id}`,other)).status,403);
 const body={version:r.body.data.__v,rows:[{student:student.id,test:35,exam:45}]};
 r=await api('post',`/assessments/sheets/${course.id}/submit`,lecturer,body);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.data.state,'submitted');
 assert.equal((await api('put',`/assessments/sheets/${course.id}`,lecturer,{...body,version:r.body.data.__v})).status,409);
 assert.equal((await api('get','/results/view',student)).body.data[0].pending,true);
 assert.equal((await api('post',`/assessments/sheets/${course.id}/release`,lecturer)).status,403);
 r=await api('post',`/assessments/sheets/${course.id}/release`,actors.timetable_admin);assert.equal(r.status,200,JSON.stringify(r.body));
 let result=(await api('get','/results/view',student)).body.data[0];assert.equal(result.grade,'A');for(const k of ['test','exam','total'])assert.equal(result[k],undefined);
 const record=await Result.findOne({student:student.id});assert.equal((await api('put',`/results/${record.id}`,actors.timetable_admin,{test:0})).status,409);
 r=await api('post',`/assessments/sheets/${course.id}/correct`,actors.timetable_admin,{studentId:student.id,test:30,exam:40,reason:'Exam script reviewed with the lecturer'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.data.corrections.length,1);
 result=(await api('get','/results/view',student)).body.data[0];assert.equal(result.grade,'B');
});
test('student officer headcount is distinct from biometric enrolment and controls SRC feed posting immediately',async()=>{
 const officer=await Admin.create({username:'student_officer',password:'OfficerFixture123!',adminType:'student_officer'});const {lecturer,invigilator}=await workflowStaff();
 assert.equal((await api('get','/headcount/students?q=Alpha',officer)).body.data[0].name,student.name);
 assert.equal((await api('get','/headcount/students',actors.finance_admin)).status,403);
 const count=await api('post','/headcount',officer,{title:'Physical verification'});assert.equal(count.status,201);
 for(let i=0;i<2;i++)assert.equal((await api('post',`/headcount/${count.body.data._id}/record`,officer,{studentId:student.id,reason:'Verified student in person at the office'})).status,201);
 assert.equal((await api('get',`/headcount/${count.body.data._id}`,officer)).body.total,1);
 assert.equal((await api('post',`/headcount/${count.body.data._id}/close`,officer)).status,200);
 assert.equal((await api('post',`/headcount/${count.body.data._id}/record`,officer,{studentId:student2.id,reason:'Student arrived after the count closed'})).status,409);
 assert.equal((await api('get','/headcount/scanner',officer)).body.configured,false);
 assert.equal((await api('post',`/headcount/enroll/${student.id}`,officer,{fingerprint:'fake'})).status,503);
 assert.equal((await api('post','/feed',student,{body:'Not SRC yet'})).status,403);
 assert.equal((await api('put',`/feed/publishers/${student.id}`,actors.idcard_admin,{allowed:true})).status,403);
 assert.equal((await api('put',`/feed/publishers/${student.id}`,officer,{allowed:true})).status,200);
 const post=await api('post','/feed',student,{body:'SRC update https://example.org/'});assert.equal(post.status,201,JSON.stringify(post.body));const id=post.body.data._id;
 assert.equal((await api('get','/feed/unread',lecturer)).body.unread,1);
 assert.equal((await api('get',`/feed/${id}`,lecturer)).status,200);
 assert.equal((await api('get','/feed/unread',lecturer)).body.unread,0);
 assert.equal((await api('get','/feed',invigilator)).status,403);
 for(let i=0;i<2;i++)assert.equal((await api('put',`/feed/${id}/like`,student2,{liked:true})).body.count,1);
 assert.equal((await api('post',`/feed/${id}/comments`,student2,{body:'Thanks! https://example.org/info'})).status,201);
 assert.equal((await api('put',`/feed/publishers/${student.id}`,officer,{allowed:false})).status,200);
 assert.equal((await api('post','/feed',student,{body:'Permission removed'})).status,403);
 assert.equal((await api('delete',`/feed/${id}`,student2)).status,403);
 assert.equal((await api('delete',`/feed/${id}`,officer)).status,200);
 assert.equal((await api('get',`/feed/${id}`,lecturer)).status,404);
});
test('campus feed accepts real pictures, rejects video and notifies lecturer/admin/student devices',async()=>{
 const {lecturer}=await workflowStaff();
 for(const [user,suffix] of [[student,'student'],[lecturer,'lecturer'],[actors.finance_admin,'admin']])assert.equal((await api('post','/announcements/push/subscribe',user,{...subscriptionInput(),endpoint:`https://fcm.googleapis.com/fcm/send/${suffix}`})).status,200);
 assert.equal((await request(app).post('/feed').set('Authorization',bearer(actors.timetable_admin)).field('body','Video forbidden').attach('images',Buffer.from('fake-video'),{filename:'clip.mp4',contentType:'video/mp4'})).status,400);
 const picture=await sharp({create:{width:100,height:80,channels:3,background:'#abcdef'}}).png().toBuffer();
 const r=await request(app).post('/feed').set('Authorization',bearer(actors.timetable_admin)).field('body','Campus picture').attach('images',picture,{filename:'campus.png',contentType:'image/png'});assert.equal(r.status,201,JSON.stringify(r.body));
 const image=r.body.data.images[0];assert.match(image,/\.webp$/);assert.equal((await api('get',`/feed/images/${image}`,lecturer)).status,200);
 const paths=[];await push.processQueue({send:async(s,payload)=>paths.push(JSON.parse(payload).url)});assert.equal(paths.length,3);for(const prefix of ['student','lecturer','admin'])assert.ok(paths.some(p=>p===`/${prefix}/feed?open=${r.body.data._id}`));
});
test('absent assessment students stay explicit and pending exceptions block submission',async()=>{
 const {lecturer}=await workflowStaff();const Assessment=require('../models/assessment.model'),Attendance=require('../models/assessmentAttendance.model');let testId;
 for(const kind of ['test','exam']){const a=await Assessment.create({course:course.id,courseCode:course.courseCode,courseName:course.courseName,session:course.session,semester:course.semester,lecturer:lecturer.id,kind,startAt:new Date(Date.now()-7200000),endAt:new Date(Date.now()-3600000),venue:kind+' Hall',capacity:50,state:'closed',roster:[{student:student.id,name:student.name,matricNumber:student.matricNumber,department:student.department,level:student.level}],createdBy:actors.timetable_admin.id});if(kind==='test')testId=a.id}
 const pending=await Attendance.create({assessment:testId,student:student.id,station:'Station A',reason:'Unverified identity needs review',status:'pending_exception',method:'exception'});
 assert.equal((await api('post',`/assessments/sheets/${course.id}/prepare`,lecturer)).status,409);
 assert.equal((await api('post',`/assessments/exceptions/${pending.id}/reject`,actors.timetable_admin,{reason:'Student presence could not be verified'})).status,200);
 const sheet=await api('post',`/assessments/sheets/${course.id}/prepare`,lecturer);assert.equal(sheet.status,200);assert.equal(sheet.body.data.rows[0].testStatus,'absent');
 const submitted=await api('post',`/assessments/sheets/${course.id}/submit`,lecturer,{version:sheet.body.data.__v,rows:[{student:student.id,test:null,exam:null}]});assert.equal(submitted.status,200);assert.equal(submitted.body.data.rows[0].grade,null);
 assert.equal((await api('post',`/assessments/sheets/${course.id}/release`,actors.timetable_admin)).status,200);const view=await api('get','/results/view',student);assert.equal(view.body.data[0].outcome,'absent');assert.equal(view.body.data[0].grade,null);assert.equal(view.body.data[0].total,undefined);
});
const subscriptionInput=()=>({endpoint:'https://fcm.googleapis.com/fcm/send/isolated-fixture',keys:{p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}});
async function draftAnnouncement(audience={kind:'all',levels:[]}) {
 const r=await api('post','/announcements',actors.idcard_admin,{title:'Lecture update',body:'Classes resume Monday.',audience});assert.equal(r.status,201,JSON.stringify(r.body));return r.body.data;
}
async function subscribedAnnouncement(){
 const r=await api('post','/announcements/push/subscribe',student,subscriptionInput());assert.equal(r.status,200,JSON.stringify(r.body));
 const doc=await draftAnnouncement();assert.equal((await api('post',`/announcements/${doc._id}/publish`,actors.idcard_admin)).status,200);return doc;
}
test('announcements belong to ICT; targeted publication is private and idempotent',async()=>{
 for(const actor of [actors.timetable_admin,actors.general_admin,student])assert.equal((await api('post','/announcements',actor,{title:'No',body:'No'})).status,403);
 const audience={kind:'department',targetId:dept.id,levels:[100]};
 assert.equal((await api('post','/announcements/preview',actors.idcard_admin,{title:'Test',body:'Test',audience})).body.count,1);
 assert.equal((await api('post','/announcements',actors.idcard_admin,{title:'Test',body:'Test',audience:{kind:'all',levels:4}})).status,400);
 const doc=await draftAnnouncement(audience);
 assert.equal((await api('get','/announcements/inbox',student)).body.data.length,0);
 for(let i=0;i<2;i++)assert.equal((await api('post',`/announcements/${doc._id}/publish`,actors.idcard_admin)).status,200);
 assert.equal(await Receipt.countDocuments(),1);
 assert.equal((await api('get','/announcements/inbox',student)).body.unread,1);
 assert.equal((await api('get','/announcements/inbox',student2)).body.data.length,0);
 assert.equal((await api('post',`/announcements/${doc._id}/read`,student2)).status,404);
 assert.equal((await api('post',`/announcements/${doc._id}/read`,student)).status,200);
 assert.equal((await api('get','/announcements/inbox',student)).body.unread,0);
 assert.equal((await api('put',`/announcements/${doc._id}`,actors.idcard_admin,{title:'Edit',body:'Published'})).status,409);
 assert.equal((await api('get','/announcements/admin',student)).status,403);
});
test('announcements withdrawal and expiry hide content and cancel pending push',async()=>{
 const doc=await subscribedAnnouncement();
 assert.equal((await api('post',`/announcements/${doc._id}/withdraw`,actors.idcard_admin)).status,200);
 assert.equal((await api('get','/announcements/inbox',student)).body.data.length,0);
 assert.equal((await api('post',`/announcements/${doc._id}/read`,student)).status,404);
 assert.equal((await Delivery.findOne()).state,'skipped');
 assert.equal((await api('post',`/announcements/${doc._id}/publish`,actors.idcard_admin)).status,409);
 const next=await draftAnnouncement();await api('post',`/announcements/${next._id}/publish`,actors.idcard_admin);
 await Announcement.updateOne({_id:next._id},{$set:{expiresAt:new Date(Date.now()-1000)}});
 assert.equal((await api('get','/announcements/inbox',student)).body.data.length,0);
 let sent=0;await push.processQueue({send:async()=>{sent++}});assert.equal(sent,0);
});
test('announcements support multiple departments combined with selected levels',async()=>{
 await Student.updateOne({_id:student2.id},{$set:{level:200}});
 const audience={kind:'department',targetIds:[dept.id,dept2.id],levels:[100,200]};
 let r=await api('post','/announcements/preview',actors.idcard_admin,{title:'Selected departments',body:'Joint announcement',audience});assert.equal(r.status,200);assert.equal(r.body.count,2);
 r=await api('post','/announcements/preview',actors.idcard_admin,{title:'Selected departments',body:'Joint announcement',audience:{...audience,levels:[200]}});assert.equal(r.body.count,1);
 const doc=await draftAnnouncement(audience);assert.equal(doc.audience.targetIds.length,2);
 assert.equal((await api('post',`/announcements/${doc._id}/publish`,actors.idcard_admin)).status,200);
 assert.equal((await api('get','/announcements/inbox',student)).body.data.length,1);assert.equal((await api('get','/announcements/inbox',student2)).body.data.length,1);
 assert.equal((await api('post','/announcements/preview',actors.idcard_admin,{title:'Invalid',body:'Invalid',audience:{...audience,targetIds:[]}})).status,400);
});
test('push validates endpoint hosts and keys, and device ownership prevents cross-account delivery',async()=>{
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.example/x','https://fcm.googleapis.com:444/x'])assert.equal((await api('post','/announcements/push/subscribe',student,{...subscriptionInput(),endpoint})).status,400);
 assert.equal((await api('post','/announcements/push/subscribe',student,{...subscriptionInput(),keys:{p256dh:'bad',auth:'bad'}})).status,400);
 await subscribedAnnouncement();
 assert.equal((await api('post','/announcements/push/subscribe',student2,subscriptionInput())).status,200);
 let sent=0;await push.processQueue({send:async()=>{sent++}});assert.equal(sent,0);assert.equal((await Delivery.findOne()).state,'skipped');
 await api('post','/announcements/push/unsubscribe',student,{endpoint:subscriptionInput().endpoint});assert.equal((await Subscription.findOne()).active,true);
 await api('post','/announcements/push/unsubscribe',student2,{endpoint:subscriptionInput().endpoint});assert.equal((await Subscription.findOne()).active,false);
});
test('push queue retries transient failures, recovers leases, and records provider acceptance without exposing announcement text',async()=>{
 await subscribedAnnouncement();let sent=0;
 await push.processQueue({send:async()=>{sent++;throw Object.assign(new Error('Unavailable'),{statusCode:503})}});
 let job=await Delivery.findOne();assert.equal(job.state,'pending');assert.equal(job.attempts,1);
 await push.processQueue({send:async()=>{sent++}});assert.equal(sent,1);
 await Delivery.updateOne({_id:job.id},{$set:{state:'processing',leaseUntil:new Date(Date.now()-1000)}});
 await push.processQueue({send:async(sub,payload)=>{sent++;assert.equal(sub.endpoint,subscriptionInput().endpoint);const data=JSON.parse(payload);assert.ok(data.url.endsWith(job.announcement.toString()));assert.ok(!payload.includes('Classes resume'));}});
 job=await Delivery.findOne();assert.equal(sent,2);assert.equal(job.state,'accepted');assert.equal(job.attempts,2);
 await push.processQueue({send:async()=>{sent++}});assert.equal(sent,2);
});
test('push removes expired subscriptions and skips revoked accounts',async()=>{
 await subscribedAnnouncement();await push.processQueue({send:async()=>{throw Object.assign(new Error('Expired'),{statusCode:410})}});
 assert.equal((await Subscription.findOne()).active,false);assert.equal((await Delivery.findOne()).state,'failed');
 await api('post','/announcements/push/subscribe',student,subscriptionInput());
 const next=await draftAnnouncement();await api('post',`/announcements/${next._id}/publish`,actors.idcard_admin);
 await Student.updateOne({_id:student.id},{$inc:{tokenVersion:1}});
 let sent=0;await push.processQueue({send:async()=>{sent++}});assert.equal(sent,0);assert.equal((await Delivery.findOne({announcement:next._id})).state,'skipped');
});
test('announcements still publish when push is unconfigured',async()=>{
 const key=process.env.VAPID_PRIVATE_KEY;delete process.env.VAPID_PRIVATE_KEY;
 try{assert.equal((await api('get','/announcements/push/config',student)).body.enabled,false);assert.equal((await api('post','/announcements/push/subscribe',student,subscriptionInput())).status,503);const doc=await draftAnnouncement();assert.equal((await api('post',`/announcements/${doc._id}/publish`,actors.idcard_admin)).status,200);assert.equal((await api('get','/announcements/inbox',student)).body.data.length,1);}finally{process.env.VAPID_PRIVATE_KEY=key}
});
test('password is hashed once and administrator responses exclude hashes',async()=>{
 const login=await request(app).post('/auth/admin/login').send({username:'general_admin',password:'FixturePassword123!'});assert.equal(login.status,200);
 const list=await api('get','/admin/all',actors.general_admin);assert.equal(list.status,200);assert.ok(list.body.data.every(a=>!a.password));
});
test('deleted account token cannot access protected endpoints',async()=>{
 const authorization=bearer(actors.finance_admin);await Admin.findByIdAndDelete(actors.finance_admin.id);
 assert.equal((await request(app).get('/finance/stats').set('Authorization',authorization)).status,401);
});
test('password reset revokes existing student tokens',async()=>{
 const old=bearer(student);const reset=await api('post','/auth/student/reset-password',actors.idcard_admin,{studentId:student.id,newPassword:'ReplacementPassword123!'});assert.equal(reset.status,200);
 assert.equal((await request(app).get('/profile').set('Authorization',old)).status,401);
});
test('refresh preserves current administrator permissions',async()=>{
 const result=await request(app).post('/auth/refresh').send({oldToken:bearer(actors.registry_admin).slice(7)});assert.equal(result.status,200);
 assert.equal((await request(app).get('/registry/stats').set('Authorization',`Bearer ${result.body.token}`)).status,200);
});
test('student password changes require confirmation and revoke old access',async()=>{
 const body={currentPassword:'FixturePassword123!',newPassword:'NewPassword123!',confirmPassword:'wrong'};
 assert.equal((await api('put','/students/password',student,body)).status,400);
 body.confirmPassword=body.newPassword;assert.equal((await api('put','/students/password',student,body)).status,200);
 assert.equal((await api('get','/profile',student)).status,401);
});
test('matric generation belongs exclusively to the ID-card administrator and is atomic',async()=>{
 const body={departmentId:dept.id,level:100};assert.equal((await api('post','/matric/generate',actors.registry_admin,body)).status,403);
 const results=await Promise.all(Array.from({length:5},()=>api('post','/matric/generate',actors.idcard_admin,body)));
 for(const r of results)assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(new Set(results.map(r=>r.body.data.matricNumber)).size,5);
 assert.equal((await api('post','/matric/generate',actors.idcard_admin,{...body,manualCounter:1})).status,409);
});
test('finance includes legacy debt and never adds different currencies',()=>{
 const recalculate=require('../utils/financeRecalculator');
 const record={items:[{label:'Tuition',amount:100,paidAmount:100,currency:'NGN'}],carriedOverBalance:50,currency:'NGN'};recalculate(record);assert.equal(record.outstandingBalance,50);assert.equal(record.paymentStatus,'Partial');
 const mixed={items:[{label:'Tuition',amount:100,paidAmount:0,currency:'NGN'},{label:'Library',amount:100,paidAmount:0,currency:'XAF'}]};recalculate(mixed);assert.equal(mixed.totalAmount,null);assert.equal(mixed.totalsByCurrency.NGN.totalAmount,100);assert.equal(mixed.totalsByCurrency.XAF.totalAmount,100);
});
async function createFinance(){const r=await api('post','/finance/create',actors.finance_admin,{studentId:student.id,session:'2026/2027',semester:'First',items:[{label:'ID Card',amount:100,currency:'NGN'}]});assert.equal(r.status,201,JSON.stringify(r.body));return r.body.data;}
test('payment before first visit creates a paid ID card; retry is idempotent; reversal is recorded',async()=>{
 const record=await createFinance();const body={reference:'receipt-test-0001',payments:[{itemLabel:'ID Card',amountPaid:'100'}]};
 const r=await api('post',`/finance/pay/${record._id}`,actors.finance_admin,body);assert.equal(r.status,200,JSON.stringify(r.body));
 assert.equal((await api('post',`/finance/pay/${record._id}`,actors.finance_admin,body)).status,200);
 assert.equal((await Finance.findById(record._id)).totalPaid,100);assert.equal((await IdCard.findOne({student:student.id})).feePaid,true);
 const reverse=await api('post',`/finance/payments/${r.body.receipt._id}/reverse`,actors.finance_admin,{reason:'Duplicate bank deposit'});assert.equal(reverse.status,200,JSON.stringify(reverse.body));assert.equal((await Finance.findById(record._id)).totalPaid,0);assert.equal((await IdCard.findOne({student:student.id})).feePaid,false);
 assert.equal((await api('post',`/finance/payments/${r.body.receipt._id}/reverse`,actors.finance_admin,{reason:'Repeat reversal'})).status,409);
});
test('overpayment is rejected and another student cannot read receipts',async()=>{
 const r=await createFinance();assert.equal((await api('post',`/finance/pay/${r._id}`,actors.finance_admin,{reference:'overpayment-test',payments:[{itemLabel:'ID Card',amountPaid:101}]})).status,400);
 assert.equal((await api('get',`/finance/${r._id}/payments`,student2)).status,404);
});
test('new session finance does not copy an existing unpaid obligation',async()=>{
 await createFinance();const r=await api('post','/finance/create',actors.finance_admin,{studentId:student.id,session:'2027/2028',semester:'First',items:[{label:'Tuition',amount:200,currency:'NGN'}]});assert.equal(r.status,201);assert.equal(r.body.data.carriedOverBalance,0);
});
test('manual results calculate server grades, reject invalid scores and preserve pending rows',async()=>{
 const payload={matricNumber:student.matricNumber,courseCode:course.courseCode,session:'2026/2027',semester:'First',test:35,exam:45,total:1,grade:'F'};
 const r=await api('post','/results/bulk',actors.timetable_admin,{results:[payload,{...payload,matricNumber:student2.matricNumber,test:999}]});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.data.summary.saved,1);assert.equal(r.body.data.summary.failed,1);assert.equal(r.body.data.processed[0].grade,'A');
 const view=await api('get','/results/view',student);assert.equal(view.body.data[0].grade,'A');assert.equal(view.body.data[0].total,undefined);assert.equal(view.body.data[0].test,undefined);assert.equal(view.body.data[0].exam,undefined);
});
test('grading follows the confirmed ten-point boundaries',()=>{
 const grade=require('../utils/resultCalculator');for(const [score,expected] of [[100,'A'],[80,'A'],[79,'B'],[70,'B'],[69,'C'],[60,'C'],[59,'D'],[50,'D'],[49,'E'],[40,'E'],[39,'F'],[0,'F']])assert.equal(grade(score),expected);
});
test('same course in different sessions stays distinct',async()=>{
 for(const [session,total] of [['2025/2026',70],['2026/2027',80]])await Result.create({student:student.id,courseCode:course.courseCode,courseName:course.courseName,creditUnit:3,test:30,exam:total-30,total,grade:total===80?'A':'B',session,semester:'First'});
 const view=await api('get','/results/view',student);assert.equal(view.status,200);assert.equal(view.body.data.length,2);assert.equal(new Set(view.body.data.map(r=>r.session)).size,2);
});
test('Excel upload works with the fields sent by the UI',async()=>{
 const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Results');sheet.addRow(['Matric Number','Test','Exam']);sheet.addRow([student.matricNumber,35,45]);
 const r=await request(app).post('/results/upload-bulk').set('Authorization',bearer(actors.timetable_admin)).field('courseCode','CSC101').field('session','2026/2027').field('semester','First').attach('file',Buffer.from(await workbook.xlsx.writeBuffer()),'results.xlsx');
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.data.summary.saved,1);assert.equal(r.body.data.processed[0].grade,'A');
});
test('semester transitions, inactive state and Summer closure work end to end',async()=>{
 const ga=actors.general_admin;let r=await api('post','/session/end-current-phase',ga,{});assert.equal(r.status,200);assert.equal(r.body.data.phase,'second');assert.equal(r.body.data.status,'inactive');
 assert.equal((await api('get','/session/academic/active',student)).body.data,null);
 r=await api('post','/session/start-next-phase',ga,{phase:'second',startNow:true});assert.equal(r.body.data.semester,'Second');
 await api('post','/session/end-current-phase',ga,{});r=await api('post','/session/start-next-phase',ga,{phase:'summer',startNow:true});assert.equal(r.status,200);assert.equal(r.body.data.semester,'Summer');
 r=await api('post','/session/end-current-phase',ga,{});assert.equal(r.body.data.status,'closed');
 r=await api('post','/session/create',ga,{session:'2027/2028',startNow:false,startDate:new Date(Date.now()+86400000).toISOString()});assert.equal(r.status,201);assert.equal(r.body.data.status,'scheduled');assert.ok(r.body.data.startDate);
 await Session.updateOne({_id:r.body.data._id},{$set:{startDate:new Date(Date.now()-1000)}});await require('../services/session.service').activateDue();assert.equal((await Session.findById(r.body.data._id)).status,'active');
});
test('generator previews shared classes without saving, publishes idempotently and prevents clashes',async()=>{
 await Course.create({courseCode:'GST101',courseName:'General Studies',creditUnit:2,lecturer:'Dr Alpha',targets:[{type:'faculty',name:'Science',level:100}],session:'2026/2027',semester:'First'});
 const timetable=require('../models/timetable.model');const admin=actors.timetable_admin;
 const preview=await api('post','/timetable/generate',admin,{session:'2026/2027',semester:'First'});assert.equal(preview.status,201,JSON.stringify(preview.body));assert.equal(await timetable.countDocuments(),0);
 const entries=preview.body.data;assert.equal(entries.length,3);const gst=entries.filter(r=>r.courseCode==='GST101');assert.equal(gst[0].day,gst[1].day);assert.equal(gst[0].time,gst[1].time);
 const saved=await api('post','/timetable/bulk',admin,{entries});assert.equal(saved.status,201,JSON.stringify(saved.body));assert.equal(await timetable.countDocuments(),3);
 assert.ok([200,201].includes((await api('post','/timetable/bulk',admin,{entries})).status));assert.equal(await timetable.countDocuments(),3);
 const csc=await timetable.findOne({courseCode:'CSC101'});const clash=await api('put',`/timetable/${csc.id}`,admin,{day:gst[0].day,time:gst[0].time});assert.equal(clash.status,409);
 const repeated=await api('post','/timetable/generate',admin,{session:'2026/2027',semester:'First'});assert.equal(repeated.body.data.length,0);
});
test('student profile edits retain historical enrollment and archival retains results',async()=>{
 await api('get','/courses/view',student);
 const r=await api('put',`/students/${student.id}`,actors.idcard_admin,{name:'Student Updated',departmentId:dept.id,level:200,status:'active'});assert.equal(r.status,200,JSON.stringify(r.body));
 const enrollment=await require('../models/enrollment.model').findOne({student:student.id});assert.equal(enrollment.level,100);
 const roster=await api('get','/results/students-for-course?courseCode=CSC101&session=2026/2027&semester=First',actors.timetable_admin);assert.equal(roster.status,200,JSON.stringify(roster.body));assert.ok(roster.body.data.some(s=>s._id===student.id));
 await Result.create({student:student.id,courseCode:'CSC101',courseName:'Computing',creditUnit:3,test:30,exam:50,total:80,grade:'A',session:'2026/2027',semester:'First'});
 await api('delete',`/auth/student/${student.id}`,actors.idcard_admin);assert.equal(await Result.countDocuments({student:student.id}),1);assert.equal((await api('get','/profile',student)).status,401);
});
test('department renaming updates linked students and course targets',async()=>{
 const r=await api('put',`/registry/departments/${dept.id}`,actors.registry_admin,{name:'Computer Sciences',facultyId:faculty.id,minLevel:100,maxLevel:400,abbreviation:'CSC'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal((await Student.findById(student.id)).department,'COMPUTER SCIENCES');assert.equal((await Course.findById(course.id)).targets[0].name,'Computer Sciences');
});
test('approved ID card produces two CR80 PDF pages; only TAC can print; renewal revokes verification',async()=>{
 const printing=require('../services/cardPrinting.service');const image=await sharp({create:{width:200,height:250,channels:3,background:'#aaccee'}}).jpeg().toBuffer();const photo=await printing.storePhoto(image);
 const card=await IdCard.create({student:student.id,feePaid:true,status:'pending',photoURL:photo,fullName:student.name,matricNumber:student.matricNumber,nationality:'Nigerian',dateOfBirth:new Date('2002-04-20'),department:student.department,gender:'Male',phone:'+234 000 000 0000',session:'2026/2027',level:100});
 assert.equal((await api('get',`/idcard/${card.id}/print`,student)).status,403);
 assert.equal((await api('get',`/idcard/${card.id}/print`,actors.registry_admin)).status,403);
 assert.equal((await api('post',`/idcard/${card.id}/approve`,actors.idcard_admin,{})).status,200);
 const approved=await IdCard.findById(card.id);const bytes=await printing.printable(card.id,{userId:actors.idcard_admin.id},'127.0.0.1');const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2);assert.ok(Math.abs(pdf.getPage(0).getWidth()-242.6457)<0.1);await fs.mkdir(path.join(__dirname,'artifacts'),{recursive:true});await fs.writeFile(path.join(__dirname,'artifacts/sample-idcard.pdf'),bytes);
 assert.equal((await request(app).get('/idcard/verify/'+approved.verificationToken)).body.valid,true);
 assert.equal((await api('post',`/idcard/${card.id}/collect`,actors.idcard_admin,{})).status,404); // collection uses PATCH, not POST
 assert.equal((await api('patch',`/idcard/${card.id}/collect`,actors.idcard_admin,{})).status,200);
 await api('post',`/idcard/${card.id}/renew`,actors.idcard_admin,{});assert.equal((await request(app).get('/idcard/verify/'+approved.verificationToken)).body.valid,false);
});


test('legacy reconciliation preserves legitimate debt and removes only an exact duplicate',async()=>{
 const record=await createFinance();
 const later=await Finance.create({student:student.id,session:'2027/2028',semester:'First',currency:'NGN',items:[],carriedOverBalance:100});
 const r=await api('post',`/finance/${later.id}/reconcile`,actors.finance_admin,{mode:'duplicate',sourceId:record._id,reason:'Confirmed prior invoice remains outstanding'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.data.carriedOverBalance,0);assert.equal((await Finance.findById(record._id)).outstandingBalance,100);
 const opening=await Finance.create({student:student2.id,session:'2026/2027',semester:'First',currency:'NGN',items:[],carriedOverBalance:50});
 const o=await api('post',`/finance/${opening.id}/reconcile`,actors.finance_admin,{mode:'opening',reason:'Independent debt from before portal use'});assert.equal(o.status,200);assert.equal(o.body.data.outstandingBalance,50);
 const p=await api('post',`/finance/pay/${opening.id}`,actors.finance_admin,{reference:'opening-debt-payment',payments:[{itemLabel:o.body.data.items[0].label,amountPaid:50}]});assert.equal(p.status,200);assert.equal(p.body.data.paymentStatus,'Paid');
});
test('academic transitions are written to the audit log',async()=>{
 await api('post','/session/end-current-phase',actors.general_admin,{});
 assert.equal(await require('../models/auditLog.model').countDocuments({targetType:'SESSION'}),1);
});

test('all-level finance templates match future registrations and prefer exact levels',async()=>{
 const Template=require('../models/financeTemplate.model');const service=require('../services/financeTemplate.service');
 const broad=await Template.create({name:'Department fees',target:'department',department:dept.name,items:[{label:'Tuition',amount:100,currency:'NGN'}],createdBy:actors.finance_admin.id,isActive:true});
 assert.equal((await service.getActiveTemplateForStudent(student)).id,broad.id);
 const specific=await Template.create({name:'First-year fees',target:'department',department:dept.name,level:100,items:[{label:'Tuition',amount:200,currency:'NGN'}],createdBy:actors.finance_admin.id,isActive:true});
 assert.equal((await service.getActiveTemplateForStudent(student)).id,specific.id);
});

test('generator reports capacity exhaustion without publishing a partial schedule',async()=>{
 const rows=Array.from({length:20},(_,i)=>({courseCode:`EX${String(i).padStart(3,'0')}`,courseName:'Extra course',creditUnit:1,lecturer:'Dr Alpha',targets:[{type:'department',name:dept.name,level:100}],session:'2026/2027',semester:'First'}));await Course.insertMany(rows);
 const plan=await require('../services/scheduling.service').plan({session:'2026/2027',semester:'First'});assert.equal(plan.summary.totalCourses,21);assert.equal(plan.unscheduled.length,1);assert.equal(plan.data.length,20);assert.equal(await require('../models/timetable.model').countDocuments(),0);
});

test('student submission validates an actual image and derives identity and session from the account',async()=>{
 await IdCard.create({student:student.id,feePaid:true});
 const fields={fullName:'Forged Name',nationality:'Nigerian',dateOfBirth:'2002-04-20',gender:'Male',phone:'+2348012345678',matricNumber:student2.matricNumber,department:'Biochemistry',level:'200',session:'2000/2001'};
 const image=await sharp({create:{width:100,height:120,channels:3,background:'#abcdef'}}).png().toBuffer();
 const submitted=await api('post','/idcard/create',student).field(fields).attach('photoURL',image,{filename:'passport.png',contentType:'image/png'});assert.equal(submitted.status,201,JSON.stringify(submitted.body));assert.equal(submitted.body.data.fullName,student.name);assert.equal(submitted.body.data.matricNumber,student.matricNumber);assert.equal(submitted.body.data.session,'2026/2027');
 const filename=submitted.body.data.photoURL;
 assert.equal((await api('get',`/idcard/photo/${filename}`,student)).status,200);
 assert.equal((await api('get',`/idcard/photo/${filename}`,student2)).status,404);
 assert.equal((await request(app).get(`/uploads/${filename}`)).status,404);
 const invalid=await api('post','/idcard/create',student2).field(fields).attach('photoURL',Buffer.from('not an image'),{filename:'fake.png',contentType:'image/png'});assert.equal(invalid.status,400);
});
