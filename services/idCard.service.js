const IdCard = require("../models/idcard.model");
const Student = require("../models/student.model"); // adjust path if needed

// ── STUDENT: view own ID card record ─────────────────────────────────────────
// Creates the record automatically on first access (feePaid: false by default)
const viewStudentIdCardService = async ({ studentId }) => {
  let idCard = await IdCard.findOne({ studentId });

  if (!idCard) {
    // Auto-create on first visit so feePaid flag can be managed by bursar
    idCard = await IdCard.create({ studentId });
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
  const idCard = await IdCard.findOne({ studentId });

  if (!idCard)
    throw new Error("ID card record not found. Please refresh and try again.");

  // Guard: fee must be paid
  if (!idCard.feePaid) {
    throw new Error(
      "Your ID card fee has not been confirmed yet. Please pay at the Bursar's office first.",
    );
  }

  // Guard: one-time submission — can only submit if unsubmitted or rejected
  if (idCard.status === "pending" || idCard.status === "collected") {
    throw new Error(
      "You have already submitted your ID card request and it cannot be changed at this time.",
    );
  }

  // Update record with submitted data
  idCard.photoURL = photoURL;
  idCard.fullName = fullName;
  idCard.nationality = nationality;
  idCard.dateOfBirth = dateOfBirth;
  idCard.gender = gender;
  idCard.phone = phone;
  idCard.matricNumber = matricNumber;
  idCard.department = department;
  idCard.level = level;
  idCard.session = session;
  idCard.status = "pending";
  idCard.submittedAt = new Date();
  idCard.rejectionReason = null;
  idCard.rejectedAt = null;

  await idCard.save();
  return { data: idCard };
};

// ── BURSAR: mark ID card fee as paid for a student ────────────────────────────
const markFeePaidService = async ({ studentId }) => {
  // Find or create the record
  let idCard = await IdCard.findOne({ studentId });

  if (!idCard) {
    idCard = await IdCard.create({
      studentId,
      feePaid: true,
      feePaidAt: new Date(),
    });
  } else {
    if (idCard.feePaid) {
      throw new Error(
        "ID card fee has already been marked as paid for this student.",
      );
    }
    idCard.feePaid = true;
    idCard.feePaidAt = new Date();
    await idCard.save();
  }

  return { data: idCard, message: "ID card fee marked as paid successfully." };
};

// ── TAC ADMIN: mark ID card as collected ──────────────────────────────────────
const markCollectedService = async ({ idCardId }) => {
  const idCard = await IdCard.findById(idCardId);
  if (!idCard) throw new Error("ID card record not found.");

  if (idCard.status !== "pending") {
    throw new Error(
      `Cannot mark as collected — current status is "${idCard.status}".`,
    );
  }

  idCard.status = "collected";
  idCard.collectedAt = new Date();
  await idCard.save();

  return { data: idCard, message: "ID card marked as collected." };
};

// ── TAC ADMIN: reject an ID card submission ───────────────────────────────────
// This resets status to "unsubmitted" so the student can resubmit
const rejectIdCardService = async ({ idCardId, reason }) => {
  const idCard = await IdCard.findById(idCardId);
  if (!idCard) throw new Error("ID card record not found.");

  if (idCard.status !== "pending") {
    throw new Error(`Cannot reject — current status is "${idCard.status}".`);
  }

  idCard.status = "unsubmitted"; // unlocks form for resubmission
  idCard.rejectedAt = new Date();
  idCard.rejectionReason = reason || "No reason provided.";
  // Clear submitted photo/data so student must resubmit cleanly
  idCard.photoURL = null;
  idCard.submittedAt = null;

  await idCard.save();
  return {
    data: idCard,
    message: "ID card rejected. Student can now resubmit.",
  };
};

// ── TAC ADMIN: get all ID card submissions ────────────────────────────────────
const getAllIdCardsService = async ({ status }) => {
  const query = {};
  if (status) query.status = status;

  const idCards = await IdCard.find(query)
    .populate("studentId", "matricNumber name department level")
    .sort({ submittedAt: -1, createdAt: -1 });

  return { data: idCards };
};

module.exports = {
  viewStudentIdCardService,
  submitIdCardService,
  markFeePaidService,
  markCollectedService,
  rejectIdCardService,
  getAllIdCardsService,
};
