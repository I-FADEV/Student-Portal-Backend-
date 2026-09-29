require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/admin.model');
const { validateEnvironment } = require('../config/environment');
async function seed() {
  validateEnvironment();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) throw new Error('Set SEED_ADMIN_PASSWORD to a unique password of at least 12 characters.');
  await mongoose.connect(process.env.MONGO_URI);
  if (await Admin.exists({ adminType: 'general_admin' })) return console.log('General admin already exists; no changes made.');
  await Admin.create({ username: process.env.SEED_ADMIN_USERNAME || 'generaladmin', password, role: 'admin', adminType: 'general_admin' });
  console.log('General admin created. Credentials were not logged.');
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
