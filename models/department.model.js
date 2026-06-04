const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
    },
    minLevel: {
      type: Number,
      required: true,
    },
    maxLevel: {
      type: Number,
      required: true,
    },
    abbreviation: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
    },
  },
  { timestamps: true }
);

// Prevent two departments with the same name in the same faculty
departmentSchema.index({ name: 1, faculty: 1 }, { unique: true });

module.exports = mongoose.model("Department", departmentSchema);