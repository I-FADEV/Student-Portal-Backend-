const express   = require("express");
const router    = express.Router();
const protect   = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const upload    = require("../middleware/excelParser.middleware");
const {
  getStudentResult,
  uploadSingleResult,
  uploadBulkResults,
  uploadBulkResultsJSON,
  getStudentsForCourse,
  getAllResults,
  getResultsByStudent,
  updateResult,
  deleteResult,
} = require("../controllers/result.controller");

// ── STUDENT ───────────────────────────────────────────────────────────────────

// GET /results/view?session=&semester=
router.get("/view", protect, roleCheck(["student"]), getStudentResult);

// ── TIMETABLE ADMIN ───────────────────────────────────────────────────────────

// GET /results/admin-view?courseCode=&session=&semester=
router.get(
  "/admin-view",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getAllResults,
);

// GET /results/students-for-course?courseCode=&session=&semester=
router.get(
  "/students-for-course",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getStudentsForCourse,
);

// GET /results/student?matricNumber=&session=&semester=
router.get(
  "/student",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getResultsByStudent,
);

// POST /results/upload — single result
router.post(
  "/upload",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  uploadSingleResult,
);

// POST /results/upload-bulk — Excel file upload
router.post(
  "/upload-bulk",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  upload.single("file"),
  uploadBulkResults,
);

// POST /results/bulk — JSON bulk upload (for manual entry)
router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  uploadBulkResultsJSON,
);

// PUT /results/:id — edit a single result
router.put(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  updateResult,
);

// DELETE /results/:id
router.delete(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  deleteResult,
);

module.exports = router;