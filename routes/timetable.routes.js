const express = require("express");
const router  = express.Router();
const protect   = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");

// Existing timetable entry controller
const {
  getStudentTimetable,
  createTimetableEntry,
  createBulkTimetable,
  getAllTimetable,
  deleteTimetableEntry,
  updateTimetableEntry,
  // generateTimetableController is REMOVED — clash detection runs on frontend
} = require("../controllers/timetable.controller");

// NEW — TimetableCourse controller
const {
  getTimetableCourses,
  createTimetableCourse,
  updateTimetableCourse,
  deleteTimetableCourse,
  getTimetableStats,
} = require("../controllers/timetableCourse.controller");

// ── STUDENT ───────────────────────────────────────────────────────────────────

// GET /timetable/view — student sees their own timetable (filtered by dept + level)
router.get("/view", protect, roleCheck(["student"]), getStudentTimetable);

// ── TIMETABLE ADMIN — Stats ───────────────────────────────────────────────────

// GET /timetable/stats — dashboard stats
router.get(
  "/stats",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getTimetableStats
);

// ── TIMETABLE ADMIN — Course management ──────────────────────────────────────
// NOTE: /courses routes MUST come before /:id to avoid route conflicts

// GET /timetable/courses?session=&semester= — list all courses for a session
router.get(
  "/courses",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getTimetableCourses
);

// POST /timetable/courses — add a new course
router.post(
  "/courses",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createTimetableCourse
);

// PUT /timetable/courses/:id — edit a course
router.put(
  "/courses/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  updateTimetableCourse
);

// DELETE /timetable/courses/:id — delete a course
router.delete(
  "/courses/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  deleteTimetableCourse
);

// ── TIMETABLE ADMIN — Published timetable entries ─────────────────────────────

// GET /timetable/admin?session=&semester=&department=&level= — admin filtered view
router.get(
  "/admin",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getAllTimetable
);

// POST /timetable/create — create a single timetable entry
router.post(
  "/create",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createTimetableEntry
);

// POST /timetable/bulk — save full generated timetable (array of entries)
// Called by GenerateTimetable.jsx after frontend resolves all clashes
router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createBulkTimetable
);

// PUT /timetable/:id — edit a single published entry
router.put(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  updateTimetableEntry
);

// DELETE /timetable/:id — delete a single published entry
router.delete(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  deleteTimetableEntry
);

// NOTE: POST /timetable/generate has been REMOVED.
// The frontend (GenerateTimetable.jsx) handles the clash-detection algorithm
// and sends the final resolved entries to POST /timetable/bulk.

module.exports = router;