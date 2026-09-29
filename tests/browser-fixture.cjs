// Isolated browser acceptance server. Never reads or connects to application MONGO_URI.
process.env.MONGOMS_DOWNLOAD_DIR = require('node:path').join(__dirname,'../node_modules/.cache/mongodb-memory-server');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'browser-fixture-only-secret-never-use-in-production';
process.env.FRONTEND_URL = 'http://127.0.0.1:5174';
const app = require('../app');
const Admin = require('../models/admin.model');
const Student = require('../models/student.model');
const Faculty = require('../models/faculty.model');
const Department = require('../models/department.model');
const Course = require('../models/timetableCourse.model');
const Session = require('../models/session.model');
const Finance = require('../models/finance.model');
const Result = require('../models/result.model');
const IdCard = require('../models/idcard.model');
const sharp = require('sharp');
let db, server, directory;
async function start() {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ifatoss-browser-'));
  process.env.UPLOAD_DIR = directory;
  db = await MongoMemoryReplSet.create({ instanceOpts:[{launchTimeout:60000}], replSet:{count:1,storageEngine:'wiredTiger'} });
  await mongoose.connect(db.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  const admins = {};
  for (const adminType of ['general_admin','registry_admin','finance_admin','idcard_admin','timetable_admin','student_officer']) {
    admins[adminType] = await Admin.create({username:adminType,password:'BrowserFixture123!',adminType});
  }
  const faculty = await Faculty.create({name:'Science'});
  await Department.create({name:'Computer Science',faculty:faculty.id,minLevel:100,maxLevel:400,abbreviation:'CSC'});
  const student = await Student.create({name:'Browser Student',matricNumber:'I-FAT/29/CSC/0001',password:'BrowserFixture123!',department:'COMPUTER SCIENCE',faculty:'SCIENCE',level:100});
  await Session.create({session:'2026/2027',phase:'first',status:'active',createdBy:admins.general_admin.id});
  for (const code of ['CSC101','CSC102']) await Course.create({courseCode:code,courseName:code==='CSC101'?'Introduction to Computing':'Programming',creditUnit:3,lecturer:'Dr Browser',targets:[{type:'department',name:'Computer Science',level:100}],session:'2026/2027',semester:'First'});
  await Result.create({student:student.id,courseCode:'CSC101',courseName:'Introduction to Computing',creditUnit:3,test:35,exam:45,total:80,grade:'A',session:'2026/2027',semester:'First'});
  const finance = new Finance({student:student.id,session:'2026/2027',semester:'First',items:[{label:'ID Card',amount:100,paidAmount:100,currency:'NGN'},{label:'Tuition',amount:1000,paidAmount:0,currency:'XAF'}]});
  require('../utils/financeRecalculator')(finance); await finance.save();
  const photoURL = await require('../services/cardPrinting.service').storePhoto(await sharp({create:{width:200,height:250,channels:3,background:'#abcdef'}}).png().toBuffer());
  await IdCard.create({student:student.id,feePaid:true,status:'pending',fullName:student.name,matricNumber:student.matricNumber,department:student.department,level:100,session:'2026/2027',nationality:'Nigerian',dateOfBirth:'2002-04-20',gender:'Male',phone:'+2348012345678',photoURL,submittedAt:new Date()});
  const Staff=require('../models/staff.model'),Assessment=require('../models/assessment.model'),Attendance=require('../models/assessmentAttendance.model');
  const lecturer=await Staff.create({name:'Dr Browser Lecturer',username:'+2348111222333',phone:'+2348111222333',role:'lecturer',password:'BrowserFixture123!',mustChangePassword:true,createdBy:admins.timetable_admin.id});
  await Staff.create({name:'External Invigilators',username:'exam-desk',role:'invigilator',password:'BrowserFixture123!',mustChangePassword:false,createdBy:admins.timetable_admin.id});
  const assessmentCourse=await Course.create({courseCode:'EXM101',courseName:'Assessment Workflow',creditUnit:3,lecturer:lecturer.name,lecturerPhone:lecturer.phone,lecturerId:lecturer.id,targets:[{type:'department',name:'Computer Science',level:100}],session:'2026/2027',semester:'First'});
  const roster=[{student:student.id,name:student.name,matricNumber:student.matricNumber,department:student.department,level:student.level}];
  const test=await Assessment.create({course:assessmentCourse.id,courseCode:'EXM101',courseName:assessmentCourse.courseName,session:'2026/2027',semester:'First',lecturer:lecturer.id,kind:'test',startAt:new Date(Date.now()-7200000),endAt:new Date(Date.now()-3600000),venue:'Test Hall',capacity:50,state:'closed',roster,createdBy:admins.timetable_admin.id});
  await Attendance.create({assessment:test.id,student:student.id,status:'present',method:'exception',station:'Fixture test station',reason:'Isolated test fixture attendance',approvedBy:admins.timetable_admin.id,approvedAt:new Date(),checkedInAt:new Date()});
  await Assessment.create({course:assessmentCourse.id,courseCode:'EXM101',courseName:assessmentCourse.courseName,session:'2026/2027',semester:'First',lecturer:lecturer.id,kind:'exam',startAt:new Date(Date.now()-60000),endAt:new Date(Date.now()+3600000),venue:'Exam Hall',capacity:50,state:'published',roster,createdBy:admins.timetable_admin.id});
  app.post('/__fixture/cleanup', async (req,res) => {
    if (!process.env.BROWSER_FIXTURE_TOKEN || req.get('x-fixture-token') !== process.env.BROWSER_FIXTURE_TOKEN) return res.sendStatus(403);
    try { await cleanup(); res.json({cleaned:true}); }
    catch { res.status(500).json({cleaned:false}); }
  });
  server=app.listen(4001,'127.0.0.1',()=>console.log('Isolated browser fixture ready on 4001'));
}
let cleanupPromise;
function cleanup() {
  return cleanupPromise ||= (async () => {
    await mongoose.disconnect(); await db?.stop();
    // directory is created by mkdtemp above, never taken from application configuration.
    if(directory) await fs.rm(directory,{recursive:true,force:true});
  })();
}
async function stop(code=0) { server?.close(); await cleanup(); process.exit(typeof code === 'number' ? code : 0); }
process.on('SIGTERM',stop);process.on('SIGINT',stop);
start().catch(async error=>{console.error(error);await stop(1);});
