const { viewStudentProfile } = require("../services/profile.service");

const studentProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const { user } = await viewStudentProfile({ userId });

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

module.exports = { studentProfile };
