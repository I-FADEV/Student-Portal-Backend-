const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const Admin = require("../models/admin.model");
const Student = require("../models/student.model");
const jwt = require("jsonwebtoken");
const logAction = require("../utils/logAction");
const AppError = require("../utils/appError");
const { getActiveSession } = require("./activeSession");
const { getActiveTemplateForStudent, applyTemplateToStudent } = require("./financeTemplate.service");

const registerAdmin = async ({
  username,
  password,
  adminType,
  performedBy,
  ipAddress,
}) => {
  const existingUser = await Admin.findOne({ username });
  if (existingUser) {
    throw new AppError("Username already in use", 409);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await Admin.create({
    username,
    password,
    role: "admin",
    adminType,
  });

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "ADMIN",
    targetId: newUser._id,
    description: `Admin ${username} was created as ${adminType}`,
    changes: {
      before: null,
      after: {
        username: newUser.username,
        role: newUser.role,
        adminType: newUser.adminType,
      },
    },
    ipAddress,
  });

  const token = generateToken(newUser._id, newUser.role, newUser.adminType);

  return {
    user: { id: newUser._id, username: newUser.username },
    token,
    role: newUser.role,
    type: newUser.adminType,
  };
};

const loginAdmin = async ({ username, password, ipAddress }) => {
  const user = await Admin.findOne({ username });
  if (!user) {
    throw new AppError("Invalid username or password", 400);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid username or password", 400);
  }

  await logAction({
    performedBy: user._id,
    action: "LOGIN",
    targetType: "ADMIN",
    targetId: user._id,
    description: `Admin ${user.username} logged in`,
    ipAddress,
  });

  const token = generateToken(user._id, user.role, user.adminType);
  return { token, admin: { _id: user._id, username: user.username, adminType: user.adminType } }
};

const registerStudent = async ({
  name,
  faculty,
  matricNumber,
  password,
  department,
  level,
}) => {
  if (!name || !matricNumber || !password || !department || !faculty || !level) {
    throw new AppError("fill all required fields", 400);
  }
  const normalizedName = name.trim();
  const normalizedMatric = matricNumber.toUpperCase();
  const normalizedDepartment = department.toUpperCase();
  const normalizedFaculty = faculty.toUpperCase();

  const existingUser = await Student.findOne({ matricNumber });
  if (existingUser) {
    throw new AppError("Matric number already in use", 409);
  }

  const newUser = await Student.create({
    name: normalizedName,
    faculty: normalizedFaculty,
    matricNumber: normalizedMatric,
    password,
    role: "student",
    department: normalizedDepartment,
    level,
  });

  // Auto-create finance record based on active template
  try {
    const activeSession = await getActiveSession();
    const template = await getActiveTemplateForStudent(newUser);
    
    if (template) {
      await applyTemplateToStudent(newUser, template, activeSession.session, activeSession.semester);
    }
  } catch (error) {
    // Don't fail registration if finance record creation fails
    console.error("Failed to auto-create finance record:", error.message);
  }

  const token = generateToken(newUser._id, newUser.role);

  return {
    user: {
      id: newUser._id,
      name: newUser.name,
      faculty: newUser.faculty,
      matricNumber: newUser.matricNumber,
      role: newUser.role,
      department: newUser.department,
      level: newUser.level,
    },
    token,
  };
};

const deleteStudentService = async ({ studentId, performedBy, ipAddress }) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new AppError("Student not found", 404);
  }

  // Delete all related records in parallel
  const IdCard = require("../models/idcard.model");
  const Finance = require("../models/finance.model");
  const Result = require("../models/result.model");

  await Promise.all([
    Student.findByIdAndDelete(studentId),
    IdCard.deleteMany({ student: studentId }),
    Finance.deleteMany({ student: studentId }),
    Result.deleteMany({ student: studentId }),
  ]);

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "STUDENT",
    targetId: studentId,
    affectedStudent: studentId,
    description: `Student ${student.name} (${student.matricNumber}) and all related records deleted by registry admin`,
    changes: {
      before: {
        name: student.name,
        matricNumber: student.matricNumber,
        department: student.department,
        level: student.level,
      },
      after: null,
    },
    ipAddress,
  });

  return { message: "Student deleted successfully" };
};

// NOTE: Student login logging is skipped — logAction requires performedBy to be
// an Admin ObjectId (see auditLog model). Students logging themselves in don't
// fit that shape. If you want to track student logins later, you'd need a
// separate StudentAuditLog model or relax the ref on performedBy.
const loginStudent = async ({ matricNumber, password }) => {
  const user = await Student.findOne({ matricNumber });
  if (!user) {
    throw new AppError("Invalid matric number or password", 400);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid matric number or password", 400);
  }

  const token = generateToken(user._id, user.role);
  return { token };
};

const refreshToken = async ({ oldToken }) => {
  if (!oldToken) {
    throw new AppError("No token provided,", 400);
  }

  try {
    const decoded = jwt.verify(oldToken, process.env.JWT_SECRET);
    const newToken = generateToken(decoded.userId, decoded.role);
    return { token: newToken };
  } catch (err) {
    throw new AppError("Invalid or expired token", 400);
  }
};

const changeAdminPasswordService = async ({
  adminId, // ← fixed: was "AdminId" (capital A) — that was a bug
  currentPassword,
  newPassword,
  performedBy,
  ipAddress,
}) => {
  if (!currentPassword || !newPassword) {
    throw new Error("Both passwords are required");
  }

  const admin = await Admin.findById(adminId);

  if (!admin) {
    throw new Error("User not found");
  }

  // 1. Verify current password
  const isMatch = await bcrypt.compare(currentPassword, admin.password);
  if (!isMatch) {
    throw new Error("Current password is incorrect");
  }

  // 2. Prevent same password reuse
  const samePassword = await bcrypt.compare(newPassword, admin.password);
  if (samePassword) {
    throw new Error("New password must be different");
  }

  // 3. Update password
  admin.password = newPassword;
  await admin.save();

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "ADMIN",
    targetId: admin._id,
    description: `Admin ${admin.username} changed their password`,
    ipAddress,
  });

  return { message: "Password changed successfully" };
};

module.exports = {
  registerAdmin,
  loginAdmin,
  registerStudent,
  deleteStudentService,
  loginStudent,
  refreshToken,
  changeAdminPasswordService,
};
