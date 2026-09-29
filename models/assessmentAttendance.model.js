const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 assessment:{type:mongoose.Schema.Types.ObjectId,ref:'Assessment',required:true},student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},
 status:{type:String,enum:['pending_exception','rejected_exception','present'],required:true},method:{type:String,enum:['fingerprint','exception'],required:true},
 operator:{type:mongoose.Schema.Types.ObjectId,ref:'Staff'},station:{type:String,maxlength:80,required:true},
 reason:{type:String,maxlength:1000},approvedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin'},approvedAt:Date,checkedInAt:Date,
},{timestamps:true});
schema.index({assessment:1,student:1},{unique:true});
module.exports=mongoose.model('AssessmentAttendance',schema);
