const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  getMyTimetable,
  createTimetableEntry,
  createBulkTimetable,
  getAllTimetable,
  deleteTimetableEntry,
} = require("../controllers/timetable.controller");

// ── STUDENT ──────────────────────────────────────────────────────────────────
// GET /timetable/view — student sees their own timetable (by dept + level)
router.get("/view", protect, roleCheck(["student"]), getMyTimetable);

// ── ADMIN (timetable_admin) ───────────────────────────────────────────────────
// GET /timetable/admin — view all timetable entries
router.get(
  "/admin",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getAllTimetable
);

// POST /timetable/create — add a single entry
router.post(
  "/create",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createTimetableEntry
);

// POST /timetable/bulk — add multiple entries at once
router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createBulkTimetable
);

// DELETE /timetable/:id — remove an entry
router.delete(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  deleteTimetableEntry
);

module.exports = router;