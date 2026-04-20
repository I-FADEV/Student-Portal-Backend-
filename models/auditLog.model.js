const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userModel",
    },
    userModel: {
      type: String,
      required: true,
      enum: ["Admin", "Student"],
    },

    action: {
      type: String,
      required: true,
      enum: ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"],
    },

    targetType: {
      type: String,
      required: true,
      enum: ["STUDENT", "ADMIN", "COURSE", "PAYMENT"],
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    description: String,
    metadata: Object,
    ipAddress: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
