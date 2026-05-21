const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },
    time: {
      type: String,
      required: true, // e.g. "8:00 AM - 10:00 AM"
    },
    courseCode: {
      type: String,
      required: true,
    },
    courseName: {
      type: String,
      required: true,
    },

    lecturer: {
      type: String,
      default: null,
    },
    department: {
      type: String,
      required: true,
    },
    level: {
      type: Number,
      required: true,
    },
    session: {
      type: String,
      required: true, // e.g. "2024/2025"
    },
    semester: {
      type: String,
      required: true,
      enum: ["First", "Second"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Timetable", timetableSchema);