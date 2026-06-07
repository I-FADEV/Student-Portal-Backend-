const {
  getStudentResultsService,
  uploadSingleResultService,
  uploadBulkResultsService,
  uploadBulkResultsJSONService,
  getStudentsForCourseService,
  getAllResultsService,
  getResultsByStudentService,
  updateResultService,
  deleteResultService,
} = require("../services/result.service");
const fs          = require("fs");
const parseExcel  = require("../utils/excelParser");

// ── STUDENT: view own results ─────────────────────────────────────────────────
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

// ── TIMETABLE ADMIN: upload single result ─────────────────────────────────────
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
      creditUnit: Number(creditUnit),
      test:       Number(test),
      exam:       Number(exam),
      session,
      semester,
      performedBy: req.user.userId,
      ipAddress:   req.ip,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── TIMETABLE ADMIN: bulk upload results from Excel ───────────────────────────
const uploadBulkResults = async (req, res, next) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    filePath = req.file.path;
    const parsedResults = parseExcel(filePath);

    if (!parsedResults.length) {
      return res.status(400).json({ message: "Excel file is empty or invalid" });
    }

    const { courseCode, courseName, creditUnit, session, semester } = req.body;

    if (!courseCode || !courseName || !creditUnit || !session || !semester) {
      return res.status(400).json({
        message:
          "Missing required fields: courseCode, courseName, creditUnit, session, semester",
      });
    }

    const response = await uploadBulkResultsService({
      results: parsedResults,
      courseCode,
      courseName,
      creditUnit:  Number(creditUnit),
      session,
      semester,
      performedBy: req.user.userId,
      ipAddress:   req.ip,
    });

    return res.status(200).json({ data: response });
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

// ── TIMETABLE ADMIN: bulk upload results from JSON (manual entry) ───────────────
const uploadBulkResultsJSON = async (req, res, next) => {
  try {
    const { results } = req.body;

    const response = await uploadBulkResultsJSONService({
      results,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });

    return res.status(200).json({ data: response });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Something went wrong during upload",
    });
  }
};

// ── TIMETABLE ADMIN: get students for manual result entry (based on course targets) ─
const getStudentsForCourse = async (req, res, next) => {
  try {
    const { courseCode, session, semester } = req.query;

    const { data } = await getStudentsForCourseService({ courseCode, session, semester });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── TIMETABLE ADMIN: get all results (course/session/semester filter) ─────────
const getAllResults = async (req, res, next) => {
  try {
    const { courseCode, session, semester } = req.query;

    const { data } = await getAllResultsService({ courseCode, session, semester });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── TIMETABLE ADMIN: get results for a specific student ───────────────────────
const getResultsByStudent = async (req, res, next) => {
  try {
    const { query, session, semester } = req.query;

    const { data, student } = await getResultsByStudentService({
      query,
      session,
      semester,
    });

    res.status(200).json({ data, student });
  } catch (error) {
    next(error);
  }
};

// ── TIMETABLE ADMIN: update a single result ───────────────────────────────────
const updateResult = async (req, res, next) => {
  try {
    const { test, exam } = req.body;

    const { data } = await updateResultService({
      resultId:    req.params.id,
      test,
      exam,
      performedBy: req.user.userId,
      ipAddress:   req.ip,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── TIMETABLE ADMIN: delete a result ─────────────────────────────────────────
const deleteResult = async (req, res, next) => {
  try {
    const { message } = await deleteResultService({
      resultId:    req.params.id,
      performedBy: req.user.userId,
      ipAddress:   req.ip,
    });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentResult,
  uploadSingleResult,
  uploadBulkResults,
  uploadBulkResultsJSON,
  getStudentsForCourse,
  getAllResults,
  getResultsByStudent,
  updateResult,
  deleteResult,
};