const Course = require("../models/course.model");
const Student = require("../models/student.model");
const logAction = require("../utils/logAction");

const getStudentCoursesService = async ({ userId, session, semester }) => {
  const student = await Student.findById(userId);
  if (!student) throw new Error("Student not found");

  if (!student.department || !student.level) {
    throw new Error(
      "Your profile is incomplete. Department or level is missing.",
    );
  }

  const query = {
    department: student.department,
    level: student.level,
  };
  if (session) query.session = session;
  if (semester) query.semester = semester;

  const courses = await Course.find(query).sort({
    session: -1,
    semester: -1,
    code: 1,
  });
  return { data: courses };
};

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
  performedBy,
  ipAddress,
}) => {
  const existing = await Course.findOne({
    code: code.toUpperCase(),
    session,
    semester,
  });
  if (existing) {
    throw new Error(
      `Course ${code.toUpperCase()} already exists for ${session} ${semester} Semester`,
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
    lecturer: lecturer || null,
    lecturerPhone: lecturerPhone || null,
  });

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "COURSE",
    targetId: course._id,
    description: `Course ${code.toUpperCase()} created for ${department} level ${level} (${session} ${semester})`,
    changes: {
      before: null,
      after: { name, code, creditUnit, department, level, session, semester },
    },
    ipAddress,
  });

  return { data: course };
};

const createBulkCoursesService = async ({
  courses,
  performedBy,
  ipAddress,
}) => {
  if (!Array.isArray(courses) || courses.length === 0) {
    throw new Error("Courses must be a non-empty array");
  }

  const normalised = courses.map((c) => ({
    ...c,
    lecturer: c.lecturer || null,
    lecturerPhone: c.lecturerPhone || null,
  }));

  const result = await Course.insertMany(normalised);

  // Log once for the whole batch
  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "COURSE",
    targetId: performedBy, // no single target — use admin id as stand-in
    description: `Bulk course upload — ${result.length} courses created`,
    changes: {
      before: null,
      after: { count: result.length },
    },
    ipAddress,
  });

  return { data: result, count: result.length };
};

const getAllCoursesService = async ({
  department,
  level,
  session,
  semester,
}) => {
  const query = {};
  if (department) query.department = department;
  if (level) query.level = Number(level);
  if (session) query.session = session;
  if (semester) query.semester = semester;

  const courses = await Course.find(query).sort({
    department: 1,
    level: 1,
    code: 1,
  });
  return { data: courses };
};

const deleteCourseService = async ({ courseId, performedBy, ipAddress }) => {
  const course = await Course.findByIdAndDelete(courseId);
  if (!course) throw new Error("Course not found");

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "COURSE",
    targetId: courseId,
    description: `Course ${course.code} deleted`,
    changes: {
      before: { name: course.name, code: course.code, session: course.session },
      after: null,
    },
    ipAddress,
  });

  return { message: "Course deleted" };
};

module.exports = {
  getStudentCoursesService,
  createCourseService,
  createBulkCoursesService,
  getAllCoursesService,
  deleteCourseService,
};
