const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    session: {
      type: String,
      required: true,
      unique: true,
    },
    phase: {
      type: String,
      enum: ["first", "second", "summer"],
      default: "first",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "closed"],
      default: "inactive",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure only one active session at a time
sessionSchema.pre("save", async function (next) {
  if (this.status === "active") {
    // Deactivate all other sessions
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, status: "active" },
      { status: "inactive", endDate: new Date() }
    );
  }
  next();
});

module.exports = mongoose.model("Session", sessionSchema);
