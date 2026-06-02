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
        "registry_admin",
      ],
      required: true,
    },
  },
  { timestamps: true },
);

// 🔥 ADD THIS HOOK
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

module.exports = mongoose.model("Admin", adminSchema);
