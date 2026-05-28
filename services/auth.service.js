const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const Admin = require("../models/admin.model");
const Student = require("../models/student.model");
const jwt = require("jsonwebtoken");
const logAction = require("../utils/logAction");
const AppError = require("../utils/appError");

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
    password: hashedPassword,
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
  return { token };
};

const registerStudent = async ({
  matricNumber,
  password,
  department,
  level,
}) => {
  if (!matricNumber || !password || !department || !level) {
    throw new AppError("fill all required fields", 400);
  }

  const normalizedMatric = matricNumber.toUpperCase();
  const normalizedDepartment = department.toUpperCase();

  const existingUser = await Student.findOne({ matricNumber });
  if (existingUser) {
    throw new AppError("Matric number already in use", 409);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await Student.create({
    matricNumber: normalizedMatric,
    password: hashedPassword,
    role: "student",
    department: normalizedDepartment,
    level,
  });

  const token = generateToken(newUser._id, newUser.role);

  return {
    user: {
      id: newUser._id,
      matricNumber: newUser.matricNumber,
      role: newUser.role,
      department: newUser.department,
      level: newUser.level,
    },
    token,
  };
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

module.exports = {
  registerAdmin,
  loginAdmin,
  registerStudent,
  loginStudent,
  refreshToken,
};
