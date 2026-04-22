const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate.middleware");
const protect = require("../middleware/auth.middleware");
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
} = require("../controllers/auth.controller");

//admin
router.post(
  "/admin/register",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  validate(adminRegisterSchema),
  adminRegister,
);

router.post(
  "/admin/login",
  roleCheck(["admin"]),
  validate(adminLoginSchema),
  adminLogin,
);

//both
router.post("/refresh", refresh);

//student
router.post(
  "/student/register",
  validate(studentRegisterSchema),
  studentRegister,
);
router.post("/student/login", validate(studentLoginSchema), studentLogin);

module.exports = router;
