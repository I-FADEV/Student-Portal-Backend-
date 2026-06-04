const mongoose = require("mongoose");

const matricCounterSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
      unique: true,
    },
    counter: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

// Ensure unique level (counter is shared across all departments at the same level)
matricCounterSchema.index({ level: 1 }, { unique: true });

module.exports = mongoose.model("MatricCounter", matricCounterSchema);
