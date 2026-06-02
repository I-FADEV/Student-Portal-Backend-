const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  getRegistryStats,
  getFaculties,
  createFaculty,
  deleteFaculty,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/registry.controller");

// ── REGISTRY ADMIN ONLY ───────────────────────────────────────────────────────
router.get(
  "/stats",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  getRegistryStats
);

// ── FACULTIES ─────────────────────────────────────────────────────────────────
// Read: registry, finance, idcard, timetable admins all need faculty list
router.get(
  "/faculties",
  protect,
  roleCheck(["admin"], ["registry_admin", "finance_admin", "idcard_admin", "timetable_admin"]),
  getFaculties
);

// Write: registry admin only
router.post(
  "/faculties",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  createFaculty
);

router.delete(
  "/faculties/:id",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  deleteFaculty
);

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
// Read: registry, finance, idcard, timetable admins all need department list
router.get(
  "/departments",
  protect,
  roleCheck(["admin"], ["registry_admin", "finance_admin", "idcard_admin", "timetable_admin"]),
  getDepartments
);

// Write: registry admin only
router.post(
  "/departments",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  createDepartment
);

router.put(
  "/departments/:id",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  updateDepartment
);

router.delete(
  "/departments/:id",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  deleteDepartment
);

module.exports = router;