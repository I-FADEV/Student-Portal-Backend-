const Admin = require("../models/admin.model");
const bcrypt = require("bcryptjs");

const changeAdminPasswordService = async ({
  AdminId,
  currentPassword,
  newPassword,
}) => {
  if (!currentPassword || !newPassword) {
    throw new Error("Both passwords are required");
  }

  const admin = await Admin.findById(adminId);

  if (!admin) {
    throw new Error("User not found");
  }

  // 1. Verify current password
  const isMatch = await bcrypt.compare(
    currentPassword,
    admin.password
  );

  if (!isMatch) {
    throw new Error("Current password is incorrect");
  }

  // 2. Prevent same password reuse
  const samePassword = await bcrypt.compare(
    newPassword,
    admin.password
  );

  if (samePassword) {
    throw new Error("New password must be different");
  }

  // 3. Update password
  admin.password = newPassword;
  await admin.save(); // triggers hashing

  return { message: "Password changed successfully" };
};

const deleteAdminService = async ({ adminId }) => {
  const admin = await Admin.findByIdAndDelete(adminId);
  if (!admin) throw new Error("Admin not found");
  return { message: "Admin deleted" };
};

module.exports = { deleteAdminService, changeAdminPasswordService };
