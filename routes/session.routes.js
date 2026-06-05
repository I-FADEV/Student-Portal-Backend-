const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const Student = require("../models/student.model");
const Admin = require("../models/admin.model");
const AuditLog = require("../models/auditLog.model");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const AppError = require("../utils/appError");

// POST /session/create - create a new session (login)
router.post("/create", async (req, res, next) => {
  try {
    const { matricNumber, username, password, role } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    if (role === "student" && matricNumber) {
      const student = await Student.findOne({ matricNumber: matricNumber.toUpperCase() });
      if (!student) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, student.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const token = generateToken(student._id, student.role);

      return res.status(200).json({
        token,
        user: {
          id: student._id,
          name: student.name,
          matricNumber: student.matricNumber,
          role: student.role,
          department: student.department,
          faculty: student.faculty,
          level: student.level,
        },
      });
    } else if (role === "admin" && username) {
      const admin = await Admin.findOne({ username });
      if (!admin) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const token = generateToken(admin._id, admin.role, admin.adminType);

      return res.status(200).json({
        token,
        user: {
          id: admin._id,
          username: admin.username,
          role: admin.role,
          adminType: admin.adminType,
        },
      });
    }

    res.status(400).json({ error: "Invalid session creation request" });
  } catch (error) {
    next(error);
  }
});

// GET /session/active - check if user session is active
router.get("/active", protect, async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    
    let user;
    if (role === "student") {
      user = await Student.findById(userId).select("-password");
    } else if (role === "admin") {
      user = await Admin.findById(userId).select("-password");
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      active: true,
      user: {
        id: user._id,
        role: user.role,
        ...(user.adminType && { adminType: user.adminType }),
        ...(user.username && { username: user.username }),
        ...(user.name && { name: user.name }),
        ...(user.matricNumber && { matricNumber: user.matricNumber }),
        ...(user.department && { department: user.department }),
        ...(user.faculty && { faculty: user.faculty }),
        ...(user.level && { level: user.level }),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /session/history - get user's session/activity history
router.get("/history", protect, async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const { limit = 20 } = req.query;

    const logs = await AuditLog.find({ performedBy: userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({ data: logs });
  } catch (error) {
    next(error);
  }
});

// POST /session/logout - logout user (client-side token deletion)
router.post("/logout", protect, async (req, res, next) => {
  try {
    // JWT tokens are stateless, so logout is handled client-side by deleting the token
    // This endpoint is for logging the logout action if needed
    res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
