// NOTE: Add "RESULT" to the targetType enum in auditLog.model.js if not done yet.

const Result         = require("../models/result.model");
const Student        = require("../models/student.model");
const calculateGrade = require("../utils/resultCalculator");
const logAction      = require("../utils/logAction");

// ── STUDENT: view own results ─────────────────────────────────────────────────
const getStudentResultsService = async ({ userId, session, semester }) => {
  const query = { studentId: userId };
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
  // ── Validation ────────────────────────────────────────────────────────────
  if (test  < 0 || test  > 40) throw new Error(`Test score for ${matricNumber} must be between 0 and 40`);
  if (exam  < 0 || exam  > 60) throw new Error(`Exam score for ${matricNumber} must be between 0 and 60`);

  const student = await Student.findOne({ matricNumber });
  if (!student) throw new Error(`Student with matric number ${matricNumber} not found`);

  const total = test + exam;
  const grade = calculateGrade(total);

  const result = await Result.findOneAndUpdate(
    {
      studentId:  student._id,
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
          studentId:  student._id,
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
    studentId: student._id,
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
    affectedStudent: result.studentId,
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
    affectedStudent: result.studentId,
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
  getAllResultsService,
  getResultsByStudentService,
  updateResultService,
  deleteResultService,
};