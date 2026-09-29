const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const schema=new mongoose.Schema({
 name:{type:String,required:true,trim:true,maxlength:100},
 phone:{type:String,trim:true},
 username:{type:String,required:true,unique:true,trim:true},
 role:{type:String,enum:['lecturer','invigilator'],required:true},
 password:{type:String,required:true,select:false},
 mustChangePassword:{type:Boolean,default:true},
 status:{type:String,enum:['active','archived'],default:'active'},
 tokenVersion:{type:Number,default:0},
 createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'Admin',required:true},
},{timestamps:true});
schema.index({role:1},{unique:true,partialFilterExpression:{role:'invigilator'}});
schema.pre('save',async function(){if(this.isModified('password')){if(!this.isNew)this.tokenVersion++;this.password=await bcrypt.hash(this.password,10)}});
module.exports=mongoose.model('Staff',schema);
