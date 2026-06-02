const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: null,
    },
    matricNumber: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "student",
    },
    department: {
      type: String,
      default: null,
    },
    faculty: {
      type: String,
      default: null,
    },
    level: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Student", studentSchema);
