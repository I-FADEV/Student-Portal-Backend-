const mongoose = require("mongoose");

const targetSchema = new mongoose.Schema(
  {
    type:  { type: String, enum: ["department", "faculty"], required: true },
    name:  { type: String, required: true },
    level: { type: Number, required: true },
  },
  { _id: false }
);

const timetableCourseSchema = new mongoose.Schema(
  {
    courseCode:    { type: String, required: true, uppercase: true, trim: true },
    courseName:    { type: String, required: true, trim: true },
    lecturer:      { type: String, required: true, trim: true },
    lecturerPhone: { type: String, default: null },

    // Who takes this course — can be multiple dept+level or faculty+level combos
    targets: {
      type:    [targetSchema],
      validate: {
        validator: (v) => v && v.length > 0,
        message: "At least one target is required",
      },
    },

    session:  { type: String, required: true }, // e.g. "2025/2026"
    semester: { type: String, enum: ["First", "Second"], required: true },
  },
  { timestamps: true }
);

// One course code per session+semester — no duplicates
timetableCourseSchema.index(
  { courseCode: 1, session: 1, semester: 1 },
  { unique: true }
);

module.exports = mongoose.model("TimetableCourse", timetableCourseSchema);