const {
  getStudentTimetableService,
  createTimetableEntryService,
  createBulkTimetableService,
  getAllTimetableService,
  deleteTimetableEntryService,
} = require("../services/timetable.service");

// ── STUDENT ──────────────────────────────────────────────────────────────────
const getMyTimetable = async (req, res, next) => {
  try {
    const { session, semester } = req.query;

    const { data } = await getStudentTimetableService({
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
const createTimetableEntry = async (req, res, next) => {
  try {
    const { day, time, courseCode, courseName, venue, lecturer, department, level, session, semester } = req.body;

    const { data } = await createTimetableEntryService({
      day, time, courseCode, courseName, venue, lecturer, department, level, session, semester,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const createBulkTimetable = async (req, res, next) => {
  try {
    const { entries } = req.body;

    const { data, count } = await createBulkTimetableService({ entries });

    res.status(201).json({ data, count });
  } catch (error) {
    next(error);
  }
};

const getAllTimetable = async (req, res, next) => {
  try {
    const { department, level, session, semester } = req.query;

    const { data } = await getAllTimetableService({ department, level, session, semester });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteTimetableEntry = async (req, res, next) => {
  try {
    const { message } = await deleteTimetableEntryService({ entryId: req.params.id });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyTimetable,
  createTimetableEntry,
  createBulkTimetable,
  getAllTimetable,
  deleteTimetableEntry,
};