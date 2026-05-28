const {
  deleteAdminService,
  changeAdminPasswordService,
} = require("../services/admin.service");

const changeAdminPassword = async (req, res, next) => {
  try {
    const AdminId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    const { result } = await changePasswordService({
      AdminId,
      currentPassword,
      newPassword,
    });

    res.status(200).json({ result });
  } catch (error) {
    next(error);
  }
};

const deleteAdmin = async (req, res, next) => {
  try {
    const { message } = await deleteAdminService({ adminId: req.params.id });
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

module.exports = { deleteAdmin, changeAdminPassword };
