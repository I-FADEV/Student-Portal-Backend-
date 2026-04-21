const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate.middleware");
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const { studentLoginSchema } = require("../validation/auth.validation");
const {
  createFinance,
  payFinance,
  viewFinance,
} = require("../controllers/finance.controller");

router.post(
  "/create",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  createFinance,
);
router.post(
  "/pay/:id",
  protect,
  roleCheck(["admin"], ["finance_admin"]),
  payFinance,
);

router.get("/view", protect, roleCheck(["student"]), viewFinance);

module.exports = router;
