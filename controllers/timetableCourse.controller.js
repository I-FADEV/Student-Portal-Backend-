const {
  createTimetableCourseService,
  getTimetableCoursesService,
  updateTimetableCourseService,
  deleteTimetableCourseService,
  getTimetableStatsService,
} = require("../services/timetableCourse.service");
const logAction = require("../utils/logAction");

// ── GET all courses (filter by session + semester) ────────────────────────────
const getTimetableCourses = async (req, res, next) => {
  try {
    const { session, semester } = req.query;
    const { data } = await getTimetableCoursesService({ session, semester });
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── CREATE a course ───────────────────────────────────────────────────────────
const createTimetableCourse = async (req, res, next) => {
  try {
    const {
      courseCode,
      courseName,
      lecturer,
      lecturerPhone,
      targets,
      session,
      semester,
    } = req.body;

    const { data } = await createTimetableCourseService({
      courseCode,
      courseName,
      lecturer,
      lecturerPhone,
      targets,
      session,
      semester,
    });

    await logAction({
      performedBy: req.user.userId,
      action:      "CREATE",
      targetType:  "COURSE",
      targetId:    data._id,
      description: `Course added: ${data.courseCode} — ${data.courseName} (${session} ${semester})`,
      changes:     { before: null, after: { courseCode, courseName, lecturer, targets, session, semester } },
      ipAddress:   req.ip,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── UPDATE a course ───────────────────────────────────────────────────────────
const updateTimetableCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Capture before state for log
    const { data: before } = await getTimetableCoursesService({})
      .catch(() => ({ data: [] }));
    const oldCourse = (before || []).find
      ? null
      : null; // We'll just log what changed

    const { data } = await updateTimetableCourseService(id, req.body);

    await logAction({
      performedBy: req.user.userId,
      action:      "UPDATE",
      targetType:  "COURSE",
      targetId:    data._id,
      description: `Course updated: ${data.courseCode} — ${data.courseName}`,
      changes:     { before: null, after: req.body },
      ipAddress:   req.ip,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── DELETE a course ───────────────────────────────────────────────────────────
const deleteTimetableCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data } = await deleteTimetableCourseService(id);

    await logAction({
      performedBy: req.user.userId,
      action:      "DELETE",
      targetType:  "COURSE",
      targetId:    data._id,
      description: `Course deleted: ${data.courseCode} — ${data.courseName} (${data.session} ${data.semester})`,
      changes:     { before: { courseCode: data.courseCode, courseName: data.courseName }, after: null },
      ipAddress:   req.ip,
    });

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// ── GET timetable stats (dashboard) ──────────────────────────────────────────
const getTimetableStats = async (req, res, next) => {
  try {
    const { data } = await getTimetableStatsService();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTimetableCourses,
  createTimetableCourse,
  updateTimetableCourse,
  deleteTimetableCourse,
  getTimetableStats,
};