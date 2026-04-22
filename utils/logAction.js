const AuditLog = require("../models/auditLog.model");

const logAction = async ({
  performedBy,
  action,
  targetType,
  targetId,
  affectedStudent = null,
  description,
  changes = { before: null, after: null },
  ipAddress = null,
}) => {
  try {
    await AuditLog.create({
      performedBy,
      action,
      targetType,
      targetId,
      affectedStudent,
      description,
      changes,
      ipAddress,
    });
  } catch (err) {
    // Don't crash the main request if logging fails
    // Just log the error to the server console
    console.error("Audit log failed:", err.message);
  }
};

module.exports = logAction;
