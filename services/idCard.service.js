const IdCard  = require("../models/idcard.model");
const Student = require("../models/student.model");
const logAction = require("../utils/logAction");

// ── STUDENT: view own ID card record ─────────────────────────────────────────
const viewStudentIdCardService = async ({ studentId }) => {
  let idCard = await IdCard.findOne({ student: studentId });

  if (!idCard) {
    idCard = await IdCard.create({ student: studentId });
  }

  return { data: idCard };
};   

// ── STUDENT: submit ID card form ──────────────────────────────────────────────
const submitIdCardService = async ({
  studentId,
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
}) => {
  const idCard = await IdCard.findOne({ student: studentId });

  if (!idCard)
    throw new Error("ID card record not found. Please refresh and try again.");

  if (!idCard.feePaid) {
    throw new Error(
      "Your ID card fee has not been confirmed yet. Please pay at the Bursar's office first.",
    );
  }

  if (idCard.status === "pending" || idCard.status === "collected") {
    throw new Error(
      "You have already submitted your ID card request and it cannot be changed at this time.",
    );
  }

  idCard.photoURL        = photoURL;
  idCard.fullName        = fullName;
  idCard.nationality     = nationality;
  idCard.dateOfBirth     = dateOfBirth;
  idCard.gender          = gender;
  idCard.phone           = phone;
  idCard.matricNumber    = matricNumber;
  idCard.department      = department;
  idCard.level           = level;
  idCard.session         = session;
  idCard.status          = "pending";
  idCard.submittedAt     = new Date();
  idCard.rejectionReason = null;
  idCard.rejectedAt      = null;

  await idCard.save();
  return { data: idCard };
};

// ── BURSAR: mark ID card fee as paid ─────────────────────────────────────────
const markFeePaidService = async ({ studentId, performedBy, ipAddress }) => {
  let idCard = await IdCard.findOne({ student: studentId });

  if (!idCard) {
    idCard = await IdCard.create({
      student: studentId,
      feePaid:   true,
      feePaidAt: new Date(),
    });
  } else {
    if (idCard.feePaid) {
      throw new Error(
        "ID card fee has already been marked as paid for this student.",
      );
    }
    idCard.feePaid   = true;
    idCard.feePaidAt = new Date();
    await idCard.save();
  }

  await logAction({
    performedBy,
    action:          "UPDATE",
    targetType:      "IDCARD",
    targetId:        idCard._id,
    affectedStudent: studentId,
    description:     "ID card fee marked as paid for student",
    changes: {
      before: { feePaid: false },
      after:  { feePaid: true  },
    },
    ipAddress,
  });

  return { data: idCard, message: "ID card fee marked as paid successfully." };
};

// ── TAC ADMIN: mark ID card as collected ─────────────────────────────────────
const markCollectedService = async ({ idCardId, performedBy, ipAddress }) => {
  const idCard = await IdCard.findById(idCardId);
  if (!idCard) throw new Error("ID card record not found.");

  if (idCard.status !== "pending") {
    throw new Error(
      `Cannot mark as collected — current status is "${idCard.status}".`,
    );
  }

  idCard.status      = "collected";
  idCard.collectedAt = new Date();
  await idCard.save();

  await logAction({
    performedBy,
    action:          "UPDATE",
    targetType:      "IDCARD",
    targetId:        idCardId,
    affectedStudent: idCard.studentId,
    description:     "ID card marked as collected",
    changes: {
      before: { status: "pending"   },
      after:  { status: "collected" },
    },
    ipAddress,
  });

  return { data: idCard, message: "ID card marked as collected." };
};

// ── TAC ADMIN: reject an ID card submission ───────────────────────────────────
const rejectIdCardService = async ({
  idCardId,
  reason,
  performedBy,
  ipAddress,
}) => {
  const idCard = await IdCard.findById(idCardId);
  if (!idCard) throw new Error("ID card record not found.");

  if (idCard.status !== "pending") {
    throw new Error(`Cannot reject — current status is "${idCard.status}".`);
  }

  idCard.status          = "unsubmitted";
  idCard.rejectedAt      = new Date();
  idCard.rejectionReason = reason || "No reason provided.";
  idCard.photoURL        = null;
  idCard.submittedAt     = null;

  await idCard.save();

  await logAction({
    performedBy,
    action:          "UPDATE",
    targetType:      "IDCARD",
    targetId:        idCardId,
    affectedStudent: idCard.studentId,
    description:     `ID card rejected — reason: ${reason || "No reason provided"}`,
    changes: {
      before: { status: "pending"     },
      after:  { status: "unsubmitted", rejectionReason: reason },
    },
    ipAddress,
  });

  return {
    data:    idCard,
    message: "ID card rejected. Student can now resubmit.",
  };
};

// ── TAC ADMIN: get all ID card submissions ────────────────────────────────────
const getAllIdCardsService = async ({ status }) => {
  const query = {};
  if (status) query.status = status;

  const idCards = await IdCard.find(query)
    .populate("student", "matricNumber name department level")
    .sort({ submittedAt: -1, createdAt: -1 });

  return { data: idCards };
};

// ── TAC ADMIN: dashboard stats ────────────────────────────────────────────────
const getIdCardStatsService = async () => {
  const [totalStudents, pending, collected, rejected, total] =
    await Promise.all([
      Student.countDocuments(),
      IdCard.countDocuments({ status: "pending"   }),
      IdCard.countDocuments({ status: "collected" }),
      IdCard.countDocuments({ status: "rejected"  }),
      IdCard.countDocuments(),
    ]);

  return {
    data: {
      totalStudents,
      pending,
      collected,
      rejected,
      total,
    },
  };
};

module.exports = {
  viewStudentIdCardService,
  submitIdCardService,
  markFeePaidService,
  markCollectedService,
  rejectIdCardService,
  getAllIdCardsService,
  getIdCardStatsService,
};