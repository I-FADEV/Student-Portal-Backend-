// NOTE: Add "RESULT" to the targetType enum in auditLog.model.js if not done yet.

const Result         = require("../models/result.model");
const Student        = require("../models/student.model");
const TimetableCourse = require("../models/timetableCourse.model");
const calculateGrade = require("../utils/resultCalculator");
const logAction      = require("../utils/logAction");
const { getActiveSession } = require("../utils/activeSession");

// ── STUDENT: view own results ─────────────────────────────────────────────────
const getStudentResultsService = async ({ userId, session, semester }) => {
  const query = { student: userId };
  if (session)  query.session  = session;
  if (semester) query.semester = semester;

  const results = await Result.find(query).sort({
    session: -1, semester: 1, courseCode: 1,
  });
  return { data: results };
};

// ── TIMETABLE ADMIN: upload single result ─────────────────────────────────────
const uploadSingleResultService = async ({
  matricNumber,
  courseCode,
  courseName,
  creditUnit,
  test,
  exam,
  session,
  semester,
  performedBy,
  ipAddress,
}) => {
  // Auto-fetch active session if not provided
  if (!session || !semester) {
    const activeSession = await getActiveSession();
    session = session || activeSession.session;
    semester = semester || activeSession.semester;
  }

  // ── Validation ────────────────────────────────────────────────────────────
  if (test  < 0 || test  > 40) throw new Error(`Test score for ${matricNumber} must be between 0 and 40`);
  if (exam  < 0 || exam  > 60) throw new Error(`Exam score for ${matricNumber} must be between 0 and 60`);

  const student = await Student.findOne({ matricNumber });
  if (!student) throw new Error(`Student with matric number ${matricNumber} not found`);

  const total = test + exam;
  const grade = calculateGrade(total);

  const result = await Result.findOneAndUpdate(
    {
      student:  student._id,
      courseCode: courseCode.toUpperCase(),
      session,
      semester,
    },
    { courseName, creditUnit, test, exam, total, grade },
    { upsert: true, new: true },
  );

  await logAction({
    performedBy,
    action:          "CREATE",
    targetType:      "RESULT",
    targetId:        result._id,
    affectedStudent: student._id,
    description:     `Result uploaded for ${matricNumber} — ${courseCode.toUpperCase()} (${session} ${semester})`,
    changes: {
      before: null,
      after:  { test, exam, total, grade },
    },
    ipAddress,
  });

  return { data: result };
};

// ── TIMETABLE ADMIN: bulk upload results ──────────────────────────────────────
const uploadBulkResultsService = async ({
  results,
  courseCode,
  courseName,
  creditUnit,
  session,
  semester,
  performedBy,
  ipAddress,
}) => {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Results must be a non-empty array");
  }

  // Auto-fetch active session if not provided
  if (!session || !semester) {
    const activeSession = await getActiveSession();
    session = session || activeSession.session;
    semester = semester || activeSession.semester;
  }

  const processed = [];
  const errors    = [];

  for (const row of results) {
    try {
      const { matricNumber, test, exam } = row;

      if (!matricNumber) {
        errors.push({ row, reason: "Missing matric number" });
        continue;
      }

      const testNum = Number(test);
      const examNum = Number(exam);

      if (isNaN(testNum) || isNaN(examNum)) {
        errors.push({ matricNumber, reason: "Invalid score format" });
        continue;
      }
      if (testNum < 0 || testNum > 40) {
        errors.push({ matricNumber, reason: "Test score must be between 0 and 40" });
        continue;
      }
      if (examNum < 0 || examNum > 60) {
        errors.push({ matricNumber, reason: "Exam score must be between 0 and 60" });
        continue;
      }

      const student = await Student.findOne({ matricNumber });
      if (!student) {
        errors.push({ matricNumber, reason: "Student not found" });
        continue;
      }

      const total = testNum + examNum;
      const grade = calculateGrade(total);

      const saved = await Result.findOneAndUpdate(
        {
          student:  student._id,
          courseCode: courseCode.toUpperCase(),
          session,
          semester,                   // ← FIX: was semester.toUpperCase() which corrupted "First"→"FIRST"
        },
        {
          courseName: courseName,
          creditUnit,
          test:  testNum,
          exam:  examNum,
          total,
          grade,
        },
        { upsert: true, new: true },
      );

      processed.push({ matricNumber, total, grade, id: saved._id });
    } catch (err) {
      errors.push({ row, reason: err.message });
    }
  }

  await logAction({
    performedBy,
    action:      "CREATE",
    targetType:  "RESULT",
    targetId:    performedBy,
    description: `Bulk result upload for ${courseCode.toUpperCase()} (${session} ${semester}) — ${processed.length} saved, ${errors.length} failed`,
    changes: {
      before: null,
      after:  { saved: processed.length, failed: errors.length },
    },
    ipAddress,
  });

  return {
    data: {
      processed,
      errors,
      summary: {
        total:  results.length,
        saved:  processed.length,
        failed: errors.length,
      },
    },
  };
};

