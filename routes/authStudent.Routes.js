const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  register,
  login,
  refresh,
  profile,
} = require("../controllers/authStudent.controllers");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/profile", protect, profile);

module.exports = router;
