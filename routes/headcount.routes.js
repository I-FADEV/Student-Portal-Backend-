const router=require('express').Router(),mongoose=require('mongoose');
const {Headcount,HeadcountEntry}=require('../models/headcount.model');
const Student=require('../models/student.model'),Card=require('../models/idcard.model'),Audit=require('../models/auditLog.model');
const AppError=require('../utils/appError');
const biometric=require('../services/biometric.service');
const wrap=fn=>async(req,res,next)=>{try{await fn(req,res)}catch(e){next(e)}};
router.use(require('../middleware/auth.middleware'),require('../middleware/roleCheck.middleware')(['admin'],['student_officer']));
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next()});
router.get('/scanner',(req,res)=>res.json(biometric.status()));
router.post('/enroll/:studentId',wrap(async(req,res)=>res.json(await biometric.enroll(req.params.studentId))));
router.get('/students',wrap(async(req,res)=>{
 const q=String(req.query.q||'').trim().slice(0,100),filter={status:{$nin:['archived','graduated']}};
 if(q){const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=[{name:{$regex:escaped,$options:'i'}},{matricNumber:{$regex:escaped,$options:'i'}}]}
 if(req.query.department)filter.department=require('../utils/studentCourseResolver').caseInsensitiveExact(req.query.department);
 if(req.query.level)filter.level=Number(req.query.level);
 const page=Math.max(1,parseInt(req.query.page)||1),data=await Student.find(filter).select('name matricNumber department faculty level').sort({name:1}).skip((page-1)*30).limit(30).lean();
 const cards=await Card.find({student:{$in:data.map(s=>s._id)}}).select('student photoURL');
 for(const student of data){student.photoURL=cards.find(c=>String(c.student)===String(student._id))?.photoURL||null;student.fingerprintStatus='not_enrolled'}
 res.json({data,total:await Student.countDocuments(filter),page});
}));
router.get('/',wrap(async(req,res)=>res.json({data:await Headcount.find().sort({createdAt:-1}).limit(100)})));
router.post('/',wrap(async(req,res)=>{const title=String(req.body.title||'').trim();if(!title||title.length>140)throw new AppError('Enter a headcount title',400);res.status(201).json({data:await Headcount.create({title,createdBy:req.user.userId})})}));
router.get('/:id',wrap(async(req,res)=>{
 const headcount=await Headcount.findById(req.params.id);if(!headcount)throw new AppError('Headcount not found',404);
 const counts=await HeadcountEntry.aggregate([{$match:{headcount:headcount._id}},{$group:{_id:{department:'$department',level:'$level',method:'$method'},count:{$sum:1}}}]);
 res.json({data:headcount,counts,total:counts.reduce((sum,r)=>sum+r.count,0),entries:await HeadcountEntry.find({headcount:headcount.id}).sort({createdAt:-1}).limit(100).populate('student','name matricNumber')});
}));
router.post('/:id/close',wrap(async(req,res)=>{const data=await Headcount.findOneAndUpdate({_id:req.params.id,state:'open'},{$set:{state:'closed',closedAt:new Date()}},{new:true});if(!data)throw new AppError('Open headcount not found',404);res.json({data})}));
router.post('/:id/record',wrap(async(req,res)=>{
 const reason=String(req.body.reason||'').trim();if(reason.length<10||reason.length>1000)throw new AppError('Record a reason of 10–1000 characters for this non-biometric confirmation',400);
 const session=await mongoose.startSession();let data;
 try{await session.withTransaction(async()=>{
 const count=await Headcount.findOneAndUpdate({_id:req.params.id,state:'open'},{$inc:{revision:1}},{session,new:true});if(!count)throw new AppError('This headcount is closed or unavailable',409);
 const student=await Student.findOne({_id:req.body.studentId,status:{$nin:['archived','graduated']}}).session(session);if(!student)throw new AppError('Active student not found',404);
 data=await HeadcountEntry.findOne({headcount:count.id,student:student.id}).session(session);if(data)return;
 [data]=await HeadcountEntry.create([{headcount:count.id,student:student.id,department:student.department,level:student.level,method:'officer_confirmation',reason,recordedBy:req.user.userId}],{session});
 await Audit.create([{performedBy:req.user.userId,adminType:req.user.adminType,action:'CREATE',targetType:'HEADCOUNT',targetId:count.id,affectedStudent:student.id,description:'Headcount: documented officer confirmation, not biometric',changes:{after:{reason}}}],{session});
 });res.status(201).json({data})}finally{await session.endSession()}
}));
module.exports=router;
