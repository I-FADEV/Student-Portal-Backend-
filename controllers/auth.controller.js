const {
  registerAdmin,
  loginAdmin,
  registerStudent,
  loginStudent,
  refreshToken,
  changeAdminPasswordService,
} = require("../services/auth.service");

const Student = require("../models/student.model");
const logAction = require("../utils/logAction");

// ── ADMIN REGISTER (GA only) ──────────────────────────────────────────────────
const adminRegister = async (req, res, next) => {
  try {
    const { username, password, adminType } = req.body;

    const { user, token, role, type } = await registerAdmin({
      username,
      password,
      adminType,
      performedBy: req.user.userId, // logAction happens inside service
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: "Account created successfully!",
      user,
      token,
      role,
      type,
    });
  } catch (error) {
    next(error);
  }
};

// ── ADMIN LOGIN ────────────────────────────────────────────────────────────────
const adminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const { token, admin } = await loginAdmin({ username, password, ipAddress: req.ip });
    res.status(200).json({ message: "Login successful", token, admin });
  } catch (error) {
    next(error);
  }
};

// ── CHANGE ADMIN PASSWORD ──────────────────────────────────────────────────────
// logAction is already called inside changeAdminPasswordService — don't call it here
const changeAdminPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    const { message } = await changeAdminPasswordService({
      adminId: req.user.userId,
      currentPassword,
      newPassword,
      confirmPassword,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

// ── STUDENT REGISTER (TAC admin registers student) ────────────────────────────
const studentRegister = async (req, res, next) => {
  try {
    const { matricNumber, password, department, level, name, faculty } = req.body;

    const { user, token } = await registerStudent({
      matricNumber, password, department, level, name, faculty,
    });

    // ✅ Log the registration action
    await logAction({
      performedBy:     req.user.userId,
      action:          "CREATE",
      targetType:      "STUDENT",
      targetId:        user._id,
      affectedStudent: user._id,
      description:     `Student registered by TAC admin — ${name} (${matricNumber})`,
      changes: {
        before: null,
        after:  { matricNumber, name, department, level, faculty },
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: "Account created successfully!",
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
};

// ── STUDENT LOGIN ──────────────────────────────────────────────────────────────
const studentLogin = async (req, res, next) => {
  try {
    const { matricNumber, password } = req.body;
    const { token } = await loginStudent({ matricNumber, password });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    next(error);
  }
};

// ── REFRESH TOKEN ──────────────────────────────────────────────────────────────
const refresh = async (req, res, next) => {
  try {
    const { oldToken } = req.body;
    const { token } = await refreshToken({ oldToken });
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
};

// ── TAC ADMIN: GET ALL STUDENTS (list + search) ───────────────────────────────
const getAllStudents = async (req, res, next) => {
  try {
    const { query } = req.query;
    let filter = {};
    if (query) {
      const regex = new RegExp(query, "i");
      filter = { $or: [{ name: regex }, { matricNumber: regex }] };
    }
    const students = await Student.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });
    res.status(200).json({ data: students });
  } catch (error) {
    next(error);
  }
};

// ── TAC ADMIN: RESET STUDENT PASSWORD ────────────────────────────────────────
const resetStudentPassword = async (req, res, next) => {
  try {
    const { studentId, newPassword } = req.body;

    if (!studentId || !newPassword) {
      return res.status(400).json({ error: "studentId and newPassword are required" });
    }

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    student.password = newPassword;
    await student.save();

    await logAction({
      performedBy:     req.user.userId,
      action:          "UPDATE",
      targetType:      "STUDENT",        // ✅ fixed from "ADMIN"
      targetId:        student._id,
      affectedStudent: student._id,
      description:     `Password reset for student ${student.name || student.matricNumber} by TAC admin`,
      changes: {
        before: { password: "[hidden]" },
        after:  { password: "[reset]"  },
      },
      ipAddress: req.ip,
    });

    res.status(200).json({ message: "Student password reset successfully" });
  } catch (error) {
    next(error);
  }
};

// ── FINANCE ADMIN: SEARCH STUDENTS (by name or matric) ───────────────────────
const searchStudents = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(200).json({ data: [] });

    const regex = new RegExp(query, "i");
    const students = await Student.find({
      $or: [{ name: regex }, { matricNumber: regex }],
    })
      .select("_id name matricNumber department level faculty")
      .limit(10);

    res.status(200).json({ data: students });
  } catch (error) {
    next(error);
  }
};

// ── FINANCE ADMIN: FILTER STUDENTS (by dept/level/faculty for bulk) ───────────
const filterStudents = async (req, res, next) => {
  try {
    const { department, level, faculty } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (level)      filter.level      = Number(level);
    if (faculty)    filter.faculty    = faculty;

    const students = await Student.find(filter)
      .select("_id name matricNumber department level faculty");

    res.status(200).json({ data: students });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminRegister,
  adminLogin,
  studentRegister,
  studentLogin,
  refresh,
  changeAdminPassword,
  getAllStudents,
  resetStudentPassword,
  searchStudents,
  filterStudents,
};