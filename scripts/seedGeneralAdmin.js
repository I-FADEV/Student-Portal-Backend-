require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("../models/admin.model");
const connectDB = require("../config/db");

const seed = async () => {
  await connectDB();

  const existing = await Admin.findOne({ adminType: "general_admin" });
  if (existing) {
    console.log("General admin already exists, skipping.");
    process.exit();
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("changeme123", salt);

  await Admin.create({
    username: "generaladmin",
    password: hashedPassword,
    role: "admin",
    adminType: "general_admin",
  });

  console.log(
    "General admin created. Username: generaladmin, Password: changeme123",
  );
  console.log("Change the password immediately after first login!");
  process.exit();
};

seed();
