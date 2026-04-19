const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../config/multer");
const {
  register,
  login,
  refresh,
  profile,
  idcard,
  timetable,
} = require("../controllers/authStudent.controllers");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/profile", protect, profile);
router.get("/timetable", protect, timetable);
router.post("/idcard", protect, upload.single("photoURL"), idcard);

module.exports = router;
