const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  getMyCourses,
  createCourse,
  createBulkCourses,
  getAllCourses,
  deleteCourse,
} = require("../controllers/course.controller");

// ── STUDENT ──────────────────────────────────────────────────────────────────
// GET /courses/view — student sees courses for their dept + level
router.get("/view", protect, roleCheck(["student"]), getMyCourses);

// ── ADMIN (general_admin) ─────────────────────────────────────────────────────
// GET /courses/admin — view all courses
router.get(
  "/admin",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  getAllCourses
);

// POST /courses/create — add a single course
router.post(
  "/create",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  createCourse
);

// POST /courses/bulk — add multiple courses at once
router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  createBulkCourses
);

// DELETE /courses/:id — remove a course
router.delete(
  "/:id",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  deleteCourse
);

module.exports = router;