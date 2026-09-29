const mongoose = require('mongoose');
const crypto = require('crypto');
const Finance = require('../models/finance.model');
const Payment = require('../models/payment.model');
const IdCard = require('../models/idcard.model');
const recalculate = require('../utils/financeRecalculator');
const AppError = require('../utils/appError');
const logAction = require('../utils/logAction');

async function syncCard(finance, session) {
  const records = await Finance.find({ student: finance.student }).session(session);
  const paid = records.some(r => r.items.some(i => (i.feeCode === 'ID_CARD' || /^id[ -]?card$/i.test(i.label.trim())) && i.amount > 0 && i.paidAmount >= i.amount));
  await IdCard.findOneAndUpdate({ student: finance.student }, { $set: { feePaid: paid, feePaidAt: paid ? new Date() : null } }, { upsert: true, new: true, session, setDefaultsOnInsert: true });
}
async function record({ financeId, payments, reference, performedBy, ipAddress }) {
  if (!reference || !/^[\w.-]{8,100}$/.test(reference)) throw new AppError('A payment reference of 8–100 letters, digits, dots or hyphens is required', 400);
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ financeId, payments })).digest('hex');
  const session = await mongoose.startSession();
  let finance, receipt;
  try {
    await session.withTransaction(async () => {
      const existing = await Payment.findOne({ reference }).session(session);
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new AppError('This reference belongs to a different payment', 409);
        receipt = existing; finance = await Finance.findById(existing.finance).session(session); return;
      }
      finance = await Finance.findById(financeId).session(session);
      if (!finance) throw new AppError('Finance record not found', 404);
      if (!Array.isArray(payments) || !payments.length) throw new AppError('Payments are required', 400);
      const entries = [];
      for (const payment of payments) {
        const amount = Number(payment.amountPaid);
        if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) throw new AppError('Payment must be positive with at most two decimal places', 400);
        const item = finance.items.find(i => i.label === payment.itemLabel);
        if (!item) throw new AppError('Fee item not found', 404);
        if (Math.round((item.paidAmount + amount) * 100) > Math.round(item.amount * 100)) throw new AppError(`Payment exceeds the balance for ${item.label}`, 400);
        item.paidAmount = Math.round((item.paidAmount + amount) * 100) / 100;
        entries.push({ itemLabel: item.label, amountPaid: amount, currency: item.currency || finance.currency });
      }
      recalculate(finance); await finance.save({ session });
      [receipt] = await Payment.create([{ finance: finance.id, student: finance.student, reference, fingerprint, payments: entries, recordedBy: performedBy }], { session });
      await syncCard(finance, session);
    });
  } catch (error) {
    if (error.code === 11000) {
      const prior = await Payment.findOne({ reference });
      if (prior?.fingerprint === fingerprint) return { finance: await Finance.findById(financeId), receipt: prior };
    }
    throw error;
  } finally { await session.endSession(); }
  await logAction({ performedBy, ipAddress, action: 'UPDATE', targetType: 'FINANCE', targetId: finance.id, affectedStudent: finance.student, description: `Payment recorded: ${reference}`, changes: { before: null, after: { reference, payments: receipt.payments } } });
  return { finance, receipt };
}
async function reverse(id, reason, performedBy, ipAddress) {
  if (typeof reason !== 'string' || reason.trim().length < 5) throw new AppError('Give a reversal reason of at least five characters', 400);
  const session = await mongoose.startSession();
  let receipt, finance;
  try {
    await session.withTransaction(async () => {
      receipt = await Payment.findById(id).session(session);
      if (!receipt) throw new AppError('Payment not found', 404);
      if (receipt.reversedAt) throw new AppError('Payment already reversed', 409);
      finance = await Finance.findById(receipt.finance).session(session);
      if (!finance) throw new AppError('Finance record not found', 404);
      for (const payment of receipt.payments) {
        const item = finance.items.find(i => i.label === payment.itemLabel);
        if (!item || item.paidAmount < payment.amountPaid) throw new AppError('Payment requires manual reconciliation', 409);
        item.paidAmount = Math.round((item.paidAmount - payment.amountPaid) * 100) / 100;
      }
      recalculate(finance); await finance.save({ session });
      receipt.reversedAt = new Date(); receipt.reversalReason = reason.trim(); receipt.reversedBy = performedBy;
      await receipt.save({ session }); await syncCard(finance, session);
    });
  } finally { await session.endSession(); }
  await logAction({ performedBy, ipAddress, action: 'UPDATE', targetType: 'FINANCE', targetId: finance.id, affectedStudent: finance.student, description: `Payment reversed: ${receipt.reference}; ${reason}` });
  return { finance, receipt };
}
module.exports = { record, reverse, syncCard };
