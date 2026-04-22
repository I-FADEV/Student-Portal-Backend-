const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseTitle: { type: String, required: true, unique: true },
  courseCode: { type: String, required: true, unique: true },
  creditUnits: { type: Number, required: true },
  department: { type: String, required: true },
  level: { type: String, required: true },
});

module.exports = mongoose.model("Course", courseSchema);
