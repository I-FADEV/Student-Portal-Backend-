const express = require("express");
const router = express.Router();
const {
  adminRegister,
  adminLogin,
  studentRegister,
  studentLogin,
  refresh,
} = require("../controllers/auth.controller");

//admin
router.post("/admin/register", adminRegister);
router.post("/admin/login", adminLogin);

//both
router.post("/refresh", refresh);

//student
router.post("/student/register", studentRegister);
router.post("/student/login", studentLogin);

module.exports = router;
