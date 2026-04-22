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

    nationalityOnCard: {
      type: String,
      required: true,
    },

    dobOnCard: {
      type: String,
      required: true,
      trim: true,
    },

    departmentOnCard: {
      type: String,
      required: true,
      trim: true,
    },

    sessionOnCard: {
      type: String,
      required: true,
    },

    genderOnCard: {
      type: String,
      enum: ["Male", "Female"],
      default: "Male",
    },

    levelOnCard: {
      type: Number,
      required: true,
    },

    matricOnCard: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    telOnCard: {
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
      enum: ["Pending", "Collected", "Not Collected"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

idCardSchema.index({ student: 1, sessionOnCard: 1 }, { unique: true });
module.exports = mongoose.model("IdCard", idCardSchema);
