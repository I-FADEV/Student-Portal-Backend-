const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  generateMatricNumber,
  getMatricCounter,
} = require("../controllers/matric.controller");

// ── REGISTRY ADMIN ONLY ───────────────────────────────────────────────────────

// GET /matric/counter?departmentId=&level= — get current counter for preview
router.get(
  "/counter",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  getMatricCounter
);

// POST /matric/generate — generate a new matric number
router.post(
  "/generate",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  generateMatricNumber
);

module.exports = router;
