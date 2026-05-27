const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const upload = require("../middleware/excelParser.middleware");
const {
  getStudentResult,
  uploadSingleResult,
  uploadBulkResults,
  getAllResults,
  deleteResult,
} = require("../controllers/result.controller");

router.get("/view", protect, roleCheck(["student"]), getStudentResult);

router.post(
  "/upload",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  uploadSingleResult,
);

router.post(
  "/upload-bulk",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  upload.single("file"),
  uploadBulkResults,
);

router.get(
  "/admin-view",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  getAllResults,
);

router.delete(
  "/:id",
  protect,
  roleCheck(["admin"], ["timetable_admin"]),
  deleteResult,
);

module.exports = router;
