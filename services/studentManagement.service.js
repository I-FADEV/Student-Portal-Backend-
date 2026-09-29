const Student = require('../models/student.model');
const Department = require('../models/department.model');
const Enrollment = require('../models/enrollment.model');
const AppError = require('../utils/appError');
const logAction = require('../utils/logAction');
async function snapshot(student) {
  const active = await require('./session.service').current(true);
  if (!active) return;
  return Enrollment.findOneAndUpdate({student:student.id,session:active.session,semester:active.semester},{$setOnInsert:{department:student.department,faculty:student.faculty,level:student.level}},{upsert:true,new:true,setDefaultsOnInsert:true});
}
async function update(id, input, actor, ipAddress) {
  const student=await Student.findById(id);
  if(!student) throw new AppError('Student not found',404);
  const department=await Department.findById(input.departmentId).populate('faculty');
  if(!department) throw new AppError('Choose a valid department',400);
  const level=Number(input.level);
  if(!Number.isInteger(level) || level%100 || level<department.minLevel || level>department.maxLevel) throw new AppError('Invalid level for this department',400);
  const name=String(input.name || '').trim();
  if(name.length<5 || name.length>100) throw new AppError('Name must contain 5 to 100 characters',400);
  if(!['active','graduated','archived'].includes(input.status)) throw new AppError('Invalid student status',400);
  const before=student.toObject();
  await snapshot(student);
  student.name=name;student.department=department.name.toUpperCase();student.faculty=department.faculty.name.toUpperCase();student.level=level;student.status=input.status;
  if(before.status!==input.status) student.tokenVersion=(student.tokenVersion||0)+1;
  await student.save();
  // Historical enrollments remain unchanged; changes affect new semester enrollments.
  await logAction({performedBy:actor.userId,ipAddress,action:'UPDATE',targetType:'STUDENT',targetId:id,affectedStudent:id,description:'Student profile/lifecycle updated; previous enrollments retained',changes:{before,after:student.toObject()}});
  return student;
}
module.exports={snapshot,update};
