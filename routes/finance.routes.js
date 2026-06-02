const express   = require("express");
const router    = express.Router();
const protect   = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  createFinance,
  payFinance,
  viewFinance,
  getFinanceStats,
  createBulkFinance,
  addItemToFinance,
} = require("../controllers/finance.controller");

// ── Finance Admin only ────────────────────────────────────────────────────────
router.get(
  "/stats",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  getFinanceStats,
);

router.post(
  "/create",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  createFinance,
);

router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  createBulkFinance,
);

router.post(
  "/pay/:id",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  payFinance,
);

router.patch(
  "/:id/add-item",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  addItemToFinance,
);

router.get(
  "/adminView",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  viewFinance,
);

// ── Student only ──────────────────────────────────────────────────────────────
router.get(
  "/view",
  protect,
  roleCheck(["student"]),
  viewFinance,
);

module.exports = router;