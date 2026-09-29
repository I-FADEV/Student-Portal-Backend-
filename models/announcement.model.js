const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  title: {type:String,required:true,maxlength:140,trim:true},
  body: {type:String,required:true,maxlength:10000,trim:true},
  channel: {type:String,enum:['students','staff','feed'],default:'students'},
  feedPost: {type:mongoose.Schema.Types.ObjectId,ref:'FeedPost',default:null},
  audience: {
    kind: {type:String,enum:['all','faculty','department','admins','lecturers','selected_staff'],default:'all'},
    targetId: {type:mongoose.Schema.Types.ObjectId,default:null},
    targetIds: [{type:mongoose.Schema.Types.ObjectId}],
    label: {type:String,default:'All students'},
    levels: [{type:Number}],
  },
  state: {type:String,enum:['draft','published','withdrawn'],default:'draft'},
  createdBy: {type:mongoose.Schema.Types.ObjectId,ref:'Admin',required:true},
  publishedAt: Date,
  expiresAt: {type:Date,default:null},
  recipientCount: {type:Number,default:0},
  pushRequested: {type:Boolean,default:true},
  withdrawnAt: Date,
}, {timestamps:true,optimisticConcurrency:true});
schema.index({state:1,publishedAt:-1});
module.exports=mongoose.model('Announcement',schema);
