const mongoose = require('mongoose');
const Finance = require('../models/finance.model');
const Audit = require('../models/auditLog.model');
const AppError = require('../utils/appError');
const recalculate = require('../utils/financeRecalculator');

// Existing carryovers must be classified explicitly; never silently forgive debt.
async function reconcile(id, { mode, sourceId, reason }, actor) {
  if (!['duplicate','opening'].includes(mode) || typeof reason !== 'string' || reason.trim().length < 10) throw new AppError('Choose a balance treatment and give a reason of at least ten characters',400);
  const session = await mongoose.startSession();
  let finance;
  try {
    await session.withTransaction(async()=>{
      finance = await Finance.findById(id).session(session);
      if(!finance || !finance.carriedOverBalance) throw new AppError('No legacy balance to reconcile',409);
      if(finance.carriedOverPaid) throw new AppError('This legacy balance has payments; reconcile it with the ledger first',409);
      const before = finance.toObject();
      if(mode === 'duplicate') {
        const source = await Finance.findById(sourceId).session(session);
        if(!source || source.id===finance.id || String(source.student)!==String(finance.student) || source.createdAt>finance.createdAt) throw new AppError('Choose the earlier source record for this student',400);
        recalculate(source);
        if(source.carriedOverBalance || source.totalsByCurrency[finance.currency]?.outstandingBalance !== finance.carriedOverBalance) throw new AppError('The source balance does not exactly match. Manual review is required.',409);
      } else {
        const label = `Opening balance (${finance.session} ${finance.semester})`;
        if(finance.items.some(i=>i.label===label)) throw new AppError('An opening balance already exists',409);
        finance.items.push({label,amount:finance.carriedOverBalance,paidAmount:0,currency:finance.currency,feeCode:'OPENING_BALANCE'});
      }
      finance.carriedOverBalance=0;finance.carriedOverPaid=0;recalculate(finance);await finance.save({session});
      await Audit.create([{performedBy:actor.userId,adminType:actor.adminType,action:'UPDATE',targetType:'FINANCE',targetId:finance.id,affectedStudent:finance.student,description:`Legacy balance reconciled as ${mode}: ${reason.trim()}`,changes:{before,after:{...finance.toObject(),sourceId}}}],{session});
    });
    return finance;
  } finally {await session.endSession();}
}
module.exports={reconcile};
