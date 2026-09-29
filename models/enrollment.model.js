const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  session: { type: String, required: true }, semester: { type: String, required: true },
  department: String, faculty: String, level: Number,
}, { timestamps: true });
schema.index({ student: 1, session: 1, semester: 1 }, { unique: true });
module.exports = mongoose.model('Enrollment', schema);
