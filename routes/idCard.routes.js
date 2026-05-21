const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const validate = require("../middleware/validate.middleware");
const { createIdCardSchema } = require("../validation/idCard.validation");
const {
  viewIdCard,
  createIdcard,
  markFeePaid,
  markCollected,
  rejectIdCard,
  getAllIdCards,
} = require("../controllers/idCard.controller");

// ── STUDENT ──────────────────────────────────────────────────────────────────

// GET /idcard/view — student views own record (auto-created on first visit)
router.get("/view", protect, roleCheck(["student"]), viewIdCard);

// POST /idcard/create — student submits form
// Order: protect → roleCheck → multer (parses file+body) → validate → controller
router.post(
  "/create",
  protect,
  roleCheck(["student"]),
  upload.single("photoURL"),
  validate(createIdCardSchema),
  createIdcard,
);

// ── BURSAR ADMIN ──────────────────────────────────────────────────────────────

// PATCH /idcard/fee/:studentId — bursar marks student's ID card fee as paid
router.patch(
  "/fee/:studentId",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  markFeePaid,
);

// ── TAC ADMIN ─────────────────────────────────────────────────────────────────

// GET /idcard/admin?status=pending — view all submissions
router.get(
  "/admin",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  getAllIdCards,
);

// PATCH /idcard/:id/collect — mark as collected by student
router.patch(
  "/:id/collect",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  markCollected,
);

// PATCH /idcard/:id/reject — reject submission (student can resubmit)
router.patch(
  "/:id/reject",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  rejectIdCard,
);

module.exports = router;