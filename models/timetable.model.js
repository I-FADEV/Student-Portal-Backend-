const mongoose = require("mongoose");

const TIME_SLOTS = ["8:00 - 10:00", "10:00 - 12:00", "1:00 - 3:00", "3:00 - 5:00"];

const timetableSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },
    time: {
      type: String,
      required: true,
      enum: TIME_SLOTS, // strictly one of the 4 fixed slots
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
      required: true,
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