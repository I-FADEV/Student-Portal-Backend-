const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const Student = require("../models/student.model");
const Admin = require("../models/admin.model");
const AuditLog = require("../models/auditLog.model");
const logAction = require("../utils/logAction");

// POST /session/create - create an academic session (only general admin)
router.post("/create", protect, roleCheck(["admin"], ["general_admin"]), async (req, res, next) => {
  try {
    const { session, startNow, startDate } = req.body;

    if (!session) {
      return res.status(400).json({ error: "Session is required (e.g., 2025/2026)" });
    }

    // Validate session format (e.g., 2025/2026)
    const sessionPattern = /^\d{4}\/\d{4}$/;
    if (!sessionPattern.test(session)) {
      return res.status(400).json({ error: "Session must follow format: YYYY/YYYY (e.g., 2025/2026)" });
    }

    // Store session info - this could be stored in a separate Session model if needed
    // For now, we'll just log the action and return success
    await logAction({
      performedBy: req.user.userId,
      action: "CREATE",
      targetType: "SESSION",
      targetId: session,
      description: `Academic session ${session} created${startNow ? " and started" : ""}`,
      changes: {
        before: null,
        after: { session, startNow, startDate },
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: "Session created successfully",
      data: {
        session,
        startNow: startNow || false,
        startDate: startDate || null,
        status: startNow ? "active" : "inactive",
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /session/stop - stop an active academic session (only general admin)
router.post("/stop", protect, roleCheck(["admin"], ["general_admin"]), async (req, res, next) => {
  try {
    const { session } = req.body;

    if (!session) {
      return res.status(400).json({ error: "Session is required" });
    }

    // Validate session format
    const sessionPattern = /^\d{4}\/\d{4}$/;
    if (!sessionPattern.test(session)) {
      return res.status(400).json({ error: "Session must follow format: YYYY/YYYY (e.g., 2025/2026)" });
    }

    await logAction({
      performedBy: req.user.userId,
      action: "UPDATE",
      targetType: "SESSION",
      targetId: session,
      description: `Academic session ${session} stopped`,
      changes: {
        before: { status: "active" },
        after: { status: "inactive" },
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: "Session stopped successfully",
      data: {
        session,
        status: "inactive",
      },
    });
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
