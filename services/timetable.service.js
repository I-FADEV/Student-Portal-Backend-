const Timetable = require("../models/timetable.model");
const Student = require("../models/student.model");
const TimetableCourse = require("../models/timetableCourse.model");
const { normalizeString, normalizeDay } = require("../utils/normalize");
const { DAYS, TIME_SLOTS } = require("../constants/timetable.constants");
const logAction = require("../utils/logAction");
const { getActiveSession } = require("../utils/activeSession");
const AppError = require("../utils/appError");
const {
  caseInsensitiveExact,
  resolveFacultyFromDepartment,
  getDepartmentsInFaculty,
  getTimetableCoursesForStudent,
} = require("../utils/studentCourseResolver");

// Fisher-Yates shuffle — returns a new shuffled copy, never mutates original
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Returns true if placing `course` at day/time conflicts with an entry
 * already in the in-memory batch or an existing DB row.
 */
const hasSlotConflict = async ({
  day,
  time,
  course,
  departmentsToCheck,
  level,
  session,
  semester,
  pendingSchedule,
}) => {
  const levelNum = Number(level);
  const deptSet = new Set(departmentsToCheck.map((d) => normalizeString(d)));

  // Conflicts within the batch being built in this run
  for (const entry of pendingSchedule) {
    if (entry.day !== day || entry.time !== time) continue;

    if (deptSet.has(entry.department) && entry.level === levelNum) return true;

    if (
      entry.lecturer &&
      course.lecturer &&
      entry.lecturer.toLowerCase() === course.lecturer.toLowerCase() &&
      entry.courseCode !== course.courseCode
    ) {
      return true;
    }
  }

  // Conflicts with entries already saved in the database
  const orClauses = [...deptSet].map((dept) => ({
    department: caseInsensitiveExact(dept),
    level: levelNum,
  }));

  if (course.lecturer) {
    orClauses.push({
      lecturer: course.lecturer,
      courseCode: { $ne: course.courseCode },
    });
  }

  const clash = await Timetable.findOne({
    day,
    time,
    session,
    semester,
    $or: orClauses,
  });

  return Boolean(clash);
};

const getStudentTimetableService = async ({ userId, session, semester }) => {
  const student = await Student.findById(userId);
  if (!student) throw new AppError("Student not found", 404);

  if (!student.department || student.level == null) {
    throw new AppError(
      "Your profile is incomplete. Department or level is missing.",
      400,
    );
  }

  const timetableCourses = await getTimetableCoursesForStudent(student, {
    session,
    semester,
  });

  const courseCodes = [
    ...new Set(timetableCourses.map((c) => c.courseCode.toUpperCase())),
  ];

  if (courseCodes.length === 0) {
    return {
      data: [],
      unscheduledCourses: [],
      summary: { totalCourses: 0, scheduled: 0, unscheduled: 0 },
    };
  }

  // ── FIX Issue 3: Separate dept courses from faculty courses ─────────────────
  // Without this, a faculty course (e.g. ENG 101) scheduled for every dept
  // returns ALL dept entries (Biochemistry, Geology, etc.) for this student.

  const resolvedFaculty = await resolveFacultyFromDepartment(student.department);

  const facultyCourseCodes = new Set();
  const deptCourseCodes = new Set();

  for (const tc of timetableCourses) {
    const isFaculty = tc.targets.some(
      (t) =>
        t.type === "faculty" &&
        resolvedFaculty &&
        t.name.toLowerCase() === resolvedFaculty.toLowerCase() &&
        Number(t.level) === Number(student.level),
    );
    if (isFaculty) {
      facultyCourseCodes.add(tc.courseCode.toUpperCase());
    } else {
      deptCourseCodes.add(tc.courseCode.toUpperCase());
    }
  }

  // Build $or query:
  // - Dept courses: only this student's own department
  // - Faculty courses: any entry (they all share the same slot; we dedup below)
  const orClauses = [];

  if (deptCourseCodes.size > 0) {
    const deptClause = {
      courseCode: { $in: [...deptCourseCodes] },
      department: { $regex: new RegExp(`^${student.department}$`, "i") },
      level: Number(student.level),
    };
    if (session) deptClause.session = session;
    if (semester) deptClause.semester = semester;
    orClauses.push(deptClause);
  }

  if (facultyCourseCodes.size > 0) {
    const facultyClause = {
      courseCode: { $in: [...facultyCourseCodes] },
      level: Number(student.level),
    };
    if (session) facultyClause.session = session;
    if (semester) facultyClause.semester = semester;
    orClauses.push(facultyClause);
  }

  // If somehow both sets are empty (shouldn't happen after the check above), bail
  if (orClauses.length === 0) {
    return {
      data: [],
      unscheduledCourses: [],
      summary: { totalCourses: 0, scheduled: 0, unscheduled: 0 },
    };
  }

  const rawTimetable = await Timetable.find({ $or: orClauses }).sort({
    day: 1,
    time: 1,
  });

  // Deduplicate: for faculty courses, keep only ONE entry per courseCode
  // (prefer this student's own dept entry if it exists, otherwise any)
  const seen = new Set();
  const timetable = [];

  // First pass: pick this student's own dept entry for faculty courses if available
  for (const entry of rawTimetable) {
    const key = entry.courseCode.toUpperCase();
    if (facultyCourseCodes.has(key)) {
      if (
        !seen.has(key) &&
        entry.department.toLowerCase() === student.department.toLowerCase()
      ) {
        seen.add(key);
        timetable.push(entry);
      }
    } else {
      // Dept course — always include (already filtered by dept in query)
      timetable.push(entry);
    }
  }

  // Second pass: for faculty courses not yet picked (no entry for this dept),
  // fall back to any entry
  for (const entry of rawTimetable) {
    const key = entry.courseCode.toUpperCase();
    if (facultyCourseCodes.has(key) && !seen.has(key)) {
      seen.add(key);
      timetable.push(entry);
    }
  }

  // Re-sort after the two-pass dedup
  timetable.sort((a, b) => {
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const slotOrder = [
      "8:00 - 10:00",
      "10:00 - 12:00",
      "1:00 - 3:00",
      "3:00 - 5:00",
    ];
    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return slotOrder.indexOf(a.time) - slotOrder.indexOf(b.time);
  });
  // ── End Fix Issue 3 ──────────────────────────────────────────────────────────

  const scheduledCodes = new Set(
    timetable.map((t) => t.courseCode.toUpperCase()),
  );

  const unscheduledCourses = timetableCourses
    .filter((c) => !scheduledCodes.has(c.courseCode.toUpperCase()))
    .map((c) => ({
      courseCode: c.courseCode,
      courseName: c.courseName,
      creditUnit: c.creditUnit,
      lecturer: c.lecturer,
      lecturerPhone: c.lecturerPhone,
      session: c.session,
      semester: c.semester,
      scheduled: false,
    }));

  return {
    data: timetable,
    unscheduledCourses,
    summary: {
      totalCourses: timetableCourses.length,
      scheduled: scheduledCodes.size,
      unscheduled: unscheduledCourses.length,
    },
  };
};

