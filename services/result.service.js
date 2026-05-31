// NOTE: Before this works you need to add "RESULT" to the targetType enum
// in auditLog.model.js — it's not there yet.

const Result = require("../models/result.model");
const Student = require("../models/student.model");
const calculateGrade = require("../utils/resultCalculator");
const logAction = require("../utils/logAction");

const getStudentResultsService = async ({ userId, session, semester }) => {
  const query = { studentId: userId };
  if (session) query.session = session;
  if (semester) query.semester = semester;

  const results = await Result.find(query).sort({
    session: -1,
    semester: 1,
    courseCode: 1,
  });
  return { data: results };
};

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
  if (test > 40)
    throw new Error(`Test score for ${matricNumber} exceeds maximum of 30`);
  if (exam > 60)
    throw new Error(`Exam score for ${matricNumber} exceeds maximum of 70`);
  if (test < 0)
    throw new Error(`Test score for ${matricNumber} cannot be negative`);
  if (exam < 0)
    throw new Error(`Exam score for ${matricNumber} cannot be negative`);

  const student = await Student.findOne({ matricNumber });
  if (!student)
    throw new Error(`Student with matric number ${matricNumber} not found`);

  const total = test + exam;
  const grade = calculateGrade(total);

  const result = await Result.findOneAndUpdate(
    {
      studentId: student._id,
      courseCode: courseCode.toUpperCase(),
      session,
      semester,
    },
    { courseName, creditUnit, test, exam, total, grade },
    { upsert: true, new: true },
  );

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "RESULT",
    targetId: result._id,
    affectedStudent: student._id,
    description: `Result uploaded for ${matricNumber} — ${courseCode.toUpperCase()} (${session} ${semester})`,
    changes: {
      before: null,
      after: { test, exam, total, grade },
    },
    ipAddress,
  });

  return { data: result };
};

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
  const errors = [];

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
      if (testNum > 40) {
        errors.push({ matricNumber, reason: "Test score exceeds 40" });
        continue;
      }
      if (examNum > 60) {
        errors.push({ matricNumber, reason: "Exam score exceeds 60" });
        continue;
      }
      if (testNum < 0 || examNum < 0) {
        errors.push({ matricNumber, reason: "Scores cannot be negative" });
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
          studentId: student._id,
          courseCode: courseCode.toUpperCase(),
          session,
          semester: semester.toUpperCase(),
        },
        {
          courseName: courseName.toUpperCase(),
          creditUnit,
          test: testNum,
          exam: examNum,
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

  // Log once for the whole bulk upload rather than once per student
  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "RESULT",
    targetId: performedBy, // no single target — use the admin's own id as a stand-in
    description: `Bulk result upload for ${courseCode.toUpperCase()} (${session} ${semester}) — ${processed.length} saved, ${errors.length} failed`,
    changes: {
      before: null,
      after: { saved: processed.length, failed: errors.length },
    },
    ipAddress,
  });

  return {
    data: {
      processed,
      errors,
      summary: {
        total: results.length,
        saved: processed.length,
        failed: errors.length,
      },
    },
  };
};

const getAllResultsService = async ({ courseCode, session, semester }) => {
  const query = {};
  if (courseCode) query.courseCode = courseCode.toUpperCase();
  if (session) query.session = session;
  if (semester) query.semester = semester;

  const results = await Result.find(query)
    .populate("studentId", "matricNumber name department level")
    .sort({ courseCode: 1, session: -1 });

  return { data: results };
};

const deleteResultService = async ({ resultId, performedBy, ipAddress }) => {
  const result = await Result.findByIdAndDelete(resultId);
  if (!result) throw new Error("Result not found");

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "RESULT",
    targetId: resultId,
    affectedStudent: result.studentId,
    description: `Result deleted — ${result.courseCode} (${result.session} ${result.semester})`,
    changes: {
      before: { test: result.test, exam: result.exam, grade: result.grade },
      after: null,
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
  deleteResultService,
};
