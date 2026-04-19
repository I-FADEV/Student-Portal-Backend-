const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "./uploads/"));
  },

  filename: (req, file, cb) => {
    const uniqueNumber = Date.now() + "-" + file.originalname;
    cb(null, uniqueNumber);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // accept the file ✅
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, webp)"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

module.exports = upload;
