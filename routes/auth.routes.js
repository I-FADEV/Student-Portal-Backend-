const express = require("express");
const router  = express.Router();
const validate  = require("../middleware/validate.middleware");
const protect   = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  adminRegisterSchema,
  adminLoginSchema,
  studentRegisterSchema,
  studentLoginSchema,
} = require("../validation/auth.validation");
const {
  adminRegister,
  adminLogin,
  studentRegister,
  studentLogin,
  refresh,
  changeAdminPassword,
  getAllStudents,
  resetStudentPassword,
  searchStudents,
  filterStudents,
  deleteStudent,
} = require("../controllers/auth.controller");

// ── Admin ─────────────────────────────────────────────────────────────────────
router.post(
  "/admin/register",
  validate(adminRegisterSchema),
  protect,
  roleCheck(["admin"], ["general_admin"]),
  adminRegister,
);

router.post("/admin/login", validate(adminLoginSchema), adminLogin);

router.put(
  "/change-password",
  protect,
  roleCheck(["admin"]),
  changeAdminPassword,
);

// ── Both ──────────────────────────────────────────────────────────────────────
router.post("/refresh", refresh);

// ── Student ───────────────────────────────────────────────────────────────────
router.post(
  "/student/register",
  protect,
  roleCheck(["admin"], ["idcard_admin", "timetable_admin"]),
  validate(studentRegisterSchema),
  studentRegister,
);

router.post("/student/login", validate(studentLoginSchema), studentLogin);

// ── TAC Admin: manage students ────────────────────────────────────────────────
router.get(
  "/students",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  getAllStudents,
);

router.post(
  "/student/reset-password",
  protect,
  roleCheck(["admin"], ["idcard_admin"]),
  resetStudentPassword,
);

// ── Finance Admin: student search + filter ────────────────────────────────────
router.get(
  "/student/search",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  searchStudents,
);

router.get(
  "/student/filter",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  filterStudents,
);

// ── Registry Admin: delete student ────────────────────────────────────────────
router.delete(
  "/student/:studentId",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  deleteStudent,
);

module.exports = router;