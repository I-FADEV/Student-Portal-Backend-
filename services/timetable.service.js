const Timetable = require("../models/timetable.model");
const Student = require("../models/student.model");
const { normalizeString, normalizeDay } = require("../utils/normalize");
const { DAYS, TIME_SLOTS } = require("../constants/timetable.constants");
const logAction = require("../utils/logAction");

const getStudentTimetableService = async ({ userId, session, semester }) => {
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
  performedBy,
  ipAddress,
}) => {
  const entry = await Timetable.create({
    day: normalizeDay(day),
    time,
    courseCode: normalizeString(courseCode),
    courseName: normalizeString(courseName),
    venue: normalizeString(venue),
    lecturer: normalizeString(lecturer),
    department: normalizeString(department),
    level,
    session: normalizeString(session),
    semester,
  });

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "TIMETABLE",
    targetId: entry._id,
    description: `Timetable entry created — ${courseCode} on ${day} at ${time} for ${department} level ${level}`,
    changes: {
      before: null,
      after: { day, time, courseCode, department, level, session, semester },
    },
    ipAddress,
  });

  return { data: entry };
};

const createBulkTimetableService = async ({
  entries,
  performedBy,
  ipAddress,
}) => {
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

      day = normalizeDay(day);
      courseCode = normalizeString(courseCode);
      courseName = normalizeString(courseName);
      venue = normalizeString(venue);
      lecturer = normalizeString(lecturer);
      department = normalizeString(department);
      session = normalizeString(session);
      level = Number(level);

      const slotKey = `${day}-${time}-${department}-${level}-${session}-${semester}`;
      if (seenSlots.has(slotKey)) {
        errors.push({ row, reason: "Duplicate timeslot in upload" });
        continue;
      }
      seenSlots.add(slotKey);

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

  const result = await Timetable.insertMany(cleanedEntries);

  // Log once for the whole batch
  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "TIMETABLE",
    targetId: performedBy, // no single target — use admin id as stand-in
    description: `Bulk timetable upload — ${result.length} entries created, ${errors.length} failed`,
    changes: {
      before: null,
      after: { saved: result.length, failed: errors.length },
    },
    ipAddress,
  });

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
  performedBy,
  ipAddress,
}) => {
  // Grab the old entry so we can log what changed
  const oldEntry = await Timetable.findById(entryId);
  if (!oldEntry) throw new Error("Timetable entry not found");

  const updateData = {};
  if (day) updateData.day = normalizeDay(day);
  if (time) updateData.time = time;
  if (courseCode) updateData.courseCode = normalizeString(courseCode);
  if (courseName) updateData.courseName = normalizeString(courseName);
  if (venue) updateData.venue = normalizeString(venue);
  if (lecturer) updateData.lecturer = normalizeString(lecturer);
  if (department) updateData.department = normalizeString(department);
  if (level) updateData.level = level;
  if (session) updateData.session = normalizeString(session);
  if (semester) updateData.semester = semester;

  const updated = await Timetable.findByIdAndUpdate(entryId, updateData, {
    new: true,
  });

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "TIMETABLE",
    targetId: entryId,
    description: `Timetable entry updated — ${updated.courseCode} on ${updated.day} at ${updated.time}`,
    changes: {
      before: {
        day: oldEntry.day,
        time: oldEntry.time,
        courseCode: oldEntry.courseCode,
        venue: oldEntry.venue,
      },
      after: {
        day: updated.day,
        time: updated.time,
        courseCode: updated.courseCode,
        venue: updated.venue,
      },
    },
    ipAddress,
  });

  return { data: updated };
};

const deleteTimetableEntryService = async ({
  entryId,
  performedBy,
  ipAddress,
}) => {
  const entry = await Timetable.findByIdAndDelete(entryId);
  if (!entry) throw new Error("Timetable entry not found");

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "TIMETABLE",
    targetId: entryId,
    description: `Timetable entry deleted — ${entry.courseCode} on ${entry.day} at ${entry.time}`,
    changes: {
      before: {
        day: entry.day,
        time: entry.time,
        courseCode: entry.courseCode,
        venue: entry.venue,
      },
      after: null,
    },
    ipAddress,
  });

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

  for (const course of courses) {
    let placed = false;

    for (const day of DAYS) {
      if (placed) break;

      for (const time of TIME_SLOTS) {
        const clash = await Timetable.findOne({
          day,
          time,
          session,
          semester,
          $or: [
            { department, level },
            { lecturer: course.lecturer },
            { venue: course.venue },
          ],
        });

        if (clash) continue;

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
