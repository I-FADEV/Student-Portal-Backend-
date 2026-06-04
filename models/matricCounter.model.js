const mongoose = require("mongoose");

const matricCounterSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    level: {
      type: Number,
      required: true,
    },
    counter: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

// Ensure unique combination of department and level
matricCounterSchema.index({ department: 1, level: 1 }, { unique: true });

module.exports = mongoose.model("MatricCounter", matricCounterSchema);
