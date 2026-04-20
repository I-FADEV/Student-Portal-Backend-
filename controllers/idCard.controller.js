const { studentIdCard } = require("../services/idCard.service");

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
      userId: req.user.userId,
      fileName: req.file.filename,
      sessionOnCard,
    });

    res.status(201).json({
      message: "ID card created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createIdcard };
