const mongoose=require('mongoose');
const actor={author:{type:mongoose.Schema.Types.ObjectId,required:true},authorRole:{type:String,enum:['student','admin','lecturer'],required:true},authorName:{type:String,required:true}};
const post=new mongoose.Schema({...actor,body:{type:String,maxlength:5000,default:''},images:[String],deletedAt:{type:Date,default:null},notification:{type:mongoose.Schema.Types.ObjectId,ref:'Announcement'}},{timestamps:true});
post.index({deletedAt:1,createdAt:-1});
const comment=new mongoose.Schema({...actor,post:{type:mongoose.Schema.Types.ObjectId,ref:'FeedPost',required:true},body:{type:String,maxlength:3000,required:true},deletedAt:{type:Date,default:null}},{timestamps:true});
comment.index({post:1,createdAt:1});
const like=new mongoose.Schema({post:{type:mongoose.Schema.Types.ObjectId,ref:'FeedPost',required:true},account:{type:mongoose.Schema.Types.ObjectId,required:true}},{timestamps:true});
like.index({post:1,account:1},{unique:true});
module.exports={FeedPost:mongoose.model('FeedPost',post),FeedComment:mongoose.model('FeedComment',comment),FeedLike:mongoose.model('FeedLike',like)};
