const TimetableCourse = require("../models/timetableCourse.model");
const AppError        = require("../utils/appError");

// ── CREATE ────────────────────────────────────────────────────────────────────
const createTimetableCourseService = async ({
  courseCode,
  courseName,
  lecturer,
  lecturerPhone,
  targets,
  session,
  semester,
}) => {
  const existing = await TimetableCourse.findOne({
    courseCode: courseCode.toUpperCase(),
    session,
    semester,
  });

  if (existing) {
    throw new AppError(
      `Course ${courseCode.toUpperCase()} already exists for ${session} ${semester} semester`,
      409
    );
  }

  const course = await TimetableCourse.create({
    courseCode,
    courseName,
    lecturer,
    lecturerPhone: lecturerPhone || null,
    targets,
    session,
    semester,
  });

  return { data: course };
};

// ── GET ALL (filter by session + semester) ────────────────────────────────────
const getTimetableCoursesService = async ({ session, semester }) => {
  const query = {};
  if (session)  query.session  = session;
  if (semester) query.semester = semester;

  const courses = await TimetableCourse.find(query).sort({ courseCode: 1 });
  return { data: courses };
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
const updateTimetableCourseService = async (id, updates) => {
  const course = await TimetableCourse.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  );

  if (!course) throw new AppError("Course not found", 404);
  return { data: course };
};

// ── DELETE ────────────────────────────────────────────────────────────────────
const deleteTimetableCourseService = async (id) => {
  const course = await TimetableCourse.findByIdAndDelete(id);
  if (!course) throw new AppError("Course not found", 404);
  return { data: course };
};

// ── STATS (for timetable admin dashboard) ─────────────────────────────────────
const getTimetableStatsService = async () => {
  const Timetable = require("../models/timetable.model");
  const totalEntries = await Timetable.countDocuments();

  // Result model may not exist yet — gracefully handle
  let totalResults = 0;
  try {
    const Result = require("../models/result.model");
    totalResults = await Result.countDocuments();
  } catch (_) {
    // result.model not built yet — stays 0
  }

  const [totalCourses, sessions] = await Promise.all([
    TimetableCourse.countDocuments(),
    Timetable.distinct("session"),
  ]);

  return {
    data: {
      totalCourses,
      totalEntries,
      totalSessions: sessions.length,
      totalResults,
      pendingClashes: 0, // Clash detection runs on frontend — always 0 here
    },
  };
};

module.exports = {
  createTimetableCourseService,
  getTimetableCoursesService,
  updateTimetableCourseService,
  deleteTimetableCourseService,
  getTimetableStatsService,
};