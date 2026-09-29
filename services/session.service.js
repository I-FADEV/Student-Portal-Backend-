const mongoose = require('mongoose');
const Session = require('../models/session.model');
const AppError = require('../utils/appError');
const logAction = require('../utils/logAction');
const Lock = mongoose.models.AcademicLock || mongoose.model('AcademicLock',new mongoose.Schema({_id:String,revision:Number}));
const semesters = { first: 'First', second: 'Second', summer: 'Summer' };
const present = doc => doc ? { ...doc.toObject(), semester: semesters[doc.phase] } : null;

async function activateDue() {
  // A unique partial index prevents two simultaneous active sessions.
  if (await Session.exists({ status: 'active' })) return;
  const due = await Session.findOne({ status: 'scheduled', startDate: { $lte: new Date() } }).sort({ startDate: 1 });
  if (!due) return;
  try {
    await Session.findOneAndUpdate({ _id: due._id, status: 'scheduled' }, { $set: { status: 'active' }, $push: { history: { phase: due.phase, action: 'started', date: new Date() } } }, { runValidators: true });
  } catch (error) { if (error.code !== 11000) throw error; }
}
async function current(activeOnly = false) {
  await activateDue();
  const doc = await Session.findOne(activeOnly ? { status: 'active' } : { status: { $ne: 'closed' } }).sort({ createdAt: -1 });
  return present(doc);
}
function timing(startNow, startDate) {
  if (typeof startNow !== 'boolean') throw new AppError('Choose whether to start now or schedule a date', 400);
  if (startNow) return { status: 'active', startDate: new Date() };
  const date = new Date(startDate);
  if (!startDate || !Number.isFinite(date.getTime()) || date <= new Date()) throw new AppError('Choose a future start date', 400);
  return { status: 'scheduled', startDate: date };
}
async function change(action, body, user, ipAddress) {
  const transaction = await mongoose.startSession();
  let result;
  try {
    await Lock.updateOne({_id:"academic"},{$setOnInsert:{revision:0}},{upsert:true});
    await transaction.withTransaction(async () => {
      await Lock.updateOne({_id:"academic"},{$inc:{revision:1}},{session:transaction});
      const doc = await Session.findOne({ status: { $ne: 'closed' } }).session(transaction).sort({ createdAt: -1 });
      if (action === 'create') {
        const match = /^(\d{4})\/(\d{4})$/.exec(body.session || '');
        if (!match || Number(match[2]) !== Number(match[1]) + 1) throw new AppError('Use consecutive years, e.g. 2026/2027', 400);
        if (doc) throw new AppError('Close the current session before creating another', 409);
        const [created] = await Session.create([{ session: body.session, phase: 'first', ...timing(body.startNow, body.startDate), createdBy: user.userId, history: [{ phase: 'first', action: body.startNow ? 'started' : 'scheduled', date: new Date() }] }], { session: transaction });
        result = created;
      } else {
        if (!doc) throw new AppError('No open academic session', 404);
        if (body.sessionId && body.sessionId !== doc.id) throw new AppError('Session changed. Refresh and try again.', 409);
        if (action === 'end') {
          if (doc.status !== 'active') throw new AppError('Only an active phase can be ended', 409);
          doc.history.push({ phase: doc.phase, action: 'ended', date: new Date() });
          doc.phase = { first: 'second', second: 'summer', summer: 'summer' }[doc.phase];
          doc.status = doc.history.at(-1).phase === 'summer' ? 'closed' : 'inactive';
          doc.endDate = new Date(); doc.startDate = null;
        } else if (action === 'start') {
          if (doc.status === 'active') throw new AppError('End the active phase first', 409);
          if (body.phase !== doc.phase) throw new AppError(`The next phase is ${doc.phase}`, 409);
          Object.assign(doc, timing(body.startNow, body.startDate)); doc.endDate = null;
          doc.history.push({ phase: doc.phase, action: body.startNow ? 'started' : 'scheduled', date: new Date() });
        } else if (action === 'close') {
          if (doc.phase !== 'summer' || doc.status === 'active') throw new AppError('End the current phase before closing; Summer may be skipped', 409);
          doc.status = 'closed'; doc.endDate = new Date();
          doc.history.push({ phase: doc.phase, action: 'closed', date: new Date() });
        } else throw new AppError('Unknown session action', 400);
        result = await doc.save({ session: transaction });
      }
    });
  } finally { await transaction.endSession(); }
  await logAction({ performedBy: user.userId, action: action === 'create' ? 'CREATE' : 'UPDATE', targetType: 'SESSION', targetId: result.id, description: `Session ${result.session}: ${action} (${result.phase}, ${result.status})`, ipAddress });
  return present(result);
}
module.exports = { current, change, activateDue, present, semesters };
