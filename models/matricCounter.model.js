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

module.exports = mongoose.model("MatricCounter", matricCounterSchema);
