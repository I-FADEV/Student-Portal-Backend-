const {
  deleteAdminService,
  changeAdminPasswordService,
} = require("../services/admin.service");

const changeAdminPassword = async (req, res, next) => {
  try {
    const adminId = req.user.userId;
    const performedBy = req.user.userId;
    const ipAddress = req.ip;
    const { currentPassword, newPassword } = req.body;

    // Bug fix: was calling changePasswordService (undefined) — now calls the correct import
    const { message } = await changeAdminPasswordService({
      adminId,
      currentPassword,
      newPassword,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

const deleteAdmin = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { message } = await deleteAdminService({
      adminId: req.params.id,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

module.exports = { deleteAdmin, changeAdminPassword };
