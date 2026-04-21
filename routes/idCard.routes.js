const express = require("express");
const router = express.Router();
const upload = require("../config/multer");
const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { createIdCardSchema } = require("../validation/idCard.validation");
const {
  createIdcard,
  viewIdCard,
} = require("../controllers/idCard.controller");

router.post(
  "/create",
  protect,
  upload.single("photoURL"),
  validate(createIdCardSchema),
  createIdcard,
);

router.get("/view", protect, viewIdCard);

module.exports = router;
