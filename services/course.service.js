const Course = require("../models/course.model");
const Student = require("../models/student.model");
const Timetable = require("../models/timetable.model");
const TimetableCourse = require("../models/timetableCourse.model");
const logAction = require("../utils/logAction");
const { getActiveSession } = require("../utils/activeSession");

const getStudentCoursesService = async ({ userId, session, semester }) => {
  const student = await Student.findById(userId);
  if (!student) throw new Error("Student not found");

  if (!student.department || !student.level) {
    throw new Error(
      "Your profile is incomplete. Department or level is missing.",
    );
  }

  const query = {
    department: { $regex: new RegExp(`^${student.department}$`, "i") },
    level: student.level,
  };
  if (session) query.session = session;
  if (semester) query.semester = semester;

  const timetableEntries = await Timetable.find(query).select({
    courseCode: 1,
    courseName: 1,
    creditUnit: 1,
    lecturer: 1,
    lecturerPhone: 1,
    department: 1,
    level: 1,
    session: 1,
    semester: 1,
  }).sort({
    day: 1,
    time: 1,
  });

  // Get all course codes from timetable entries
  const courseCodes = [...new Set(timetableEntries.map(e => e.courseCode))];

  // Fetch course details from TimetableCourse
  const courseDetailsMap = new Map();
  if (courseCodes.length > 0) {
    const courseQuery = {
      courseCode: { $in: courseCodes },
    };
    if (session) courseQuery.session = session;
    if (semester) courseQuery.semester = semester;

    const timetableCourses = await TimetableCourse.find(courseQuery);
    for (const course of timetableCourses) {
      courseDetailsMap.set(course.courseCode, course);
    }
  }

  // Extract unique courses from timetable entries with details from TimetableCourse
  const courseMap = new Map();

  for (const entry of timetableEntries) {
    if (!courseMap.has(entry.courseCode)) {
      const courseDetails = courseDetailsMap.get(entry.courseCode);
      
      // Start with entry data, then override with courseDetails if available
      const mergedCourse = {
        courseCode: entry.courseCode || courseDetails?.courseCode,
        courseName: entry.courseName || courseDetails?.courseName,
        creditUnit: entry.creditUnit,
        lecturer: entry.lecturer,
        lecturerPhone: entry.lecturerPhone,
        department: entry.department,
        level: entry.level,
        session: entry.session,
        semester: entry.semester,
      };

      // Override with courseDetails if available
      if (courseDetails) {
        if (courseDetails.creditUnit !== null && courseDetails.creditUnit !== undefined) {
          mergedCourse.creditUnit = courseDetails.creditUnit;
        }
        if (courseDetails.lecturerPhone !== null && courseDetails.lecturerPhone !== undefined) {
          mergedCourse.lecturerPhone = courseDetails.lecturerPhone;
        }
        if (courseDetails.lecturer) {
          mergedCourse.lecturer = courseDetails.lecturer;
        }
        if (courseDetails.courseName) {
          mergedCourse.courseName = courseDetails.courseName;
        }
      }

      courseMap.set(entry.courseCode, mergedCourse);
    }
  }

  const uniqueCourses = [];
  for (const entry of courseMap.values()) {
    uniqueCourses.push({
      code: entry.courseCode,
      name: entry.courseName,
      creditUnit: entry.creditUnit,
      lecturer: entry.lecturer,
      lecturerPhone: entry.lecturerPhone,
      department: entry.department,
      level: entry.level,
      session: entry.session,
      semester: entry.semester,
    });
  }

  console.log('uniqueCourses:', JSON.stringify(uniqueCourses, null, 2));
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
