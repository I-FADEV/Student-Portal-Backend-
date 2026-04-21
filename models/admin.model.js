const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    adminType: {
      type: String,
      enum: [
        "general_admin",
        "finance_admin",
        "idcard_admin",
        "timetable_admin",
      ],
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Admin", adminSchema);
