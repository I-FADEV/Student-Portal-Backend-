const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  createFinanceTemplate,
  getAllFinanceTemplates,
  applyTemplateToStudents,
  deleteFinanceTemplate,
} = require("../controllers/financeTemplate.controller");

// ── Finance Admin only ────────────────────────────────────────────────────────────

router.get(
  "/templates",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  getAllFinanceTemplates,
);

router.post(
  "/templates",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  createFinanceTemplate,
);

router.post(
  "/templates/:id/apply",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  applyTemplateToStudents,
);

router.delete(
  "/templates/:id",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  deleteFinanceTemplate,
);

module.exports = router;
