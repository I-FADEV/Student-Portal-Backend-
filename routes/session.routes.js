const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const Student = require("../models/student.model");
const Admin = require("../models/admin.model");
const AuditLog = require("../models/auditLog.model");
const Session = require("../models/session.model");
const logAction = require("../utils/logAction");

// ── ACADEMIC SESSION ENDPOINTS ───────────────────────────────────────────────

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

    // Check if session already exists
    const existingSession = await Session.findOne({ session });
    if (existingSession) {
      return res.status(409).json({ error: "Session already exists" });
    }

    // Create the session - auto-set phase to 'first' when startNow is true
    const newSession = await Session.create({
      session,
      phase: startNow ? "first" : "first",
      status: startNow ? "active" : "inactive",
      startDate: startNow ? (startDate || new Date()) : null,
      createdBy: req.user.userId,
    });

    await logAction({
      performedBy: req.user.userId,
      action: "CREATE",
      targetType: "SESSION",
      targetId: newSession._id,
      description: `Academic session ${session} created${startNow ? " and started" : ""}`,
      changes: {
        before: null,
        after: { session, startNow, startDate, status: newSession.status, phase: newSession.phase },
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: "Session created successfully",
      data: {
        id: newSession._id,
        session: newSession.session,
        phase: newSession.phase,
        startNow: startNow || false,
        startDate: newSession.startDate,
        status: newSession.status,
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

    const existingSession = await Session.findOne({ session });
    if (!existingSession) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (existingSession.status === "inactive") {
      return res.status(400).json({ error: "Session is already inactive" });
    }

    existingSession.status = "inactive";
    existingSession.endDate = new Date();
    await existingSession.save();

    await logAction({
      performedBy: req.user.userId,
      action: "UPDATE",
      targetType: "SESSION",
      targetId: existingSession._id,
      description: `Academic session ${session} stopped`,
      changes: {
        before: { status: "active" },
        after: { status: "inactive", endDate: existingSession.endDate },
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: "Session stopped successfully",
      data: {
        session: existingSession.session,
        status: existingSession.status,
        endDate: existingSession.endDate,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /session/end-current-phase - end current phase (only general admin)
router.post("/end-current-phase", protect, roleCheck(["admin"], ["general_admin"]), async (req, res, next) => {
  try {
    const activeSession = await Session.findOne({ status: "active" });
    if (!activeSession) {
      return res.status(404).json({ error: "No active session found" });
    }

    const phaseTransitions = {
      first: "second",
      second: "summer",
      summer: "closed",
    };

    const nextPhase = phaseTransitions[activeSession.phase];
    if (!nextPhase || nextPhase === "closed") {
      return res.status(400).json({ error: "Cannot end phase - session would be closed" });
    }

    const previousPhase = activeSession.phase;
    activeSession.phase = nextPhase;
    activeSession.status = "inactive";
    await activeSession.save();

    await logAction({
      performedBy: req.user.userId,
      action: "UPDATE",
      targetType: "SESSION",
      targetId: activeSession._id,
      description: `Session ${activeSession.session} phase ended: ${previousPhase} → ${nextPhase}`,
      changes: {
        before: { phase: previousPhase, status: "active" },
        after: { phase: nextPhase, status: "inactive" },
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: "Current phase ended successfully",
      data: {
        session: activeSession.session,
        previousPhase,
        nextPhase,
        status: activeSession.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /session/start-next-phase - start next phase (only general admin)
router.post("/start-next-phase", protect, roleCheck(["admin"], ["general_admin"]), async (req, res, next) => {
  try {
    const { phase, startNow, startDate } = req.body;

    if (!phase || !["second", "summer"].includes(phase)) {
      return res.status(400).json({ error: "Phase must be 'second' or 'summer'" });
    }

    const activeSession = await Session.findOne({ status: "active" });
    if (activeSession) {
      return res.status(400).json({ error: "An active session already exists" });
    }

    // Find the session to update (the most recent one)
    const sessionToUpdate = await Session.findOne().sort({ createdAt: -1 });
    if (!sessionToUpdate) {
      return res.status(404).json({ error: "No session found to update" });
    }

    const previousPhase = sessionToUpdate.phase;
    sessionToUpdate.phase = phase;
    sessionToUpdate.status = startNow ? "active" : "inactive";
    sessionToUpdate.startDate = startNow ? (startDate || new Date()) : null;
    sessionToUpdate.endDate = null;
    await sessionToUpdate.save();

    await logAction({
      performedBy: req.user.userId,
      action: "UPDATE",
      targetType: "SESSION",
      targetId: sessionToUpdate._id,
      description: `Session ${sessionToUpdate.session} phase started: ${previousPhase} → ${phase}`,
      changes: {
        before: { phase: previousPhase, status: "inactive" },
        after: { phase, status: sessionToUpdate.status, startDate: sessionToUpdate.startDate },
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: "Next phase started successfully",
      data: {
        session: sessionToUpdate.session,
        previousPhase,
        phase,
        startDate: sessionToUpdate.startDate,
        status: sessionToUpdate.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /session/academic/active - get the currently active academic session
router.get("/academic/active", protect, async (req, res, next) => {
  try {
    const activeSession = await Session.findOne({ status: "active" })
      .populate("createdBy", "username adminType");

    if (!activeSession) {
      return res.status(404).json({ error: "No active session found" });
    }

    res.status(200).json({
      data: {
        session: activeSession.session,
        phase: activeSession.phase,
        startDate: activeSession.startDate,
        status: activeSession.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /session - list all academic sessions (for admins)
router.get("/", protect, roleCheck(["admin"]), async (req, res, next) => {
  try {
    const sessions = await Session.find()
      .populate("createdBy", "username adminType")
      .sort({ createdAt: -1 });

    res.status(200).json({ data: sessions });
  } catch (error) {
    next(error);
  }
});

// ── USER SESSION ENDPOINTS ───────────────────────────────────────────────────

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

// GET /session/history - get user's activity history
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
