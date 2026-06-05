const mongoose = require("mongoose");

const TIME_SLOTS = [
  "8:00 - 10:00",
  "10:00 - 12:00",
  "1:00 - 3:00",
  "3:00 - 5:00",
];

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
      enum: TIME_SLOTS,
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
    lecturerPhone: {
      type: String,
      default: null,
    },
    venue: {
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
  { timestamps: true },
);

// prevents duplicate class slots
timetableSchema.index(
  { day: 1, time: 1, department: 1, level: 1, session: 1, semester: 1 },
  { unique: true }
);

module.exports = mongoose.model("Timetable", timetableSchema);