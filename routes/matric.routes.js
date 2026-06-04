const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  generateMatricNumber,
  getMatricCounter,
  getMatricStats,
} = require("../controllers/matric.controller");

// ── REGISTRY ADMIN ONLY ───────────────────────────────────────────────────────

// GET /matric/counter?level= — get current counter for preview
router.get(
  "/counter",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  getMatricCounter
);

// GET /matric/stats — get matric generation statistics
router.get(
  "/stats",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  getMatricStats
);

// POST /matric/generate — generate a new matric number
router.post(
  "/generate",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  generateMatricNumber
);

module.exports = router;
