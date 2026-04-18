const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema({
  student:  { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  session:  { type: String, required: true },
  semester: { type: String, required: true },

  items: [
    {
      label:  { type: String, required: true },
      amount: { type: Number, required: true },
      status: { type: String, enum: ['Paid', 'Unpaid'], required: true },
    }
  ],

  outstandingBalance: { type: Number, default: 0 },
});

module.exports = mongoose.model('Finance', financeSchema);
