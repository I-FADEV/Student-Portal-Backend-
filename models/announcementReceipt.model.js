const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  announcement:{type:mongoose.Schema.Types.ObjectId,ref:'Announcement',required:true},
  student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},
  recipientRole:{type:String,enum:['student','admin','lecturer'],default:'student'},
  readAt:{type:Date,default:null},
},{timestamps:true});
schema.index({announcement:1,student:1},{unique:true});
schema.index({student:1,createdAt:-1});
module.exports=mongoose.model('AnnouncementReceipt',schema);
