const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  finance: { type: mongoose.Schema.Types.ObjectId, ref: 'Finance', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  reference: { type: String, required: true, unique: true },
  fingerprint: { type: String, required: true },
  payments: [{ itemLabel: String, amountPaid: Number, currency: String }],
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  reversedAt: Date, reversalReason: String,
  reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });
module.exports = mongoose.model('Payment', schema);
