const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const isExcel =
      file.mimetype.includes("spreadsheet") ||
      file.originalname.endsWith(".xlsx");

    if (!isExcel) {
      return cb(new Error("Only Excel (.xlsx) files are allowed"));
    }

    cb(null, true);
  },
});

module.exports = upload;