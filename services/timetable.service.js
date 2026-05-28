const Timetable = require("../models/timetable.model");
const Student = require("../models/student.model");
const { normalizeString, normalizeDay } = require("../utils/normalize");
const { DAYS, TIME_SLOTS } = require("../constants/timetable.constants");

const getStudentTimetableService = async ({ userId, session, semester }) => {
  // Look up the student to get their department and level
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
    day: normalizeDay(day),
    time,
    courseCode: normalize(courseCode),
    courseName: normalize(courseName),
    venue: normalize(venue),
    lecturer: normalize(lecturer),
    department: normalize(department),
    level,
    session: normalize(session),
    semester,
  });

  return { data: entry };
};

const createBulkTimetableService = async ({ entries }) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Entries must be a non-empty array");
  }

  const cleanedEntries = [];
  const errors = [];

  const seenSlots = new Set();

  for (const row of entries) {
    try {
      let {
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
      } = row;

      // 🧠 1. Basic validation
      if (
        !day ||
        !time ||
        !courseCode ||
        !department ||
        !level ||
        !session ||
        !semester
      ) {
        errors.push({ row, reason: "Missing required fields" });
        continue;
      }

      // 🧠 2. Normalize
      day = normalizeDay(day);
      courseCode = normalize(courseCode);
      courseName = normalize(courseName);
      venue = normalize(venue);
      lecturer = normalize(lecturer);
      department = normalize(department);
      session = normalize(session);

      level = Number(level);

      // 🧠 3. Detect duplicate INSIDE upload
      const slotKey = `${day}-${time}-${department}-${level}-${session}-${semester}`;

      if (seenSlots.has(slotKey)) {
        errors.push({ row, reason: "Duplicate timeslot in upload" });
        continue;
      }

      seenSlots.add(slotKey);

      // 🧠 4. Check DB clash
      const exists = await Timetable.findOne({
        day,
        time,
        department,
        level,
        session,
        semester,
      });

      if (exists) {
        errors.push({ row, reason: "Timeslot already exists in database" });
        continue;
      }

      cleanedEntries.push({
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
    } catch (err) {
      errors.push({ row, reason: err.message });
    }
  }

  // 🧠 5. Save only valid ones
  const result = await Timetable.insertMany(cleanedEntries);

  return {
    data: {
      saved: result,
      errors,
      summary: {
        total: entries.length,
        success: result.length,
        failed: errors.length,
      },
    },
  };
};

// ── ADMIN: view all timetable entries (with optional filters) ─────────────────
const getAllTimetableService = async ({
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

  const timetable = await Timetable.find(query).sort({
    department: 1,
    level: 1,
    day: 1,
  });
  return { data: timetable };
};

const updateTimetableEntryService = async ({
  entryId,
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
  const updateData = {};

  if (day) updateData.day = normalizeDay(day);
  if (time) updateData.time = time;
  if (courseCode) updateData.courseCode = normalize(courseCode);
  if (courseName) updateData.courseName = normalize(courseName);
  if (venue) updateData.venue = normalize(venue);
  if (lecturer) updateData.lecturer = normalize(lecturer);
  if (department) updateData.department = normalize(department);
  if (level) updateData.level = level;
  if (session) updateData.session = normalize(session);
  if (semester) updateData.semester = semester;

  const updated = await Timetable.findByIdAndUpdate(entryId, updateData, {
    new: true,
  });

  if (!updated) {
    throw new Error("Timetable entry not found");
  }

  return { data: updated };
};

const deleteTimetableEntryService = async ({ entryId }) => {
  const entry = await Timetable.findByIdAndDelete(entryId);
  if (!entry) throw new Error("Timetable entry not found");
  return { message: "Timetable entry deleted" };
};

const generateTimetableService = async ({
  department,
  level,
  session,
  semester,
}) => {
  if (!department || !level || !session || !semester) {
    throw new Error("Missing required fields");
  }

  // 1. Get courses (department + general)
  const courses = await Course.find({
    $or: [
      { department, level },
      { isGeneral: true, level },
    ],
  });

  if (!courses.length) {
    throw new Error("No courses found");
  }

  const schedule = [];
  const unscheduled = [];

  // 2. Build timetable
  for (const course of courses) {
    let placed = false;

    for (const day of DAYS) {
      if (placed) break;

      for (const time of TIME_SLOTS) {
        // 3. Check ALL clashes in DB
        const clash = await Timetable.findOne({
          day,
          time,
          session,
          semester,
          $or: [
            // same student group clash
            { department, level },

            // lecturer clash
            { lecturer: course.lecturer },

            // venue clash
            { venue: course.venue },
          ],
        });

        if (clash) continue;

        // 4. Assign slot
        schedule.push({
          day,
          time,
          courseCode: course.courseCode,
          courseName: course.courseName,
          lecturer: course.lecturer,
          venue: course.venue,
          department,
          level,
          session,
          semester,
        });

        placed = true;
        break;
      }
    }

    if (!placed) {
      unscheduled.push({
        courseCode: course.courseCode,
        reason: "No available slot",
      });
    }
  }

  // 5. Save valid schedule
  const result = await Timetable.insertMany(schedule);

  return {
    data: result,
    summary: {
      totalCourses: courses.length,
      scheduled: result.length,
      unscheduled: unscheduled.length,
    },
    unscheduled,
  };
};

module.exports = {
  getStudentTimetableService,
  createTimetableEntryService,
  createBulkTimetableService,
  getAllTimetableService,
  deleteTimetableEntryService,
  updateTimetableEntryService,
  generateTimetableService,
};
