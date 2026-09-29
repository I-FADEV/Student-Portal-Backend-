const mongoose=require('mongoose');
const Department=require('../models/department.model');
const Faculty=require('../models/faculty.model');
const AppError=require('../utils/appError');
const logAction=require('../utils/logAction');
const {caseInsensitiveExact}=require('../utils/studentCourseResolver');
module.exports=async({deptId,name,facultyId,minLevel,maxLevel,abbreviation,performedBy,ipAddress})=>{
 const transaction=await mongoose.startSession();let updated,before;
 try{await transaction.withTransaction(async()=>{
  const dept=await Department.findById(deptId).session(transaction);
  if(!dept) throw new AppError('Department not found',404);
  before=dept.toObject();const oldName=dept.name;
  const faculty=await Faculty.findById(facultyId||dept.faculty).session(transaction);
  if(!faculty) throw new AppError('Faculty not found',400);
  dept.name=String(name||dept.name).trim();dept.faculty=faculty.id;
  dept.minLevel=Number(minLevel??dept.minLevel);dept.maxLevel=Number(maxLevel??dept.maxLevel);
  dept.abbreviation=String(abbreviation||dept.abbreviation).trim().toUpperCase();
  if(dept.minLevel>=dept.maxLevel || dept.minLevel%100 || dept.maxLevel%100 || !/^[A-Z]{3,5}$/.test(dept.abbreviation)) throw new AppError('Use valid levels and a 3–5 letter abbreviation',400);
  await dept.save({session:transaction});
  const match=caseInsensitiveExact(oldName),newName=dept.name.toUpperCase();
  await require('../models/student.model').updateMany({department:match},{$set:{department:newName,faculty:faculty.name.toUpperCase()}},{session:transaction});
  for(const model of ['timetable','course','financeTemplate','enrollment']) await require(`../models/${model}.model`).updateMany({department:match},{$set:{department:newName}},{session:transaction});
  await require('../models/timetableCourse.model').updateMany({'targets.type':'department','targets.name':match},{$set:{'targets.$[target].name':dept.name}},{arrayFilters:[{'target.type':'department','target.name':match}],session:transaction});
  updated=dept;
 });}finally{await transaction.endSession();}
 await logAction({performedBy,ipAddress,action:'UPDATE',targetType:'DEPARTMENT',targetId:deptId,description:'Department and linked records updated',changes:{before,after:updated.toObject()}});
 return {data:await Department.findById(deptId).populate('faculty','name')};
};
