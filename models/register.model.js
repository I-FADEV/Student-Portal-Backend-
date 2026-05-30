const mongoose = require("mongoose");

// Department belongs to a faculty, and has levels (e.g. 100, 200, 300, 400)
const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  minLevel: { type: Number, required: true },
  maxLevel: { type: Number, required: true },
});

const registerSchema = new mongoose.Schema(
  {
    faculty: { type: String, required: true, unique: true },
    departments: [departmentSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Register", registerSchema);
