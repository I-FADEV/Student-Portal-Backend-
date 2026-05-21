const Course = require("../models/course.model");
const Student = require("../models/student.model");

// ── STUDENT: get ALL courses for their department + level (all sessions) ──────
const getStudentCoursesService = async ({ userId, session, semester }) => {
  const student = await Student.findById(userId);
  if (!student) throw new Error("Student not found");

  if (!student.department || !student.level) {
    throw new Error("Your profile is incomplete. Department or level is missing.");
  }

  const query = {
    department: student.department,
    level: student.level,
  };
  if (session)  query.session  = session;
  if (semester) query.semester = semester;

  const courses = await Course.find(query).sort({ session: -1, semester: -1, code: 1 });
  return { data: courses };
};

// ── ADMIN: create a single course ─────────────────────────────────────────────
const createCourseService = async ({
  name,
  code,
  creditUnit,
  department,
  level,
  semester,
  session,
  lecturer,
  lecturerPhone,
}) => {
  const existing = await Course.findOne({ code: code.toUpperCase(), session, semester });
  if (existing) {
    throw new Error(
      `Course ${code.toUpperCase()} already exists for ${session} ${semester} Semester`
    );
  }

  const course = await Course.create({
    name,
    code,
    creditUnit,
    department,
    level,
    semester,
    session,
    lecturer:      lecturer      || null,
    lecturerPhone: lecturerPhone || null,
  });

  return { data: course };
};

// ── ADMIN: create multiple courses at once ─────────────────────────────────────
const createBulkCoursesService = async ({ courses }) => {
  if (!Array.isArray(courses) || courses.length === 0) {
    throw new Error("Courses must be a non-empty array");
  }

  // Normalise each entry so lecturer fields are always present
  const normalised = courses.map((c) => ({
    ...c,
    lecturer:      c.lecturer      || null,
    lecturerPhone: c.lecturerPhone || null,
  }));

  const result = await Course.insertMany(normalised);
  return { data: result, count: result.length };
};

// ── ADMIN: get all courses (with optional filters) ─────────────────────────────
const getAllCoursesService = async ({ department, level, session, semester }) => {
  const query = {};
  if (department) query.department = department;
  if (level)      query.level      = Number(level);
  if (session)    query.session    = session;
  if (semester)   query.semester   = semester;

  const courses = await Course.find(query).sort({ department: 1, level: 1, code: 1 });
  return { data: courses };
};

// ── ADMIN: delete a course ─────────────────────────────────────────────────────
const deleteCourseService = async ({ courseId }) => {
  const course = await Course.findByIdAndDelete(courseId);
  if (!course) throw new Error("Course not found");
  return { message: "Course deleted" };
};

module.exports = {
  getStudentCoursesService,
  createCourseService,
  createBulkCoursesService,
  getAllCoursesService,
  deleteCourseService,
};