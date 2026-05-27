const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    courseCode: {
      type: String,
      required: true,
      uppercase: true,
    },
    courseName: {
      type: String,
      required: true,
    },
    creditUnit: {
      type: Number,
      required: true,
    },
    test: {
      type: Number,
      required: true,
      min: 0,
      max: 40,
    },
    exam: {
      type: Number,
      required: true,
      min: 0,
      max: 60,
    },
    total: {
      type: Number,
    },
    grade: {
      type: String,
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
  { timestamps: true },
);

module.exports = mongoose.model("Result", resultSchema);