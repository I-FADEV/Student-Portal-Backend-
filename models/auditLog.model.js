const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // WHO did it — always an admin
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // WHAT they did
    action: {
      type: String,
      required: true,
      enum: ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"],
    },

    // WHAT TYPE of record was affected
    targetType: {
      type: String,
      required: true,
      enum: ["FINANCE", "IDCARD", "COURSE", "TIMETABLE"],
    },

    // WHICH specific record was affected (the finance record id, idcard id etc)
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // WHICH student was affected — makes it easy to query "all actions on student X"
    affectedStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null, // null for actions not related to a student eg adding a course
    },

    // HUMAN READABLE summary — what the general admin sees in the dashboard
    description: {
      type: String,
      required: true,
      // e.g. "Finance admin updated tuition payment for student IFAT/26/CSC/0187"
    },

    // WHAT CHANGED — before and after values
    changes: {
      before: { type: Object, default: null }, // e.g. { paidAmount: 0, status: "Unpaid" }
      after: { type: Object, default: null }, // e.g. { paidAmount: 5000, status: "Partial" }
    },

    ipAddress: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes for common queries
auditLogSchema.index({ performedBy: 1 }); // "show all actions by this admin"
auditLogSchema.index({ affectedStudent: 1 }); // "show all actions on this student"
auditLogSchema.index({ createdAt: -1 }); // "show most recent logs first"

module.exports = mongoose.model("AuditLog", auditLogSchema);
