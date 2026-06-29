const Course = require("../models/course.model");
const Student = require("../models/student.model");
const Timetable = require("../models/timetable.model");
const logAction = require("../utils/logAction");
const { getActiveSession } = require("../utils/activeSession");
const AppError = require("../utils/appError");
const { getTimetableCoursesForStudent } = require("../utils/studentCourseResolver");

const getStudentCoursesService = async ({ userId, session, semester }) => {
  const student = await Student.findById(userId);
  if (!student) throw new AppError("Student not found", 404);

  if (!student.department || student.level == null) {
    throw new AppError(
      "Your profile is incomplete. Department or level is missing.",
      400,
    );
  }

  const timetableCourses = await getTimetableCoursesForStudent(student, {
    session,
    semester,
  });

  if (timetableCourses.length === 0) return { data: [] };

  // ── Split into dept courses vs faculty courses ──────────────────────────────
  const { resolveFacultyFromDepartment } = require("../utils/studentCourseResolver");
  const resolvedFaculty = await resolveFacultyFromDepartment(student.department);

  const facultyCourseCodes = new Set();
  const deptCourseCodes = new Set();

  for (const tc of timetableCourses) {
    const isFaculty = tc.targets.some(
      (t) =>
        t.type === "faculty" &&
        resolvedFaculty &&
        t.name.toLowerCase() === resolvedFaculty.toLowerCase() &&
        Number(t.level) === Number(student.level),
    );
    if (isFaculty) {
      facultyCourseCodes.add(tc.courseCode.toUpperCase());
    } else {
      deptCourseCodes.add(tc.courseCode.toUpperCase());
    }
  }

  // ── Build filtered timetable query ─────────────────────────────────────────
  // Dept courses: strictly this student's own department
  // Faculty courses: any entry (we'll stamp the student's dept on them below)
  const orClauses = [];

  if (deptCourseCodes.size > 0) {
    const deptClause = {
      courseCode: { $in: [...deptCourseCodes] },
      department: { $regex: new RegExp(`^${student.department}$`, "i") },
      level: Number(student.level),
    };
    if (session) deptClause.session = session;
    if (semester) deptClause.semester = semester;
    orClauses.push(deptClause);
  }

  if (facultyCourseCodes.size > 0) {
    const facultyClause = {
      courseCode: { $in: [...facultyCourseCodes] },
      level: Number(student.level),
    };
    if (session) facultyClause.session = session;
    if (semester) facultyClause.semester = semester;
    orClauses.push(facultyClause);
  }

  // Build a lookup map from TimetableCourse catalog (source of truth for
  // creditUnit, lecturer, lecturerPhone, courseName)
  const courseDetailsMap = new Map();
  for (const course of timetableCourses) {
    courseDetailsMap.set(course.courseCode.toUpperCase(), course);
  }

  const courseMap = new Map();

  // ── Process scheduled entries ──────────────────────────────────────────────
  if (orClauses.length > 0) {
    const timetableEntries = await Timetable.find({ $or: orClauses })
      .select({
        courseCode: 1,
        courseName: 1,
        creditUnit: 1,
        lecturer: 1,
        lecturerPhone: 1,
        department: 1,
        level: 1,
        session: 1,
        semester: 1,
      })
      .sort({ day: 1, time: 1 });

    for (const entry of timetableEntries) {
      const codeKey = entry.courseCode.toUpperCase();
      if (courseMap.has(codeKey)) continue; // already picked one entry

      const courseDetails = courseDetailsMap.get(codeKey);

      // For faculty courses, always stamp the student's own department —
      // never the entry's raw department (which could be Biochemistry etc.)
      const isFacultyCourse = facultyCourseCodes.has(codeKey);
      const department = isFacultyCourse
        ? student.department
        : entry.department;

      courseMap.set(codeKey, {
        courseCode:    courseDetails?.courseCode  || entry.courseCode,
        courseName:    courseDetails?.courseName  || entry.courseName,
        creditUnit:    courseDetails?.creditUnit  ?? entry.creditUnit,
        lecturer:      courseDetails?.lecturer    || entry.lecturer,
        lecturerPhone: courseDetails?.lecturerPhone || entry.lecturerPhone,
        department,
        level:    Number(student.level),
        session:  entry.session,
        semester: entry.semester,
      });
    }
  }

  // ── Unscheduled courses (in catalog but not yet on timetable) ──────────────
  for (const course of timetableCourses) {
    const codeKey = course.courseCode.toUpperCase();
    if (courseMap.has(codeKey)) continue;

    courseMap.set(codeKey, {
      courseCode:    course.courseCode,
      courseName:    course.courseName,
      creditUnit:    course.creditUnit,
      lecturer:      course.lecturer,
      lecturerPhone: course.lecturerPhone,
      department:    student.department, // always the student's own dept
      level:         Number(student.level),
      session:       course.session,
      semester:      course.semester,
    });
  }

  const uniqueCourses = [...courseMap.values()].map((entry) => ({
    code:          entry.courseCode,
    name:          entry.courseName,
    creditUnit:    entry.creditUnit,
    lecturer:      entry.lecturer,
    lecturerPhone: entry.lecturerPhone,
    department:    entry.department,
    level:         entry.level,
    session:       entry.session,
    semester:      entry.semester,
  }));

  return { data: uniqueCourses };
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
  // Auto-fetch active session if not provided
  if (!session || !semester) {
    const activeSession = await getActiveSession();
    session = session || activeSession.session;
    semester = semester || activeSession.semester;
  }

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
    department: department.trim().toUpperCase(),
    level: Number(level),
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
    description: `Course ${code.toUpperCase()} created for ${department.trim().toUpperCase()} level ${Number(level)} (${session} ${semester})`,
    changes: {
      before: null,
      after: { name, code, creditUnit, department: department.trim().toUpperCase(), level: Number(level), session, semester },
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
    department: c.department.trim().toUpperCase(),
    level: Number(c.level),
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
  if (department) query.department = { $regex: new RegExp(`^${department}$`, "i") };
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
