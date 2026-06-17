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

    const result = await getStudentTimetableService({
      userId: req.user.userId,
      session,
      semester,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createTimetableEntry = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;
    const {
      day,
      time,
      courseCode,
      courseName,
      creditUnit,
      venue,
      lecturer,
      lecturerPhone,
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
      creditUnit,
      venue,
      lecturer,
      lecturerPhone,
      department,
      level,
      session,
      semester,
      performedBy,
      ipAddress,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const createBulkTimetable = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;
    const { entries } = req.body;

    const { data } = await createBulkTimetableService({
      entries,
      performedBy,
      ipAddress,
    });

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
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { data } = await updateTimetableEntryService({
      entryId: req.params.id,
      ...req.body,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteTimetableEntry = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { message } = await deleteTimetableEntryService({
      entryId: req.params.id,
      performedBy,
      ipAddress,
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
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });

    res.status(201).json({
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
