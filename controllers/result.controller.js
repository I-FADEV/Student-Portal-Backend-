const {
  getStudentResultsService,
  uploadSingleResultService,
  uploadBulkResultsService,
  getAllResultsService,
  deleteResultService,
} = require("../services/result.service");
const fs = require("fs");
const parseExcel = require("../utils/excelParser");

const getStudentResult = async (req, res, next) => {
  try {
    const { session, semester } = req.query;

    const { data } = await getStudentResultsService({
      userId: req.user.userId,
      session,
      semester,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── ADMIN ─────────────────────────────────────────────────────────────────────
const uploadSingleResult = async (req, res, next) => {
  try {
    const {
      matricNumber,
      courseCode,
      courseName,
      creditUnit,
      test,
      exam,
      session,
      semester,
    } = req.body;

    const { data } = await uploadSingleResultService({
      matricNumber,
      courseCode,
      courseName,
      creditUnit,
      test,
      exam,
      session,
      semester,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const uploadBulkResults = async (req, res, next) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    filePath = req.file.path;

    // Parse Excel
    const parsedResults = parseExcel(filePath);

    if (!parsedResults.length) {
      return res
        .status(400)
        .json({ message: "Excel file is empty or invalid" });
    }

    const { courseCode, courseName, creditUnit, session, semester } = req.body;

    if (!courseCode || !courseName || !creditUnit || !session || !semester) {
      return res.status(400).json({
        message:
          "Missing required fields (courseCode, courseName, creditUnit, session, semester)",
      });
    }

    const response = await uploadBulkResultsService({
      results: parsedResults,
      courseCode,
      courseName,
      creditUnit: Number(creditUnit),
      session,
      semester,
    });

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Something went wrong during upload",
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const getAllResults = async (req, res, next) => {
  try {
    const { courseCode, session, semester } = req.query;

    const { data } = await getAllResultsService({
      courseCode,
      session,
      semester,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteResult = async (req, res, next) => {
  try {
    const { message } = await deleteResultService({ resultId: req.params.id });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentResult,
  uploadSingleResult,
  uploadBulkResults,
  getAllResults,
  deleteResult,
};
