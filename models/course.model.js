const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    creditUnit: {
      type: Number,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    level: {
      type: Number,
      required: true,
    },
    semester: {
      type: String,
      required: true,
      enum: ["First", "Second"],
    },
    session: {
      type: String,
      required: true, // e.g. "2024/2025"
    },
    lecturer: {
      type: String,
      default: null,
    },
    lecturerPhone: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);