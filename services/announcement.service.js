const mongoose=require('mongoose');
const Announcement=require('../models/announcement.model');
const Receipt=require('../models/announcementReceipt.model');
const Subscription=require('../models/pushSubscription.model');
const Delivery=require('../models/pushDelivery.model');
const Student=require('../models/student.model');
const AppError=require('../utils/appError');
const Audit=require('../models/auditLog.model');
const exact=require('../utils/studentCourseResolver').caseInsensitiveExact;

async function fields(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new AppError('Invalid announcement',400);
  if(input.audience?.levels!==undefined&&!Array.isArray(input.audience.levels))throw new AppError('Invalid audience levels',400);
  const title=String(input.title||'').trim(),body=String(input.body||'').trim();
  if(!title||title.length>140||!body||body.length>10000)throw new AppError('Enter a title (1–140 characters) and message (1–10,000 characters)',400);
  const kind=input.audience?.kind||'all';
  const channel=input.channel||'students';
  if(!['students','staff'].includes(channel)||!(channel==='staff'?['all','admins','lecturers','selected_staff']:['all','faculty','department']).includes(kind))throw new AppError('Invalid audience',400);
  const levels=[...new Set(input.audience?.levels||[])];
  if(levels.length>10||levels.some(n=>!Number.isInteger(n)||n<100||n>1000||n%100))throw new AppError('Invalid audience levels',400);
  let targetId=null,targetIds=[],label=channel==='staff'?({all:'All staff',admins:'All administrators',lecturers:'All lecturers',selected_staff:'Selected staff'}[kind]):'All students';
  if(['faculty','department','selected_staff'].includes(kind)){
    const selected=input.audience?.targetIds??[input.audience?.targetId];
    if(!Array.isArray(selected)||!selected.length||selected.length>200||selected.some(id=>typeof id!=='string'||!mongoose.isValidObjectId(id)))throw new AppError('Choose valid audiences',400);
    targetIds=[...new Set(selected)];targetId=targetIds[0];
    const targets=kind==='selected_staff'?[...await require('../models/admin.model').find({_id:{$in:targetIds},status:{$ne:'archived'}}),...await require('../models/staff.model').find({_id:{$in:targetIds},role:'lecturer',status:'active'})]:await require(`../models/${kind}.model`).find({_id:{$in:targetIds}});
    if(targets.length!==targetIds.length)throw new AppError('An audience no longer exists',400);
    label=targets.map(t=>t.name||t.username).sort().join(', ');
  }
  const expiresAt=input.expiresAt?new Date(input.expiresAt):null;
  if(expiresAt&&(!Number.isFinite(expiresAt.getTime())||expiresAt<=new Date()))throw new AppError('Expiry must be a future date',400);
  if(input.pushRequested!==undefined&&typeof input.pushRequested!=='boolean')throw new AppError('Invalid notification choice',400);
  if(channel==='staff'&&levels.length)throw new AppError('Student levels do not apply to staff announcements',400);
  return {title,body,channel,audience:{kind,targetId,targetIds,label,levels},expiresAt,pushRequested:input.pushRequested!==false};
}
function canPublish(channel,actor){if(actor.role!=='admin'||channel==='students'&&actor.adminType!=='idcard_admin')throw new AppError('Only ICT can publish student announcements; administrators can publish staff announcements',403)}
function owns(doc,actor){if(!doc)throw new AppError('Announcement not found',404);canPublish(doc.channel,actor);if(String(doc.createdBy)!==String(actor.userId))throw new AppError('Only the author can change this announcement',403)}
async function recipients(data,session){
 if(data.channel!=='staff')return Student.find(await audienceQuery(data.audience)).select('_id tokenVersion role').session(session||null);
 const kind=data.audience.kind,filter={status:{$ne:'archived'},...(kind==='selected_staff'?{_id:{$in:data.audience.targetIds}}:{})};
 const admins=kind==='lecturers'?[]:await require('../models/admin.model').find(filter).select('_id tokenVersion role').session(session||null);
 const lecturers=kind==='admins'?[]:await require('../models/staff.model').find({...filter,role:'lecturer'}).select('_id tokenVersion role').session(session||null);
 return [...admins,...lecturers];
}
async function audienceQuery(audience) {
  const query={status:{$nin:['archived','graduated']}};
  if(audience.kind!=='all') {
    const ids=audience.targetIds?.length?audience.targetIds:[audience.targetId];
    const targets=await require(`../models/${audience.kind}.model`).find({_id:{$in:ids}});
    if(targets.length!==ids.length)throw new AppError('An audience no longer exists; edit the draft',409);
    query[audience.kind]={$in:targets.map(target=>exact(target.name).$regex)};
  }
  if(audience.levels.length)query.level={$in:audience.levels};
  return query;
}
async function save(id,input,actor) {
  const data=await fields(input);
  canPublish(data.channel,actor);
  if(!id)return Announcement.create({...data,createdBy:actor.userId});
  owns(await Announcement.findById(id),actor);
  const doc=await Announcement.findOneAndUpdate({_id:id,state:'draft'},{$set:data},{new:true,runValidators:true});
  if(!doc)throw new AppError('Only draft announcements can be edited',409);
  return doc;
}
async function publish(id,actor) {
  const session=await mongoose.startSession();let doc;
  try{
    await session.withTransaction(async()=>{
      doc=await Announcement.findById(id).session(session);
      if(!doc)throw new AppError('Announcement not found',404);
      owns(doc,actor);
      if(doc.state==='published')return; // repeated publish does not send twice
      if(doc.state!=='draft')throw new AppError('Withdrawn announcements cannot be republished',409);
      if(doc.expiresAt&&doc.expiresAt<=new Date())throw new AppError('Update the expiry before publishing',400);
      const students=await recipients(doc,session);
      if(!students.length)throw new AppError('No active recipients match this audience',400);
      doc.state='published';doc.publishedAt=new Date();doc.recipientCount=students.length;
      await doc.save({session});
      const ids=students.map(s=>s._id);
      await Receipt.insertMany(students.map(student=>({announcement:doc._id,student:student._id,recipientRole:student.role})),{session});
      if(doc.pushRequested){
        const versions=new Map(students.map(s=>[s.id,s.tokenVersion||0]));
        const subscriptions=await Subscription.find({student:{$in:ids},active:true}).session(session);
        const jobs=subscriptions.filter(s=>s.tokenVersion===versions.get(String(s.student))).map(s=>({announcement:doc._id,student:s.student,recipientRole:s.recipientRole,subscription:s._id}));
        if(jobs.length)await Delivery.insertMany(jobs,{session});
      }
      await Audit.create([{performedBy:actor.userId,adminType:actor.adminType,action:'CREATE',targetType:'ANNOUNCEMENT',targetId:doc._id,description:`Announcement published to ${students.length} recipients`,changes:{after:{title:doc.title,audience:doc.audience}}}],{session});
    });
    return doc;
  }finally{await session.endSession();}
}
async function withdraw(id,actor) {
  const session=await mongoose.startSession();let doc;
  try{
    await session.withTransaction(async()=>{
      owns(await Announcement.findById(id).session(session),actor);
      doc=await Announcement.findOneAndUpdate({_id:id,state:'published'},{$set:{state:'withdrawn',withdrawnAt:new Date()}},{new:true,session});
      if(!doc)throw new AppError('Only published announcements can be withdrawn',409);
      await Delivery.updateMany({announcement:id,state:{$in:['pending','processing']}},{$set:{state:'skipped',leaseUntil:null}},{session});
      await Audit.create([{performedBy:actor.userId,adminType:actor.adminType,action:'UPDATE',targetType:'ANNOUNCEMENT',targetId:id,description:'Announcement withdrawn; queued notifications cancelled'}],{session});
    });return doc;
  }finally{await session.endSession();}
}
const visibleQuery=()=>({state:'published',channel:{$ne:'feed'},$or:[{expiresAt:null},{expiresAt:{$gt:new Date()}}]});
async function studentList(student,page=1,role='student') {
  const active=await Announcement.find(visibleQuery()).select('_id');
  const query={student,recipientRole:{$in:role==='student'?['student',null]:[role]},announcement:{$in:active.map(a=>a._id)}};
  const [total,unread,data]=await Promise.all([Receipt.countDocuments(query),Receipt.countDocuments({...query,readAt:null}),Receipt.find(query).sort({createdAt:-1,_id:-1}).skip((page-1)*20).limit(20).populate('announcement','title body audience publishedAt expiresAt')]);
  return {data,unread,pagination:{page,total,pages:Math.max(1,Math.ceil(total/20))}};
}
async function read(id,student,role='student') {
  const announcement=await Announcement.findOne({_id:id,...visibleQuery()});
  if(!announcement)throw new AppError('Announcement unavailable',404);
  const receipt=await Receipt.findOneAndUpdate({announcement:id,student,recipientRole:{$in:role==='student'?['student',null]:[role]}},{$set:{readAt:new Date()}},{new:true});
  if(!receipt)throw new AppError('Announcement unavailable',404);
  return {announcement,readAt:receipt.readAt};
}
async function adminList(page=1,actor,channel) {
  const query={createdBy:actor.userId,channel:['staff','students'].includes(channel)?channel:{$ne:'feed'}};
  const [total,data]=await Promise.all([Announcement.countDocuments(query),Announcement.find(query).sort({createdAt:-1,_id:-1}).skip((page-1)*20).limit(20).lean()]);
  const groups=await Delivery.aggregate([{$match:{announcement:{$in:data.map(a=>a._id)}}},{$group:{_id:{announcement:'$announcement',state:'$state'},count:{$sum:1}}}]);
  for(const doc of data){doc.push={};for(const g of groups)if(String(g._id.announcement)===String(doc._id))doc.push[g._id.state]=g.count;}
  return {data,pagination:{page,total,pages:Math.max(1,Math.ceil(total/20))}};
}
module.exports={save,publish,withdraw,studentList,read,adminList,fields,audienceQuery,recipients,canPublish};
