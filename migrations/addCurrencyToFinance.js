const mongoose = require("mongoose");
const Finance = require("../models/finance.model");

// Migration script to add currency field to existing Finance records
// Run this script: node migrations/addCurrencyToFinance.js

const migrate = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/student-portal";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Update all finance records without currency field to default to 'NGN'
    const result = await Finance.updateMany(
      { currency: { $exists: false } },
      { $set: { currency: "NGN" } }
    );

    console.log(`Migration completed: ${result.modifiedCount} records updated`);
    
    // Verify the migration
    const missingCurrency = await Finance.countDocuments({ currency: { $exists: false } });
    if (missingCurrency === 0) {
      console.log("✓ All finance records now have currency field");
    } else {
      console.log(`✗ ${missingCurrency} records still missing currency field`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();