// ── TIMETABLE ADMIN: get students for manual result entry (based on course targets) ─
const getStudentsForCourseService = async ({ courseCode, session, semester }) => {
  if (!courseCode || !session || !semester) {
    throw new AppError("courseCode, session, and semester are required", 400);
  }

  // Get course details from TimetableCourse
  const course = await TimetableCourse.findOne({
    courseCode: courseCode.toUpperCase(),
    session,
    semester,
  });

  if (!course) {
    throw new AppError(`Course ${courseCode.toUpperCase()} not found for ${session} ${semester}`, 404);
  }

  // Build student query based on course targets
  const studentQueries = [];

  for (const target of course.targets) {
    if (target.type === "department") {
      studentQueries.push({
        department: { $regex: new RegExp(`^${target.name}$`, "i") },
        level: target.level,
      });
    } else if (target.type === "faculty") {
      studentQueries.push({
        faculty: { $regex: new RegExp(`^${target.name}$`, "i") },
        level: target.level,
      });
    }
  }

  if (studentQueries.length === 0) {
    throw new AppError("No targets set for this course", 400);
  }

  // Find students matching any of the target queries
  const students = await Student.find({
    $or: studentQueries,
  }).select("_id name matricNumber department level");

  if (!students.length) {
    throw new AppError("No students found for this course. Check course targets are set correctly.", 404);
  }

  // Get existing results for these students
  const studentIds = students.map(s => s._id);
  const existingResults = await Result.find({
    student: { $in: studentIds },
    courseCode: courseCode.toUpperCase(),
    session,
    semester,
  });

  // Create a map of studentId -> result
  const resultMap = new Map();
  for (const result of existingResults) {
    resultMap.set(result.student.toString(), result);
  }

  // Combine student data with existing results
  const studentsWithResults = students.map(student => {
    const result = resultMap.get(student._id.toString());
    return {
      _id: student._id,
      name: student.name,
      matric: student.matricNumber,
      matricNumber: student.matricNumber,
      department: student.department,
      level: student.level,
      test: result?.test || 0,
      exam: result?.exam || 0,
      total: result?.total || 0,
      grade: result?.grade || null,
      resultId: result?._id || null,
    };
  });

  return { data: studentsWithResults };
};

// ── TIMETABLE ADMIN: get all results (filter by course/session/semester) ──────
const getAllResultsService = async ({ courseCode, session, semester }) => {
  const query = {};
  if (courseCode) query.courseCode = courseCode.toUpperCase();
  if (session)    query.session    = session;
  if (semester)   query.semester   = semester;

  const results = await Result.find(query)
    .populate("student", "matricNumber name department level")
    .sort({ courseCode: 1, session: -1 });

  return { data: results };
};

// ── TIMETABLE ADMIN: get results for a specific student (admin search) ────────
const getResultsByStudentService = async ({ query, session, semester }) => {
  if (!query) {
    throw new Error("Search query is required");
  }

  const student = await Student.findOne({
    $or: [
      { matricNumber: { $regex: query, $options: "i" } },
      { name: { $regex: query, $options: "i" } },
    ],
  });

  if (!student) {
    throw new Error(`Student "${query}" not found`);
  }

  const resultQuery = {
    student: student._id,
  };

  if (session) resultQuery.session = session;
  if (semester) resultQuery.semester = semester;

  const results = await Result.find(resultQuery).sort({
    courseCode: 1,
  });

  return {
    data: results,
    student: {
      _id: student._id,
      name: student.name,
      matricNumber: student.matricNumber,
      department: student.department,
      level: student.level,
    },
  };
};

// ── TIMETABLE ADMIN: update a single result ───────────────────────────────────
const updateResultService = async ({
  resultId,
  test,
  exam,
  performedBy,
  ipAddress,
}) => {
  const result = await Result.findById(resultId);
  if (!result) throw new Error("Result not found");

  const before = { test: result.test, exam: result.exam, total: result.total, grade: result.grade };

  if (test !== undefined && test !== null) {
    const t = Number(test);
    if (isNaN(t) || t < 0 || t > 40) throw new Error("Test score must be between 0 and 40");
    result.test = t;
  }
  if (exam !== undefined && exam !== null) {
    const e = Number(exam);
    if (isNaN(e) || e < 0 || e > 60) throw new Error("Exam score must be between 0 and 60");
    result.exam = e;
  }

  result.total = result.test + result.exam;
  result.grade = calculateGrade(result.total);

  await result.save();

  await logAction({
    performedBy,
    action:          "UPDATE",
    targetType:      "RESULT",
    targetId:        resultId,
    affectedStudent: result.student,
    description:     `Result updated — ${result.courseCode} (${result.session} ${result.semester})`,
    changes: {
      before,
      after: { test: result.test, exam: result.exam, total: result.total, grade: result.grade },
    },
    ipAddress,
  });

  return { data: result };
};

// ── TIMETABLE ADMIN: delete a result ─────────────────────────────────────────
const deleteResultService = async ({ resultId, performedBy, ipAddress }) => {
  const result = await Result.findByIdAndDelete(resultId);
  if (!result) throw new Error("Result not found");

  await logAction({
    performedBy,
    action:          "DELETE",
    targetType:      "RESULT",
    targetId:        resultId,
    affectedStudent: result.student,
    description:     `Result deleted — ${result.courseCode} (${result.session} ${result.semester})`,
    changes: {
      before: { test: result.test, exam: result.exam, grade: result.grade },
      after:  null,
    },
    ipAddress,
  });

  return { message: "Result deleted" };
};

module.exports = {
  getStudentResultsService,
  uploadSingleResultService,
  uploadBulkResultsService,
  getStudentsForCourseService,
  getAllResultsService,
  getResultsByStudentService,
  updateResultService,
  deleteResultService,
};