const createTimetableEntryService = async ({
  day,
  time,
  courseCode,
  courseName,
  creditUnit,
  venue,
  lecturer,
  lecturerPhone,
  department,
  level,
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

  const entry = await Timetable.create({
    day: normalizeDay(day),
    time,
    courseCode: normalizeString(courseCode),
    courseName: normalizeString(courseName),
    creditUnit: creditUnit ? Number(creditUnit) : null,
    venue: normalizeString(venue),
    lecturer: normalizeString(lecturer),
    lecturerPhone: normalizeString(lecturerPhone),
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

  // Auto-fetch active session if not provided in first entry
  let activeSessionData = null;
  if (entries.length > 0 && (!entries[0].session || !entries[0].semester)) {
    activeSessionData = await getActiveSession();
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
        creditUnit,
        venue,
        lecturer,
        lecturerPhone,
        department,
        level,
        session,
        semester,
      } = row;

      // Use active session if not provided
      if (!session || !semester) {
        if (activeSessionData) {
          session = session || activeSessionData.session;
          semester = semester || activeSessionData.semester;
        }
      }

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
      creditUnit = creditUnit ? Number(creditUnit) : null;
      venue = normalizeString(venue);
      lecturer = normalizeString(lecturer);
      lecturerPhone = normalizeString(lecturerPhone);
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
        creditUnit,
        venue,
        lecturer,
        lecturerPhone,
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
    targetId: performedBy,
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
  if (department)
    query.department = { $regex: new RegExp(`^${department}$`, "i") };
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
  creditUnit,
  venue,
  lecturer,
  lecturerPhone,
  department,
  level,
  session,
  semester,
  performedBy,
  ipAddress,
}) => {
  const oldEntry = await Timetable.findById(entryId);
  if (!oldEntry) throw new Error("Timetable entry not found");

  const updateData = {};
  if (day) updateData.day = normalizeDay(day);
  if (time) updateData.time = time;
  if (courseCode) updateData.courseCode = normalizeString(courseCode);
  if (courseName) updateData.courseName = normalizeString(courseName);
  if (creditUnit !== undefined) updateData.creditUnit = Number(creditUnit);
  if (venue) updateData.venue = normalizeString(venue);
  if (lecturer) updateData.lecturer = normalizeString(lecturer);
  if (lecturerPhone) updateData.lecturerPhone = normalizeString(lecturerPhone);
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
  performedBy,
  ipAddress,
}) => {
  if (!session || !semester) {
    const activeSession = await getActiveSession();
    session = session || activeSession.session;
    semester = semester || activeSession.semester;
  }

  if (!department || level === undefined || level === null || level === "") {
    throw new AppError("department and level are required", 400);
  }

  const normalizedDepartment = normalizeString(department);
  const levelNum = Number(level);

  const facultyName = await resolveFacultyFromDepartment(department);
  const facultyDepartments = facultyName
    ? (await getDepartmentsInFaculty(facultyName)).map((d) => normalizeString(d))
    : [normalizedDepartment];

  if (!facultyDepartments.includes(normalizedDepartment)) {
    facultyDepartments.push(normalizedDepartment);
  }

  const courseQuery = {
    $or: [
      {
        targets: {
          $elemMatch: {
            type: "department",
            name: caseInsensitiveExact(department),
            level: levelNum,
          },
        },
      },
      ...(facultyName
        ? [
            {
              targets: {
                $elemMatch: {
                  type: "faculty",
                  name: caseInsensitiveExact(facultyName),
                  level: levelNum,
                },
              },
            },
          ]
        : []),
    ],
    session,
    semester,
  };

  const timetableCourses = await TimetableCourse.find(courseQuery);

  if (!timetableCourses.length) {
    throw new AppError(
      "No courses found for this department, level, session, and semester",
      404,
    );
  }

  const schedule = [];
  const unscheduled = [];

  for (const course of timetableCourses) {
    let placed = false;

    const isFacultyCourse = course.targets.some(
      (t) =>
        t.type === "faculty" &&
        facultyName &&
        t.name.toLowerCase() === facultyName.toLowerCase() &&
        Number(t.level) === levelNum,
    );

    // ── FIX Issue 1: Guard — skip if already scheduled for this dept ──────────
    // Prevents re-generating the same course on repeated generate calls.
    const alreadyScheduled = await Timetable.findOne({
      courseCode: course.courseCode,
      department: normalizedDepartment,
      level: levelNum,
      session,
      semester,
    });
    if (alreadyScheduled) {
      placed = true;
    }
    // ── End Fix Issue 1 ───────────────────────────────────────────────────────

    const departmentsToCheck = isFacultyCourse
      ? facultyDepartments
      : [normalizedDepartment];

    // ── Faculty course deduplication ──────────────────────────────────────────
    // If this faculty course was already placed by an earlier dept generation,
    // mirror the exact same day+time for this dept so all depts stay in sync.
    if (!placed && isFacultyCourse) {
      const existingEntry = await Timetable.findOne({
        courseCode: course.courseCode,
        session,
        semester,
        level: levelNum,
      });

      if (existingEntry) {
        const slotTakenInPending = schedule.some(
          (e) =>
            e.day === existingEntry.day &&
            e.time === existingEntry.time &&
            e.department === normalizedDepartment &&
            e.level === levelNum,
        );

        const slotTakenInDb = await Timetable.findOne({
          day: existingEntry.day,
          time: existingEntry.time,
          department: normalizedDepartment,
          level: levelNum,
          session,
          semester,
        });

        if (!slotTakenInPending && !slotTakenInDb) {
          schedule.push({
            day: existingEntry.day,
            time: existingEntry.time,
            courseCode: course.courseCode,
            courseName: course.courseName,
            creditUnit: course.creditUnit,
            lecturer: course.lecturer,
            lecturerPhone: course.lecturerPhone,
            venue: null,
            department: normalizedDepartment,
            level: levelNum,
            session,
            semester,
          });
        }

        placed = true;
      }
    }
    // ── End faculty dedup ─────────────────────────────────────────────────────

    // ── Randomized slot assignment ────────────────────────────────────────────
    if (!placed) {
      const shuffledDays = shuffleArray(DAYS);
      for (const day of shuffledDays) {
        if (placed) break;
        const shuffledSlots = shuffleArray(TIME_SLOTS);
        for (const time of shuffledSlots) {
          const conflict = await hasSlotConflict({
            day,
            time,
            course,
            departmentsToCheck,
            level: levelNum,
            session,
            semester,
            pendingSchedule: schedule,
          });

          if (conflict) continue;

          schedule.push({
            day,
            time,
            courseCode: course.courseCode,
            courseName: course.courseName,
            creditUnit: course.creditUnit,
            lecturer: course.lecturer,
            lecturerPhone: course.lecturerPhone,
            venue: null,
            department: normalizedDepartment,
            level: levelNum,
            session,
            semester,
          });

          placed = true;
          break;
        }
      }
    }
    // ── End randomized slot assignment ────────────────────────────────────────

    if (!placed) {
      unscheduled.push({
        courseCode: course.courseCode,
        reason: "No available slot",
      });
    }
  }

  const result =
    schedule.length > 0 ? await Timetable.insertMany(schedule) : [];

  if (performedBy) {
    await logAction({
      performedBy,
      action: "CREATE",
      targetType: "TIMETABLE",
      targetId: performedBy,
      description: `Timetable generated for ${normalizedDepartment} level ${levelNum} — ${result.length} scheduled, ${unscheduled.length} unscheduled`,
      changes: {
        before: null,
        after: {
          department: normalizedDepartment,
          level: levelNum,
          session,
          semester,
          scheduled: result.length,
          unscheduled: unscheduled.length,
        },
      },
      ipAddress,
    });
  }

  return {
    data: result,
    summary: {
      totalCourses: timetableCourses.length,
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