const Student = require("../models/student.model");

const viewStudentProfile = async ({ userId }) => {
  const user = await Student.findById(userId).select("-password");

  return { user };
};

module.exports = { viewStudentProfile };
