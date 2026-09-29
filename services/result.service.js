// NOTE: Add "RESULT" to the targetType enum in auditLog.model.js if not done yet.

const Result         = require("../models/result.model");
const Student        = require("../models/student.model");
const TimetableCourse = require("../models/timetableCourse.model");
const calculateGrade = require("../utils/resultCalculator");
const logAction      = require("../utils/logAction");
const { getActiveSession } = require("../utils/activeSession");
const AppError       = require("../utils/appError");
const {
  getTimetableCoursesForStudent,
  buildStudentQueriesForTargets,
} = require("../utils/studentCourseResolver");

// ── STUDENT: view own results (all enrolled courses + grades where uploaded) ──
const getStudentResultsService = async ({ userId, session, semester }) => {
  const student = await Student.findById(userId);
  if (!student) throw new AppError("Student not found", 404);

  const enrolledCourses = await getTimetableCoursesForStudent(student, {
    session,
    semester,
  });

  const resultQuery = { student: userId };
  if (session) resultQuery.session = session;
  if (semester) resultQuery.semester = semester;

  const results = await Result.find(resultQuery).sort({
    session: -1,
    semester: 1,
    courseCode: 1,
  });

  const key = r => `${r.courseCode.toUpperCase()}|${r.session}|${r.semester}`;
  const mergedMap = new Map(results.map(r => [key(r), r]));
  for (const course of enrolledCourses) {
    if (!mergedMap.has(key(course))) mergedMap.set(key(course), {
      student: userId, courseCode: course.courseCode, courseName: course.courseName,
      creditUnit: course.creditUnit, test: null, exam: null, total: null, grade: null,
      session: course.session, semester: course.semester, pending: true,
    });
  }
  const merged = [...mergedMap.values()].sort((a,b) => b.session.localeCompare(a.session) || a.courseCode.localeCompare(b.courseCode));
  const enrolledKeys = new Set(enrolledCourses.map(key));
  const withResults = results.filter(r => enrolledKeys.has(key(r))).length;

  return {
    data: merged.map(r=>({ _id:r._id,courseCode:r.courseCode,courseName:r.courseName,creditUnit:r.creditUnit,grade:r.grade,session:r.session,semester:r.semester,pending:Boolean(r.pending),outcome:r.outcome||'graded' })),
    summary: {
      totalCourses: enrolledCourses.length,
      withResults,
      pending: enrolledCourses.length - withResults,
    },
  };
};

