const mongoose = require("mongoose");

const idCardSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
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
      type: Number,
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

idCardSchema.index({ student: 1, sessionOnCard: 1 }, { unique: true });
module.exports = mongoose.model("IdCard", idCardSchema);
