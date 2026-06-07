const mongoose = require("mongoose");

const financeTemplateSchema = new mongoose.Schema(
  {
    target: {
      type: String,
      enum: ["department", "faculty", "all"],
      required: true,
    },

    department: {
      type: String,
      required: function () {
        return this.target === "department";
      },
    },

    faculty: {
      type: String,
      required: function () {
        return this.target === "faculty";
      },
    },

    level: {
      type: Number,
      required: false,
    },

    items: [
      {
        label: {
          type: String,
          required: true,
        },

        amount: {
          type: Number,
          required: true,
          min: 0,
        },

        currency: {
          type: String,
          enum: ["NGN", "XAF"],
          required: false,
        },
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure only one active template per target/department/faculty/level combination
financeTemplateSchema.index(
  { target: 1, department: 1, faculty: 1, level: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model("FinanceTemplate", financeTemplateSchema);
