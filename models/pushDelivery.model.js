const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  announcement:{type:mongoose.Schema.Types.ObjectId,ref:'Announcement',required:true},
  subscription:{type:mongoose.Schema.Types.ObjectId,ref:'PushSubscription',required:true},
  student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},
  recipientRole:{type:String,enum:['student','admin','lecturer'],default:'student'},
  state:{type:String,enum:['pending','processing','accepted','failed','skipped'],default:'pending'},
  attempts:{type:Number,default:0},
  nextAttempt:{type:Date,default:Date.now},
  leaseUntil:{type:Date,default:null},
  lastStatus:Number,
},{timestamps:true});
schema.index({announcement:1,subscription:1},{unique:true});
schema.index({state:1,nextAttempt:1,leaseUntil:1});
module.exports=mongoose.model('PushDelivery',schema);
