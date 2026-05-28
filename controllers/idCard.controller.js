const {
  viewStudentIdCardService,
  submitIdCardService,
  markFeePaidService,
  markCollectedService,
  rejectIdCardService,
  getAllIdCardsService,
} = require("../services/idCard.service");

// ── STUDENT: view own ID card ─────────────────────────────────────────────────
const viewIdCard = async (req, res, next) => {
  try {
    const { data } = await viewStudentIdCardService({
      studentId: req.user.userId,
    });
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── STUDENT: submit ID card form ──────────────────────────────────────────────
const createIdcard = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Passport photo is required." });
    }

    const photoURL = req.file.filename;
    const {
      fullName,
      nationality,
      dateOfBirth,
      gender,
      phone,
      matricNumber,
      department,
      level,
      session,
    } = req.body;

    const { data } = await submitIdCardService({
      studentId: req.user.userId,
      photoURL,
      fullName,
      nationality,
      dateOfBirth,
      gender,
      phone,
      matricNumber,
      department,
      level,
      session,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── BURSAR ADMIN: mark fee as paid ────────────────────────────────────────────
const markFeePaid = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;
    const studentId = req.params.studentId;

    const { data, message } = await markFeePaidService({
      studentId,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ data, message });
  } catch (error) {
    next(error);
  }
};

// ── TAC ADMIN: mark collected ─────────────────────────────────────────────────
const markCollected = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { data, message } = await markCollectedService({
      idCardId: req.params.id,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ data, message });
  } catch (error) {
    next(error);
  }
};

// ── TAC ADMIN: reject ID card ─────────────────────────────────────────────────
const rejectIdCard = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;
    const { reason } = req.body;

    const { data, message } = await rejectIdCardService({
      idCardId: req.params.id,
      reason,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ data, message });
  } catch (error) {
    next(error);
  }
};

// ── TAC ADMIN: get all submissions ────────────────────────────────────────────
const getAllIdCards = async (req, res, next) => {
  try {
    const { status } = req.query;

    const { data } = await getAllIdCardsService({ status });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  viewIdCard,
  createIdcard,
  markFeePaid,
  markCollected,
  rejectIdCard,
  getAllIdCards,
};
