const router=require('express').Router();
const protect=require('../middleware/auth.middleware');
const roles=require('../middleware/roleCheck.middleware');
const bcrypt=require('bcryptjs');
const AppError=require('../utils/appError');
const Student=require('../models/student.model');
router.put('/password',protect,roles(['student']),async(req,res,next)=>{
 try {
  const {currentPassword,newPassword,confirmPassword}=req.body;
  if(typeof newPassword!=='string'||newPassword.length<8||newPassword!==confirmPassword) throw new AppError('Passwords must match and contain at least 8 characters',400);
  const student=await Student.findById(req.user.userId).select('+password');
  if(typeof currentPassword!=='string'||!await bcrypt.compare(currentPassword,student.password)) throw new AppError('Current password is incorrect',400);
  if(await bcrypt.compare(newPassword,student.password)) throw new AppError('Choose a different password',400);
  student.password=newPassword;await student.save();res.json({message:'Password changed. Sign in with your new password.'});
 } catch(e){next(e)}
});
router.put('/:id',protect,roles(['admin'],['idcard_admin']),async(req,res,next)=>{
 try{res.json({data:await require('../services/studentManagement.service').update(req.params.id,req.body,req.user,req.ip)})}catch(e){next(e)}
});
module.exports=router;
