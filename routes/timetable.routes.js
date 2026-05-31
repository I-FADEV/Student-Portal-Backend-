const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  getStudentTimetable,
  createTimetableEntry,
  createBulkTimetable,
  getAllTimetable,
  deleteTimetableEntry,
  updateTimetableEntry,
  generateTimetableController,
} = require("../controllers/timetable.controller");

router.get("/view", protect, roleCheck(["student"]), getStudentTimetable);

router.get(
  "/admin",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getAllTimetable,
);

router.post(
  "/create",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createTimetableEntry,
);

router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createBulkTimetable,
);

router.put(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  updateTimetableEntry,
);

router.post(
  "/generate",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  generateTimetableController,
);

router.delete(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  deleteTimetableEntry,
);

module.exports = router;
