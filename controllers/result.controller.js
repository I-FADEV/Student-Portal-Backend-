const {
  getStudentResultsService,
  uploadSingleResultService,
  uploadBulkResultsService,
  getAllResultsService,
  deleteResultService,
} = require("../services/result.service");

// ── STUDENT ──────────────────────────────────────────────────────────────────
const getMyResults = async (req, res, next) => {
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
    const { matricNumber, courseCode, courseName, creditUnit, test, exam, session, semester } = req.body;

    const { data } = await uploadSingleResultService({
      matricNumber, courseCode, courseName, creditUnit, test, exam, session, semester,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const uploadBulkResults = async (req, res, next) => {
  try {
    const { results, courseCode, courseName, creditUnit, session, semester } = req.body;

    const { data } = await uploadBulkResultsService({
      results, courseCode, courseName, creditUnit, session, semester,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const getAllResults = async (req, res, next) => {
  try {
    const { courseCode, session, semester } = req.query;

    const { data } = await getAllResultsService({ courseCode, session, semester });

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
  getMyResults,
  uploadSingleResult,
  uploadBulkResults,
  getAllResults,
  deleteResult,
};