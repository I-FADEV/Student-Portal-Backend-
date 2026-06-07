const express   = require("express");
const router    = express.Router();
const protect   = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const validate  = require("../middleware/validate.middleware");
const {
  createFinance,
  payFinance,
  viewFinance,
  getFinanceStats,
  createBulkFinance,
  addItemToFinance,
} = require("../controllers/finance.controller");
const {
  createFinanceSchema,
  createBulkFinanceSchema,
  addItemSchema,
  paymentSchema,
} = require("../validation/finance.validation");

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
  validate(createFinanceSchema),
  createFinance,
);

router.post(
  "/bulk",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  validate(createBulkFinanceSchema),
  createBulkFinance,
);

router.post(
  "/pay/:id",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  validate(paymentSchema),
  payFinance,
);

router.patch(
  "/:id/add-item",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  validate(addItemSchema),
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