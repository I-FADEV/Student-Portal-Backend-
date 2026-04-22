const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const Admin = require("../models/admin.model");
const Student = require("../models/student.model");
const jwt = require("jsonwebtoken");
const logAction = require("../utils/logAction");
const AppError = require("../utils/appError");

const registerAdmin = async ({ username, password, adminType }) => {
  // 2. Check if user already exists
  const existingUser = await Admin.findOne({ username });
  if (existingUser) {
    throw new AppError("Username already in use", 409);
  }

  // 3. Hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 4. Save new user with hashed password
  const newUser = await Admin.create({
    username,
    password: hashedPassword,
    role: "admin",
    adminType,
  });

  // await logAction({});

  //  Create a JWT token
  const token = generateToken(newUser._id, newUser.role, newUser.adminType);

  return {
    user: { id: newUser._id, username: newUser.username },
    token,
    role: newUser.role,
    type: newUser.adminType,
  };
};

const loginAdmin = async ({ username, password }) => {
  // 2. Find the user by username
  const user = await Admin.findOne({ username });
  if (!user) {
    throw new AppError("Invalid username or password", 400);
  }

  // 3. Compare the given password with the stored hash
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid username or password", 400);
  }

  // logAction({});

  // 4. Create a JWT token
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

  //  await logAction({});

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

const loginStudent = async ({ matricNumber, password }) => {
  const user = await Student.findOne({ matricNumber });
  if (!user) {
    throw new AppError("Invalid matric number or password", 400);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid matric number or password", 400);
  }

  // await logAction({});

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
