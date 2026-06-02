const AuditLog = require("../models/auditLog.model");
const Admin = require("../models/admin.model");

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
    // ── LOOK UP the admin to get adminType and username ──────────────────────
    let adminType = null;
    let adminUsername = null;

    if (performedBy) {
      const admin = await Admin.findById(performedBy);
      if (admin) {
        adminType = admin.adminType;
        adminUsername = admin.username;
      }
    }

    // ── CREATE the audit log with all fields ─────────────────────────────────
    await AuditLog.create({
      performedBy,
      adminType,          // ← NOW STORED
      adminUsername,      // ← NOW STORED
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