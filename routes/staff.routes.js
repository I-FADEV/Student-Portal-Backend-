const router=require('express').Router();
const Staff=require('../models/staff.model');
const Course=require('../models/timetableCourse.model');
const protect=require('../middleware/auth.middleware');
const roles=require('../middleware/roleCheck.middleware');
const AppError=require('../utils/appError');
const bcrypt=require('bcryptjs');
const token=(userId,role,adminType,tokenVersion)=>require('jsonwebtoken').sign({userId,role,adminType,tokenVersion,jti:require('node:crypto').randomUUID()},process.env.JWT_SECRET,{expiresIn:'1d',algorithm:'HS256'});
const Audit=require('../models/auditLog.model');
const wrap=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){next(e)}};
const academic=roles(['admin'],['timetable_admin']);
function password(value){if(typeof value!=='string'||value.length<10||Buffer.byteLength(value)>72)throw new AppError('Password must contain at least 10 characters and no more than 72 bytes',400);return value}
function details(input){
 const name=String(input.name||'').trim(),role=input.role;
 if(name.length<2||name.length>100||!['lecturer','invigilator'].includes(role))throw new AppError('Enter a valid name and staff role',400);
 const phone=String(input.phone||'').replace(/[\s()-]/g,'');
 if(role==='lecturer'&&!/^\+?\d{7,15}$/.test(phone))throw new AppError('Enter a valid lecturer phone number, including country code',400);
 const username=role==='lecturer'?phone:String(input.username||'').trim();
 if(username.length<3||username.length>50)throw new AppError('Username must contain 3 to 50 characters',400);
 return {name,role,phone:role==='lecturer'?phone:undefined,username};
}
router.post('/login',require('../config/rateLimiter').authLimiter,wrap(async(req,res)=>{
 const username=String(req.body.username||'').trim();
 const user=await Staff.findOne({$or:[{username,role:'invigilator'},{username:username.replace(/[\s()-]/g,''),role:'lecturer'}],status:'active'}).select('+password');
 if(!user||typeof req.body.password!=='string'||!await bcrypt.compare(req.body.password,user.password))throw new AppError('Invalid login details',401);
 res.json({token:token(user.id,user.role,null,user.tokenVersion),user:{id:user.id,name:user.name,role:user.role,mustChangePassword:user.mustChangePassword}});
}));
router.use(protect);
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next()});
router.get('/me',roles(['lecturer','invigilator']),wrap(async(req,res)=>res.json({data:req.account})));
router.post('/logout',roles(['lecturer','invigilator']),wrap(async(req,res)=>{
 if(req.user.role==='invigilator'){
  const raw=req.headers.authorization.slice(7),digest=require('node:crypto').createHash('sha256').update(raw).digest('hex');
  await require('../models/revokedStaffToken.model').updateOne({digest},{$setOnInsert:{digest,expiresAt:new Date(require('jsonwebtoken').decode(raw).exp*1000)}},{upsert:true});
 }else await Staff.updateOne({_id:req.user.userId},{$inc:{tokenVersion:1}});
 res.json({message:'Signed out'});
}));
router.put('/password',roles(['lecturer']),wrap(async(req,res)=>{
 const account=await Staff.findById(req.user.userId).select('+password');
 const next=password(req.body.newPassword);
 if(next!==req.body.confirmPassword||typeof req.body.currentPassword!=='string'||!await bcrypt.compare(req.body.currentPassword,account.password))throw new AppError('Check current password and confirmation',400);
 if(await bcrypt.compare(next,account.password))throw new AppError('Choose a different password',400);
 account.password=next;account.mustChangePassword=false;await account.save();res.json({message:'Password changed. Sign in again.'});
}));
router.get('/',academic,wrap(async(req,res)=>res.json({data:await Staff.find().sort({name:1})})));
router.post('/',academic,wrap(async(req,res)=>{
 const data=details(req.body),doc=await Staff.create({...data,password:password(req.body.password),mustChangePassword:data.role==='lecturer',createdBy:req.user.userId});
 await Audit.create({performedBy:req.user.userId,adminType:req.user.adminType,action:'CREATE',targetType:'STAFF',targetId:doc.id,description:`Created ${doc.role} account`});
 const out=doc.toObject();delete out.password;res.status(201).json({data:out});
}));
router.put('/:id',academic,wrap(async(req,res)=>{
 const account=await Staff.findById(req.params.id);if(!account)throw new AppError('Staff account not found',404);
 const data=details({...req.body,role:account.role});Object.assign(account,data);
 if(req.body.status!==undefined){if(!['active','archived'].includes(req.body.status))throw new AppError('Invalid status',400);account.status=req.body.status}
 if(req.body.password){account.password=password(req.body.password);account.mustChangePassword=account.role==='lecturer'}
 else account.tokenVersion++;
 await account.save();await Audit.create({performedBy:req.user.userId,adminType:req.user.adminType,action:'UPDATE',targetType:'STAFF',targetId:account.id,description:'Updated staff credentials/profile; previous sessions revoked'});
 const out=account.toObject();delete out.password;res.json({data:out});
}));
router.put('/assign/:courseId',academic,wrap(async(req,res)=>{
 const lecturer=await Staff.findOne({_id:req.body.lecturerId,role:'lecturer',status:'active'});if(!lecturer)throw new AppError('Choose an active lecturer',400);
 const course=await Course.findById(req.params.courseId);if(!course)throw new AppError('Course not found',404);
 course.lecturerId=lecturer.id;course.lecturer=lecturer.name;course.lecturerPhone=lecturer.phone;await course.save();
 await Audit.create({performedBy:req.user.userId,adminType:req.user.adminType,action:'UPDATE',targetType:'COURSE',targetId:course.id,description:`Assigned course to lecturer ${lecturer.name}`});res.json({data:course});
}));
module.exports=router;
