const mongoose = require('mongoose');
module.exports = mongoose.model('MatricReservation', new mongoose.Schema({
 matricNumber: { type: String, unique: true, required: true },
 department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, level: Number,
 createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true }));
