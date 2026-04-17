const express = require("express");
const router = express.Router();
const {
  register,
  login,
  refresh,
} = require("../controllers/authAdmin.controllers");

router.post("/register",  register);
router.post("/login",  login);
router.post("/refresh",  refresh);

module.exports = router;
