const mongoose=require('mongoose');
const roster=new mongoose.Schema({student:{type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},name:String,matricNumber:String,department:String,level:Number},{_id:false});
const schema=new mongoose.Schema({
 course:{type:mongoose.Schema.Types.ObjectId,ref:'TimetableCourse',required:true},
 courseCode:String,courseName:String,session:String,semester:String,lecturer:{type:mongoose.Schema.Types.ObjectId,ref:'Staff'},
 kind:{type:String,enum:['test','exam'],required:true},
 startAt:{type:Date,required:true},endAt:{type:Date,required:true},
 venue:{type:String,required:true},capacity:{type:Number,required:true,min:1},
 state:{type:String,enum:['published','closed','cancelled'],default:'published'},
 openedAt:{type:Date,default:null},closedAt:{type:Date,default:null},
 roster:[roster],revision:{type:Number,default:0},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin'},
},{timestamps:true,optimisticConcurrency:true});
schema.index({course:1,kind:1},{unique:true,partialFilterExpression:{state:{$in:['published','closed']}}});
schema.index({state:1,startAt:1,endAt:1});
module.exports=mongoose.model('Assessment',schema);
