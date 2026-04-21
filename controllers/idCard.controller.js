const {
  studentIdCard,
  viewStudentIdCard,
} = require("../services/idCard.service");

const createIdcard = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image file" });
    }

    const {
      nameOnCard,
      matricOnCard,
      departmentOnCard,
      levelOnCard,
      sessionOnCard,
    } = req.body;

    const { data } = await studentIdCard({
      nameOnCard,
      matricOnCard,
      departmentOnCard,
      levelOnCard,
      user: req.user,
      file: req.file,
      studentId: req.user.userId,
      fileName: req.file.filename,
      sessionOnCard,
    });

    res.status(201).json({
      message: "ID card created successfully",
      data,
    });
  } catch (error) {
    if (req.file) {
      const filePath = path.join(__dirname, "../uploads", req.file.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete orphaned file:", err.message);
      });
    }
    next(error);
  }
};

const viewIdCard = async (req, res, next) => {
  try {
    const { data } = await viewStudentIdCard({
      studentId: req.user.userId,
      session: req.body.session,
    });

    res.status(200).json({
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createIdcard, viewIdCard };
