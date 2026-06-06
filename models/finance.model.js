const mongoose = require("mongoose");

const financeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    session: {
      type: String,
      required: true, // e.g. "2025/2026"
    },

    semester: {
      type: String,
      enum: ["First", "Second"],
      required: true,
    },

    currency: {
      type: String,
      enum: ["NGN", "XAF"],
      default: "NGN",
      required: true,
    },

    //Each payment component
    items: [
      {
        label: {
          type: String,
          required: true, // e.g. "Tuition", "ID Card", "Library Fee"
        },

        amount: {
          type: Number,
          required: true,
          min: 0,
        },

        currency: {
          type: String,
          enum: ["NGN", "XAF"],
          required: true,
        },

        paidAmount: {
          type: Number,
          default: 0,
          min: 0,
        },

        status: {
          type: String,
          enum: ["Paid", "Partial", "Unpaid"],
          default: "Unpaid",
        },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    outstandingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    carriedOverBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["Paid", "Partial", "Unpaid"],
      default: "Unpaid",
    },
  },
  { timestamps: true },
);

// Drop old index and create new one with semester to prevent duplicates per student/session/semester
financeSchema.index({ student: 1, session: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model("Finance", financeSchema);
