const {
  getStudentCoursesService,
  createCourseService,
  createBulkCoursesService,
  getAllCoursesService,
  deleteCourseService,
} = require("../services/course.service");

// ── STUDENT ──────────────────────────────────────────────────────────────────
const getMyCourses = async (req, res, next) => {
  try {
    const { session, semester } = req.query;

    const { data } = await getStudentCoursesService({
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
const createCourse = async (req, res, next) => {
  try {
    const { name, code, creditUnit, department, level, semester, session } = req.body;

    const { data } = await createCourseService({
      name, code, creditUnit, department, level, semester, session,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const createBulkCourses = async (req, res, next) => {
  try {
    const { courses } = req.body;

    const { data, count } = await createBulkCoursesService({ courses });

    res.status(201).json({ data, count });
  } catch (error) {
    next(error);
  }
};

const getAllCourses = async (req, res, next) => {
  try {
    const { department, level, session, semester } = req.query;

    const { data } = await getAllCoursesService({ department, level, session, semester });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteCourse = async (req, res, next) => {
  try {
    const { message } = await deleteCourseService({ courseId: req.params.id });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyCourses,
  createCourse,
  createBulkCourses,
  getAllCourses,
  deleteCourse,
};