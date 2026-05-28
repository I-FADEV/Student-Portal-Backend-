const {
  getStudentTimetableService,
  createTimetableEntryService,
  createBulkTimetableService,
  getAllTimetableService,
  deleteTimetableEntryService,
  updateTimetableEntryService,
  generateTimetableService,
} = require("../services/timetable.service");

const getStudentTimetable = async (req, res, next) => {
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

const createTimetableEntry = async (req, res, next) => {
  try {
    const {
      day,
      time,
      courseCode,
      courseName,
      venue,
      lecturer,
      department,
      level,
      session,
      semester,
    } = req.body;

    const { data } = await createTimetableEntryService({
      day,
      time,
      courseCode,
      courseName,
      venue,
      lecturer,
      department,
      level,
      session,
      semester,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const createBulkTimetable = async (req, res, next) => {
  try {
    const { entries } = req.body;

    const { data } = await createBulkTimetableService({ entries });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

const getAllTimetable = async (req, res, next) => {
  try {
    const { department, level, session, semester } = req.query;

    const { data } = await getAllTimetableService({
      department,
      level,
      session,
      semester,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const updateTimetableEntry = async (req, res, next) => {
  try {
    const { data } = await updateTimetableEntryService({
      entryId: req.params.id,
      ...req.body,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteTimetableEntry = async (req, res, next) => {
  try {
    const { message } = await deleteTimetableEntryService({
      entryId: req.params.id,
    });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

const generateTimetableController = async (req, res, next) => {
  try {
    const { department, level, session, semester } = req.body;

    const result = await generateTimetableService({
      department,
      level,
      session,
      semester,
    });

    res.status(201).json({
      success: true,
      message: "Timetable generated successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentTimetable,
  createTimetableEntry,
  createBulkTimetable,
  getAllTimetable,
  deleteTimetableEntry,
  updateTimetableEntry,
  generateTimetableController,
};
