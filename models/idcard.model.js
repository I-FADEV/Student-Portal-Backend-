const mongoose = require("mongoose");

const idCardSchema = new mongoose.Schema(
  {
    verificationToken: { type: String, unique: true, sparse: true },
    approvedAt: Date, approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    expiresAt: Date, printCount: { type: Number, default: 0 }, lastPrintedAt: Date,
    previousCards: [{ photoURL: String, session: String, approvedAt: Date, expiresAt: Date, collectedAt: Date }],
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    // ── Fee status (set by Bursar admin) ─────────────────────────────────────
    feePaid: {
      type: Boolean,
      default: false,
    },

    // ── Submission status ─────────────────────────────────────────────────────
    // unsubmitted → pending → collected
    // unsubmitted ← rejected (TAC rejects, student can resubmit)
    status: {
      type: String,
      enum: ["unsubmitted", "pending", "approved", "collected", "rejected"],
      default: "unsubmitted",
    },

    // ── Student-filled fields ─────────────────────────────────────────────────
    photoURL: {
      type: String,
      default: null,
    },
    fullName: {
      type: String,
      default: null,
    },
    nationality: {
      type: String,
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", null],
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },

    // ── Auto-filled from profile ──────────────────────────────────────────────
    matricNumber: {
      type: String,
      default: null,
    },
    department: {
      type: String,
      default: null,
    },
    level: {
      type: Number,
      default: null,
    },
    session: {
      type: String,
      default: null,
    },

    // ── Timestamps for key events ─────────────────────────────────────────────
    submittedAt: {
      type: Date,
      default: null,
    },
    feePaidAt: {
      type: Date,
      default: null,
    },
    collectedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Unique index on student to prevent duplicate ID card records per student
idCardSchema.index({ student: 1 }, { unique: true });

module.exports = mongoose.model("IdCard", idCardSchema);
