const mongoose=require('mongoose');
const schema=new mongoose.Schema({revision:{type:Number,default:0},title:{type:String,required:true,maxlength:140},state:{type:String,enum:['open','closed'],default:'open'},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',required:true},closedAt:Date},{timestamps:true});
const entry=new mongoose.Schema({headcount:{type:mongoose.Schema.Types.ObjectId,ref:'Headcount',required:true},student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},department:String,level:Number,method:{type:String,enum:['fingerprint','officer_confirmation'],required:true},reason:{type:String,required:true,maxlength:1000},recordedBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',required:true}},{timestamps:true});
entry.index({headcount:1,student:1},{unique:true});
module.exports={Headcount:mongoose.model('Headcount',schema),HeadcountEntry:mongoose.model('HeadcountEntry',entry)};
