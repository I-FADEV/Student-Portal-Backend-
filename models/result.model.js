const mongoose = require("mongoose");

// Grade calculation rules
function calculateGrade(total) {
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  if (total >= 45) return "D";
  if (total >= 40) return "E";
  return "F";
}

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
      max: 30,
    },
    exam: {
      type: Number,
      required: true,
      min: 0,
      max: 70,
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
  { timestamps: true }
);

// Auto-calculate total and grade before saving
resultSchema.pre("save", function (next) {
  this.total = this.test + this.exam;
  this.grade = calculateGrade(this.total);
  next();
});

// Also handle bulk insertions via insertMany (pre hook won't fire)
// So we expose the helper for use in service
resultSchema.statics.calculateGrade = calculateGrade;

module.exports = mongoose.model("Result", resultSchema);