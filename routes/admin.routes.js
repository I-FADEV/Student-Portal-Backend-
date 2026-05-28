const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
  deleteAdmin,
  changeAdminPassword,
} = require("../controllers/admin.controller");

router.put("/change-password", protect, changeAdminPassword);

module.exports = router;
