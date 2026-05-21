const Result = require("../models/result.model");
const Student = require("../models/student.model"); // adjust path if needed

// ── STUDENT: view own results ─────────────────────────────────────────────────
const getStudentResultsService = async ({ userId, session, semester }) => {
  const query = { studentId: userId };
  if (session)  query.session  = session;
  if (semester) query.semester = semester;

  const results = await Result.find(query).sort({ session: -1, semester: 1, courseCode: 1 });
  return { data: results };
};

// ── ADMIN: upload results for a single student ────────────────────────────────
const uploadSingleResultService = async ({
  matricNumber,
  courseCode,
  courseName,
  creditUnit,
  test,
  exam,
  session,
  semester,
}) => {
  // Validate score ranges
  if (test  > 30) throw new Error(`Test score for ${matricNumber} exceeds maximum of 30`);
  if (exam  > 70) throw new Error(`Exam score for ${matricNumber} exceeds maximum of 70`);
  if (test  < 0)  throw new Error(`Test score for ${matricNumber} cannot be negative`);
  if (exam  < 0)  throw new Error(`Exam score for ${matricNumber} cannot be negative`);

  // Find the student by matric number
  const student = await Student.findOne({ matricNumber });
  if (!student) throw new Error(`Student with matric number ${matricNumber} not found`);

  const total = test + exam;
  const grade = Result.calculateGrade(total);

  // Upsert — update if result exists for same student+course+session+semester
  const result = await Result.findOneAndUpdate(
    { studentId: student._id, courseCode: courseCode.toUpperCase(), session, semester },
    { courseName, creditUnit, test, exam, total, grade },
    { upsert: true, new: true }
  );

  return { data: result };
};

// ── ADMIN: bulk upload results from an array (parsed Excel rows) ──────────────
const uploadBulkResultsService = async ({ results, courseCode, courseName, creditUnit, session, semester }) => {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Results must be a non-empty array");
  }

  const processed  = [];
  const errors     = [];

  for (const row of results) {
    try {
      const { matricNumber, test, exam } = row;

      if (!matricNumber) { errors.push({ row, reason: "Missing matric number" }); continue; }

      const testNum = Number(test);
      const examNum = Number(exam);

      if (isNaN(testNum) || isNaN(examNum)) { errors.push({ matricNumber, reason: "Invalid score format" }); continue; }
      if (testNum > 30)  { errors.push({ matricNumber, reason: "Test score exceeds 30" }); continue; }
      if (examNum > 70)  { errors.push({ matricNumber, reason: "Exam score exceeds 70" }); continue; }
      if (testNum < 0 || examNum < 0) { errors.push({ matricNumber, reason: "Scores cannot be negative" }); continue; }

      const student = await Student.findOne({ matricNumber });
      if (!student) { errors.push({ matricNumber, reason: "Student not found" }); continue; }

      const total = testNum + examNum;
      const grade = Result.calculateGrade(total);

      const saved = await Result.findOneAndUpdate(
        { studentId: student._id, courseCode: courseCode.toUpperCase(), session, semester },
        { courseName, creditUnit, test: testNum, exam: examNum, total, grade },
        { upsert: true, new: true }
      );

      processed.push({ matricNumber, total, grade, id: saved._id });
    } catch (err) {
      errors.push({ row, reason: err.message });
    }
  }

  return {
    data: { processed, errors, summary: { total: results.length, saved: processed.length, failed: errors.length } },
  };
};

// ── ADMIN: view all results (filter by course / session / semester) ────────────
const getAllResultsService = async ({ courseCode, session, semester }) => {
  const query = {};
  if (courseCode) query.courseCode = courseCode.toUpperCase();
  if (session)    query.session    = session;
  if (semester)   query.semester   = semester;

  const results = await Result.find(query)
    .populate("studentId", "matricNumber name department level")
    .sort({ courseCode: 1, session: -1 });

  return { data: results };
};

// ── ADMIN: delete a result ─────────────────────────────────────────────────────
const deleteResultService = async ({ resultId }) => {
  const result = await Result.findByIdAndDelete(resultId);
  if (!result) throw new Error("Result not found");
  return { message: "Result deleted" };
};

module.exports = {
  getStudentResultsService,
  uploadSingleResultService,
  uploadBulkResultsService,
  getAllResultsService,
  deleteResultService,
};