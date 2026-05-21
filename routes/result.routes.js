const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  getMyResults,
  uploadSingleResult,
  uploadBulkResults,
  getAllResults,
  deleteResult,
} = require("../controllers/result.controller");

// ── STUDENT ──────────────────────────────────────────────────────────────────
// GET /results/view — student sees their own results
router.get("/view", protect, roleCheck(["student"]), getMyResults);

// ── ADMIN (general_admin) ─────────────────────────────────────────────────────
// GET /results/admin — view all results (filter by course/session/semester)
router.get(
  "/admin",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  getAllResults
);

// POST /results/upload — upload a single student result
router.post(
  "/upload",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  uploadSingleResult
);

// POST /results/bulk — bulk upload results for a course
router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  uploadBulkResults
);

// DELETE /results/:id — delete a result
router.delete(
  "/:id",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  deleteResult
);

module.exports = router;