// ── TIMETABLE ADMIN: upload single result ─────────────────────────────────────
const validScore = (value, maximum, label) => {
  if (value === '' || value == null || typeof value === 'boolean' || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > maximum) throw new AppError(`${label} must be a number from 0 to ${maximum}`, 400);
  return Number(value);
};
const uploadSingleResultService = async (input) => {
  let { matricNumber, courseCode, session, semester, performedBy, ipAddress } = input;
  if (!session || !semester) { const active = await getActiveSession(); session ||= active.session; semester ||= active.semester; }
  const test = validScore(input.test, 40, 'Test');
  const exam = validScore(input.exam, 60, 'Exam');
  if (!courseCode || !matricNumber) throw new AppError('Course code and matric number are required', 400);
  courseCode = String(courseCode).trim().toUpperCase();
  const student = await Student.findOne({ matricNumber: String(matricNumber).trim().toUpperCase(), status: { $ne: 'archived' } });
  if (!student) throw new AppError('Student not found', 404);
  const enrolled = await getTimetableCoursesForStudent(student, { session, semester });
  const course = enrolled.find(c => c.courseCode.toUpperCase() === courseCode);
  if (!course) throw new AppError('Student is not enrolled for this course and semester', 400);
  if (!(course.creditUnit > 0)) throw new AppError('Set the course credit units before uploading results', 400);
  const filter = { student: student.id, courseCode, session, semester };
  const before = await Result.findOne(filter).lean();
  if(before?.sourceSheet)throw new AppError('Use the academic score-sheet correction workflow for lecturer-submitted results',409);
  const total = test + exam;
  const data = await Result.findOneAndUpdate(filter, { $set: { courseName: course.courseName, creditUnit: course.creditUnit, test, exam, total, grade: calculateGrade(total) } }, { upsert: true, new: true, runValidators: true });
  await logAction({ performedBy, ipAddress, action: before ? 'UPDATE' : 'CREATE', targetType: 'RESULT', targetId: data.id, affectedStudent: student.id, description: `Result saved: ${courseCode}, ${session} ${semester}`, changes: { before, after: data.toObject() } });
  return { data };
};
const uploadBulkResultsJSONService = async ({ results, performedBy, ipAddress }) => {
  if (!Array.isArray(results) || !results.length || results.length > 2000) throw new AppError('Upload 1 to 2000 result rows at a time', 400);
  const processed = [], errors = [], seen = new Set();
  for (const [index, row] of results.entries()) {
    try {
      const key = `${String(row.matricNumber).trim().toUpperCase()}|${String(row.courseCode).trim().toUpperCase()}|${row.session}|${row.semester}`;
      if (seen.has(key)) throw new AppError('Duplicate result row in this upload', 400);
      seen.add(key);
      const { data } = await uploadSingleResultService({ ...row, performedBy, ipAddress });
      processed.push({ matricNumber: row.matricNumber, total: data.total, grade: data.grade, id: data.id });
    } catch (error) { errors.push({ row: index + 1, matricNumber: row.matricNumber, reason: error.message }); }
  }
  return { data: { processed, errors, summary: { total: results.length, saved: processed.length, failed: errors.length } } };
};
const uploadBulkResultsService = ({ results, courseCode, session, semester, performedBy, ipAddress }) => uploadBulkResultsJSONService({ results: results.map(row => ({ ...row, courseCode, session, semester })), performedBy, ipAddress });

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

  // Build student query based on course targets (faculty targets expand to all departments)
  const studentQueries = await buildStudentQueriesForTargets(course.targets);

  if (studentQueries.length === 0) {
    throw new AppError("No targets set for this course", 400);
  }

  // Find students matching any of the target queries
  const Enrollment = require('../models/enrollment.model');
  const snapshots = await Enrollment.find({session,semester});
  const enrolled = await Enrollment.find({session,semester,$or:studentQueries});
  const students = await Student.find({status:{$ne:'archived'},$or:[
    {_id:{$in:enrolled.map(e=>e.student)}},
    {_id:{$nin:snapshots.map(e=>e.student)},$or:studentQueries}
  ]}).select("_id name matricNumber department level");

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
      test: result?.test ?? null,
      exam: result?.exam ?? null,
      total: result?.total ?? null,
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
  if(result.sourceSheet)throw new AppError("Use the academic score-sheet correction workflow for lecturer-submitted results",409);

  const before = { test: result.test, exam: result.exam, total: result.total, grade: result.grade };

  if (test !== undefined && test !== null) {
    const t = Number(test);
    if (test === '' || !Number.isFinite(t) || t < 0 || t > 40) throw new AppError("Test score must be between 0 and 40",400);
    result.test = t;
  }
  if (exam !== undefined && exam !== null) {
    const e = Number(exam);
    if (exam === '' || !Number.isFinite(e) || e < 0 || e > 60) throw new AppError("Exam score must be between 0 and 60",400);
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
  const result = await Result.findById(resultId);
  if (!result) throw new Error("Result not found");
  if(result.sourceSheet)throw new AppError("Use the academic score-sheet correction workflow for lecturer-submitted results",409);

  await result.deleteOne();
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

// ── ADMIN: fix existing results with correct courseName and creditUnit ───────────
const fixExistingResultsService = async ({ performedBy, ipAddress }) => {
  const results = await Result.find({});

  let fixed = 0;
  let errors = 0;

  for (const result of results) {
    try {
      const courseDetails = await TimetableCourse.findOne({
        courseCode: result.courseCode.toUpperCase(),
        session: result.session, semester: result.semester,
      });

      if (courseDetails) {
        await Result.findByIdAndUpdate(result._id, {
          courseName: courseDetails.courseName,
          creditUnit: courseDetails.creditUnit,
        });
        fixed++;
      }
    } catch (err) {
      errors++;
    }
  }

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "RESULT",
    targetId: performedBy,
    description: `Fixed ${fixed} results with correct courseName and creditUnit, ${errors} errors`,
    changes: {
      before: null,
      after: { fixed, errors },
    },
    ipAddress,
  });

  return { data: { fixed, errors, total: results.length } };
};

module.exports = {
  getStudentResultsService,
  uploadSingleResultService,
  uploadBulkResultsService,
  uploadBulkResultsJSONService,
  getStudentsForCourseService,
  getAllResultsService,
  getResultsByStudentService,
  updateResultService,
  deleteResultService,
  fixExistingResultsService,
};
