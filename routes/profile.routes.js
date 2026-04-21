const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const { studentProfile } = require("../controllers/profile.controller");

router.get("/", protect, studentProfile);

module.exports = router;
