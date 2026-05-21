const mongoose = require("mongoose");

const idCardSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true, // one record per student
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
      enum: ["unsubmitted", "pending", "collected", "rejected"],
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
      type: String,
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
  { timestamps: true }
);

module.exports = mongoose.model("IdCard", idCardSchema);