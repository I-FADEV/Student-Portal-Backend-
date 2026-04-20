const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
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
    email: {
      type: String,
      default: null,
    },
    department: {
      type: String,
      default: null,
    },
    level: {
      type: Number,
      default: null,
    },
    photoURL: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Student", studentSchema);
