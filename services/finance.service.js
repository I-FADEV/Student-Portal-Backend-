const logAction          = require("../utils/logAction");
const Finance            = require("../models/finance.model");
const IdCard             = require("../models/idcard.model");
const Student            = require("../models/student.model");
const recalculateFinance = require("../utils/financeRecalculator");
const { getActiveSession } = require("../utils/activeSession");
const mongoose           = require("mongoose");
const AppError           = require("../utils/appError");
const { createFinanceTemplateService, applyTemplateToExistingStudents } = require("./financeTemplate.service");

// ── CREATE single finance record ───────────────────────────────────────────────
const createFinanceService = async ({ session, semester, items, studentId, performedBy, ipAddress }) => {
  // Auto-fetch active session if not provided
  if (!session || !semester) {
    const activeSession = await getActiveSession();
    session = session || activeSession.session;
    semester = semester || activeSession.semester;
  }

  // Validate items have currency (optional for backward compatibility)
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError("Items array is required", 400);
  }
  for (const item of items) {
    if (item.currency && !["NGN", "XAF"].includes(item.currency)) {
      throw new AppError(`Item "${item.label}" must have a valid currency (NGN or XAF)`, 400);
    }
  }

  const existing = await Finance.findOne({ student: studentId, session, semester });
  if (existing) throw new AppError("Finance Record already exists", 409);

  // Prior fees remain payable on their original records; never duplicate debt in a new term.
    const carriedOverBalance = 0;

  // Derive currency from first item for backward compatibility
  const currency = items[0]?.currency || "NGN";

  const finance = new Finance({ student: studentId, session, semester, items, carriedOverBalance, currency });
  recalculateFinance(finance);
  await finance.save();

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "FINANCE",
    targetId: finance._id,
    affectedStudent: studentId,
    description: `Finance record created for ${session} ${semester} semester`,
    ipAddress,
  });

  return { data: finance };
};

// ── PAY finance + sync ID card status ────────────────────────────────────────
const payFinanceAndSyncIdCardService = require('./payment.service').record;

const viewStudentFinance = async ({ session, semester, studentId }) => {
  const query = { student: studentId };
  if (session)  query.session  = session;
  if (semester) query.semester = semester;

  if (session && semester) {
    const record = await Finance.findOne(query);
    return { data: record || null };
  }
  const records = await Finance.find(query).sort({ createdAt: -1 });
  return { data: records };
};

// ── VIEW ALL records (admin branch) ───────────────────────────────────────────
const viewAllFinanceService = async ({ session, semester, studentId, status } = {}) => {
  const query = {};
  if (session)   query.session  = session;
  if (semester)  query.semester = semester;
  if (studentId) query.student  = studentId;
  if (status)    query.paymentStatus = status;

  const records = await Finance.find(query)
    .populate("student", "name matricNumber department level")
    .sort({ createdAt: -1 });

  return { data: records };
};

// ── FINANCE STATS (bursar dashboard) ─────────────────────────────────────────
const getFinanceStatsService = async () => {
  const [totalStudents, allRecords] = await Promise.all([
    Student.countDocuments(),
    Finance.find(),
  ]);

  const totals = { NGN:{totalAmount:0,totalPaid:0,outstandingBalance:0}, XAF:{totalAmount:0,totalPaid:0,outstandingBalance:0} };
  for (const record of allRecords) {
    recalculateFinance(record);
    for (const [currency,values] of Object.entries(record.totalsByCurrency)) {
      for (const key of Object.keys(values)) totals[currency][key] = Math.round((totals[currency][key]+values[key])*100)/100;
    }
  }
  return {data:{totalStudents,totalsByCurrency:totals,
    totalFeesCreatedNGN:totals.NGN.totalAmount,totalFeesCreatedXAF:totals.XAF.totalAmount,
    totalCollectedNGN:totals.NGN.totalPaid,totalCollectedXAF:totals.XAF.totalPaid,
    totalOutstandingNGN:totals.NGN.outstandingBalance,totalOutstandingXAF:totals.XAF.outstandingBalance}};
};

// ── BULK finance creation ──────────────────────────────────────────────────────
const createBulkFinanceService = async ({
  session, semester, items,
  target, department, level, faculty,
  performedBy, ipAddress,
}) => {
  // Auto-fetch active session if not provided
  if (!session || !semester) {
    const activeSession = await getActiveSession();
    session = session || activeSession.session;
    semester = semester || activeSession.semester;
  }

  // Validate items have currency (optional for backward compatibility)
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError("Items array is required", 400);
  }
  for (const item of items) {
    if (item.currency && !["NGN", "XAF"].includes(item.currency)) {
      throw new AppError(`Item "${item.label}" must have a valid currency (NGN or XAF)`, 400);
    }
  }

  // Create finance template
  const { data: template } = await createFinanceTemplateService({
    target,
    department,
    faculty,
    level,
    items,
    performedBy,
    ipAddress,
  });

  // Apply template to existing students
  const { data: result } = await applyTemplateToExistingStudents({
    templateId: template._id,
    session,
    semester,
    performedBy,
    ipAddress,
  });

  return { data: result };
};

// ── ADD ITEM to existing record ────────────────────────────────────────────────
const addItemToFinanceService = async ({ financeId, label, amount, currency, performedBy, ipAddress }) => {
  const finance = await Finance.findById(financeId).populate("student", "name matricNumber");
  if (!finance) throw new AppError("Finance record not found", 404);

  // Validate currency
  if (!currency || !["NGN", "XAF"].includes(currency)) {
    throw new AppError("Currency must be NGN or XAF", 400);
  }

  const exists = finance.items.find((i) => i.label.toLowerCase() === label.toLowerCase());
  if (exists) throw new AppError(`Item "${label}" already exists in this record`, 409);

  finance.items.push({ label, amount, currency, paidAmount: 0, status: "Unpaid" });
  recalculateFinance(finance);
  finance.markModified("items");
  await finance.save();

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "FINANCE",
    targetId: finance._id,
    affectedStudent: finance.student?._id,
    description: `Item "${label}" (${currency}${amount}) added to finance record for ${finance.student?.name || finance.student?.matricNumber}`,
    ipAddress,
  });

  return { data: finance };
};

module.exports = {
  createFinanceService,
  payFinanceAndSyncIdCardService,
  viewStudentFinance,
  viewAllFinanceService,
  getFinanceStatsService,
  createBulkFinanceService,
  addItemToFinanceService,
};