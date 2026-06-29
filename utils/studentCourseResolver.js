const Department = require("../models/department.model");
const Faculty = require("../models/faculty.model");
const TimetableCourse = require("../models/timetableCourse.model");

/** Case-insensitive exact string match for MongoDB queries */
const caseInsensitiveExact = (value) => ({
  $regex: new RegExp(`^${String(value).trim()}$`, "i"),
});

/**
 * Resolve a student's faculty name.
 * Uses student.faculty when set, otherwise looks up the department in the registry.
 */
const resolveStudentFaculty = async (student) => {
  if (student.faculty) {
    return String(student.faculty).trim();
  }
  if (!student.department) return null;

  const department = await Department.findOne({
    name: caseInsensitiveExact(student.department),
  }).populate("faculty", "name");

  return department?.faculty?.name?.trim() || null;
};

/**
 * Resolve faculty name from a department name via the registry.
 */
const resolveFacultyFromDepartment = async (departmentName) => {
  if (!departmentName) return null;

  const department = await Department.findOne({
    name: caseInsensitiveExact(departmentName),
  }).populate("faculty", "name");

  return department?.faculty?.name?.trim() || null;
};

/**
 * Get all department names that belong to a faculty.
 */
const getDepartmentsInFaculty = async (facultyName) => {
  const faculty = await Faculty.findOne({
    name: caseInsensitiveExact(facultyName),
  });
  if (!faculty) return [];

  const departments = await Department.find({ faculty: faculty._id }).select("name");
  return departments.map((d) => d.name);
};

/**
 * Build $or clauses for TimetableCourse targets matching a student
 * (department courses + faculty-wide courses).
 */
const buildStudentCourseTargetQuery = (student, facultyName) => {
  const level = Number(student.level);
  const orClauses = [
    {
      targets: {
        $elemMatch: {
          type: "department",
          name: caseInsensitiveExact(student.department),
          level,
        },
      },
    },
  ];

  if (facultyName) {
    orClauses.push({
      targets: {
        $elemMatch: {
          type: "faculty",
          name: caseInsensitiveExact(facultyName),
          level,
        },
      },
    });
  }

  return orClauses;
};

/**
 * Find all TimetableCourse records a student should take
 * (their department courses + faculty-wide courses).
 */
const getTimetableCoursesForStudent = async (student, { session, semester }) => {
  const { department, level } = student;
  let { faculty } = student;

  if (!department || level == null) return [];

  // student.faculty can be null if not set at registration —
  // resolve it from the department registry the same way generation does.
  if (!faculty) {
    faculty = await resolveFacultyFromDepartment(department);
  }

  const levelNum = Number(level);
  const orClauses = [];

  // 1️⃣ Departmental courses — only this student's own department
  orClauses.push({
    targets: {
      $elemMatch: {
        type: "department",
        name: caseInsensitiveExact(department),
        level: levelNum,
      },
    },
  });

  // 2️⃣ Faculty-wide courses — shared across all depts in the faculty
  if (faculty) {
    orClauses.push({
      targets: {
        $elemMatch: {
          type: "faculty",
          name: caseInsensitiveExact(faculty),
          level: levelNum,
        },
      },
    });
  }

  const query = { $or: orClauses };
  if (session)  query.session  = session;
  if (semester) query.semester = semester;

  return TimetableCourse.find(query);
};

/**
 * Build student $or queries from TimetableCourse targets.
 * Faculty targets expand to every department under that faculty.
 */
const buildStudentQueriesForTargets = async (targets) => {
  const studentQueries = [];

  for (const target of targets) {
    const level = Number(target.level);

    if (target.type === "department") {
      studentQueries.push({
        department: caseInsensitiveExact(target.name),
        level,
      });
      continue;
    }

    if (target.type === "faculty") {
      const deptNames = await getDepartmentsInFaculty(target.name);
      for (const deptName of deptNames) {
        studentQueries.push({
          department: caseInsensitiveExact(deptName),
          level,
        });
      }
      // Also match students with faculty set directly on their profile
      studentQueries.push({
        faculty: caseInsensitiveExact(target.name),
        level,
      });
    }
  }

  return studentQueries;
};

module.exports = {
  caseInsensitiveExact,
  resolveStudentFaculty,
  resolveFacultyFromDepartment,
  getDepartmentsInFaculty,
  buildStudentCourseTargetQuery,
  getTimetableCoursesForStudent,
  buildStudentQueriesForTargets,
};