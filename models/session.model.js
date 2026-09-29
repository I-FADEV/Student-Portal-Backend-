const mongoose = require('mongoose');
const schema = new mongoose.Schema({
 session: { type: String, required: true, unique: true },
 phase: { type: String, enum: ['first','second','summer'], default: 'first' },
 status: { type: String, enum: ['active','inactive','scheduled','closed'], default: 'inactive' },
 startDate: Date, endDate: Date,
 createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
 history: [{ phase: String, action: String, date: Date }]
}, { timestamps: true, optimisticConcurrency: true });
schema.index({ status: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
module.exports = mongoose.model('Session', schema);
