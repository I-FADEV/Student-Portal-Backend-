const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    student: {
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
      min: 0,
      max: 40,
    },
    exam: {
      type: Number,
      min: 0,
      max: 60,
    },
    total: {
      type: Number,
    },
    grade: {
      type: String,
    },
    sourceSheet: {type: mongoose.Schema.Types.ObjectId, ref:'ScoreSheet', default:null},
    outcome: {type:String,enum:['graded','absent'],default:'graded'},
    session: {
      type: String,
      required: true, // e.g. "2024/2025"
    },
    semester: {
      type: String,
      required: true,
      enum: ["First", "Second", "Summer"],
    },
  },
  { timestamps: true },
);

resultSchema.index({ student: 1, courseCode: 1, session: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model("Result", resultSchema);
