const Timetable = require("../models/timetable.model"); 
const Student = require("../models/student.model"); // adjust path if needed

// ── STUDENT: get own timetable by dept + level ───────────────────────────────
const getStudentTimetableService = async ({ userId, session, semester }) => {
  // Look up the student to get their department and level
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

  const timetable = await Timetable.find(query).sort({ day: 1, time: 1 });

  return { data: timetable };
};

// ── ADMIN: create a single timetable entry ───────────────────────────────────
const createTimetableEntryService = async ({
  day,
  time,
  courseCode,
  courseName,
  venue,
  lecturer,
  department,
  level,
  session,
  semester,
}) => {
  const entry = await Timetable.create({
    day,
    time,
    courseCode,
    courseName,
    venue,
    lecturer,
    department,
    level,
    session,
    semester,
  });

  return { data: entry };
};

// ── ADMIN: create multiple timetable entries at once ─────────────────────────
const createBulkTimetableService = async ({ entries }) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Entries must be a non-empty array");
  }

  const result = await Timetable.insertMany(entries);
  return { data: result, count: result.length };
};

// ── ADMIN: view all timetable entries (with optional filters) ─────────────────
const getAllTimetableService = async ({ department, level, session, semester }) => {
  const query = {};
  if (department) query.department = department;
  if (level)      query.level      = Number(level);
  if (session)    query.session    = session;
  if (semester)   query.semester   = semester;

  const timetable = await Timetable.find(query).sort({ department: 1, level: 1, day: 1 });
  return { data: timetable };
};

// ── ADMIN: delete a timetable entry ──────────────────────────────────────────
const deleteTimetableEntryService = async ({ entryId }) => {
  const entry = await Timetable.findByIdAndDelete(entryId);
  if (!entry) throw new Error("Timetable entry not found");
  return { message: "Timetable entry deleted" };
};

module.exports = {
  getStudentTimetableService,
  createTimetableEntryService,
  createBulkTimetableService,
  getAllTimetableService,
  deleteTimetableEntryService,
};