const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const Admin = require("../models/admin.model");
const Student = require("../models/student.model");
const jwt = require("jsonwebtoken");
const logAction = require("../utils/logAction");

const registerAdmin = async ({ username, password }) => {
  // 2. Check if user already exists
  const existingUser = await Admin.findOne({ username });
  if (existingUser) {
    throw new Error("Username already in use");
  }

  // 3. Hash the password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 4. Save new user with hashed password
  const newUser = await Admin.create({
    username,
    password: hashedPassword,
    role: "admin",
  });

  // await logAction({});

  //  Create a JWT token
  const token = generateToken(newUser._id, newUser.role);

  return {
    user: { id: newUser._id, username: newUser.username },
    token,
    role: newUser.role,
  };
};

const loginAdmin = async ({ username, password }) => {
  // 2. Find the user by username
  const user = await Admin.findOne({ username });
  if (!user) {
    throw new Error("Invalid username or password");
  }

  // 3. Compare the given password with the stored hash
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid username or password");
  }

  // logAction({});

  // 4. Create a JWT token
  const token = generateToken(user._id, user.role);

  return { token };
};

const registerStudent = async ({ matricNumber, password }) => {
  if (!matricNumber || !password) {
    throw new Error("Matric number and password are required");
  }

  const normalizedMatric = matricNumber.toUpperCase();

  const existingUser = await Student.findOne({ matricNumber });
  if (existingUser) {
    throw new Error("Matric number already in use");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await Student.create({
    matricNumber: normalizedMatric,
    password: hashedPassword,
    role: "student",
  });

  //  await logAction({});

  const token = generateToken(newUser._id, newUser.role);

  return {
    user: {
      id: newUser._id,
      matricNumber: newUser.matricNumber,
      role: newUser.role,
    },
    token,
  };
};

const loginStudent = async ({ matricNumber, password }) => {
  const user = await Student.findOne({ matricNumber });
  if (!user) {
    throw new Error("Invalid matric number or password");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid matric number or password");
  }

  // await logAction({});

  const token = generateToken(user._id, user.role);

  return { token };
};

const refreshToken = async ({ oldToken }) => {
  if (!oldToken) {
    throw new Error("No token provided");
  }

  try {
    const decoded = jwt.verify(oldToken, process.env.JWT_SECRET);

    const newToken = generateToken(decoded.userId, decoded.role);

    return { token: newToken };
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  registerStudent,
  loginStudent,
  refreshToken,
};
