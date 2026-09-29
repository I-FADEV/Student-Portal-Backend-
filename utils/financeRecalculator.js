const AppError = require('./appError');
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
module.exports = function recalculate(finance) {
 const totals = {};
 const labels = new Set();
 for (const item of finance.items) {
  const key = item.label.trim().toLowerCase();
  if (labels.has(key)) throw new AppError('Fee labels must be unique within a record', 400);
  labels.add(key);
  item.currency ||= finance.currency || 'NGN';
  item.amount = round(item.amount); item.paidAmount = round(item.paidAmount || 0);
  if (!['NGN','XAF'].includes(item.currency) || !Number.isFinite(item.amount) || !Number.isFinite(item.paidAmount) || item.amount < 0 || item.paidAmount < 0 || item.paidAmount > item.amount) throw new AppError('Invalid fee or payment amount', 400);
  item.feeCode ||= /^id[ -]?card$/i.test(item.label.trim()) ? 'ID_CARD' : null;
  item.status = item.paidAmount === item.amount ? 'Paid' : item.paidAmount ? 'Partial' : 'Unpaid';
  totals[item.currency] ||= { totalAmount:0, totalPaid:0, outstandingBalance:0 };
  totals[item.currency].totalAmount = round(totals[item.currency].totalAmount + item.amount);
  totals[item.currency].totalPaid = round(totals[item.currency].totalPaid + item.paidAmount);
 }
 const debt = round(finance.carriedOverBalance || 0), debtPaid = round(finance.carriedOverPaid || 0);
 if (!Number.isFinite(debt) || !Number.isFinite(debtPaid) || debt < 0 || debtPaid < 0 || debtPaid > debt) throw new AppError('Invalid legacy balance',400);
 if (debt > 0) {
  const currency = finance.currency || 'NGN';
  totals[currency] ||= { totalAmount:0, totalPaid:0, outstandingBalance:0 };
  totals[currency].totalAmount = round(totals[currency].totalAmount + debt);
  totals[currency].totalPaid = round(totals[currency].totalPaid + debtPaid);
 }
 for (const value of Object.values(totals)) value.outstandingBalance = round(value.totalAmount - value.totalPaid);
 finance.totalsByCurrency = totals;
 const currencies = Object.keys(totals);
 // A mixed-currency amount has no scalar monetary meaning.
 for (const field of ['totalAmount','totalPaid','outstandingBalance']) finance[field] = currencies.length === 1 ? totals[currencies[0]][field] : null;
 finance.paymentStatus = Object.values(totals).every(t => t.outstandingBalance === 0) ? 'Paid' : Object.values(totals).some(t => t.totalPaid > 0) ? 'Partial' : 'Unpaid';
 return finance;
};
