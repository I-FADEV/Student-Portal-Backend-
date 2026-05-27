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


router.get("/view", protect, roleCheck(["student"]), getMyTimetable);

router.get(
  "/admin",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getAllTimetable
);

router.post(
  "/create",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createTimetableEntry
);

router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  createBulkTimetable
);

router.delete(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  deleteTimetableEntry
);

module.exports = router;