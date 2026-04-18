const mongoose = require('mongoose');

const idCardSchema = new mongoose.Schema(
  {
    photoURL: {
      type: String,
      required: true,
    },

    nameOnCard: {
      type: String,
      required: true,
      trim: true,
    },

    matricOnCard: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    departmentOnCard: {
      type: String,
      required: true,
      trim: true,
    },

    levelOnCard: {
      type: String,
      required: true,
    },

    sessionOnCard: {
      type: String,
      required: true,
    },

    paidStatus: { //FIX
      type: String,
      enum: ['Paid', 'Unpaid'],
      default: 'Unpaid',
    },

    collectedStatus: {
      type: String,
      enum: ['Collected', 'Not Collected'],
      default: 'Not Collected',
    },
  },
  { timestamps: true } // createdAt = submission time
);

module.exports = mongoose.model('IDCard', idCardSchema);
