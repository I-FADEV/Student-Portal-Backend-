const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true,index:true},
  recipientRole:{type:String,enum:['student','admin','lecturer'],default:'student'},
  endpoint:{type:String,required:true,unique:true},
  keys:{p256dh:{type:String,required:true},auth:{type:String,required:true}},
  tokenVersion:{type:Number,required:true},
  active:{type:Boolean,default:true},
  vapidPublicKey:{type:String,required:true},
},{timestamps:true});
module.exports=mongoose.model('PushSubscription',schema);
