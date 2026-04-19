const mongoose = require("mongoose");

const idCardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true, // ensures 1 student = 1 ID card
    },
    photoURL: {
      type: String,
      required: true,
    },

    nameOnCard: {
      type: String,
      required: true,
      trim: true,
    },

    matricOnCard: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    departmentOnCard: {
      type: String,
      required: true,
      trim: true,
    },

    levelOnCard: {
      type: String,
      required: true,
    },

    sessionOnCard: {
      type: String,
      required: true,
    },

    paidStatus: {
      type: String,
      enum: ["Paid", "Unpaid"],
      default: "Unpaid",
    },

    collectedStatus: {
      type: String,
      enum: ["Collected", "Not Collected"],
      default: "Not Collected",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("IdCard", idCardSchema);
