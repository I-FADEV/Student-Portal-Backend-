const logAction          = require("../utils/logAction");
const Finance            = require("../models/finance.model");
const IdCard             = require("../models/idcard.model");
const Student            = require("../models/student.model");
const recalculateFinance = require("../utils/financeRecalculator");
const mongoose           = require("mongoose");
const AppError           = require("../utils/appError");

// ── CREATE single finance record ───────────────────────────────────────────────
const createFinanceService = async ({ session, semester, items, studentId, performedBy, ipAddress }) => {
  const existing = await Finance.findOne({ student: studentId, session, semester });
  if (existing) throw new AppError("Finance Record already exists", 409);

  const previousRecords = await Finance.find({
    student: studentId,
    session: { $ne: session },
    outstandingBalance: { $gt: 0 },
  });
  const carriedOverBalance = previousRecords.reduce((sum, r) => sum + r.outstandingBalance, 0);

  const finance = new Finance({ student: studentId, session, semester, items, carriedOverBalance });
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
const payFinanceAndSyncIdCardService = async ({ financeId, payments, performedBy, ipAddress }) => {
  const mongoSession = await mongoose.startSession();
  try {
    mongoSession.startTransaction();

    const finance = await Finance.findById(financeId).session(mongoSession);
    if (!finance) throw new AppError("Finance not found", 404);

    const before = { totalPaid: finance.totalPaid, outstandingBalance: finance.outstandingBalance };

    for (const payment of payments) {
      const item = finance.items.find((i) => i.label === payment.itemLabel);
      if (!item) throw new AppError(`Item "${payment.itemLabel}" not found`, 404);
      if (item.paidAmount + payment.amountPaid > item.amount) {
        throw new AppError(`Payment for "${payment.itemLabel}" exceeds required amount`, 400);
      }
      item.paidAmount += payment.amountPaid;
    }

    recalculateFinance(finance);
    finance.markModified("items");
    await finance.save({ session: mongoSession });

    // Auto-sync ID card fee status
    const idCardItem = finance.items.find((i) => i.label.toLowerCase() === "id card");
    if (idCardItem) {
      await IdCard.findOneAndUpdate(
        { student: finance.student },
        { feePaid: idCardItem.status === "Paid", feePaidAt: idCardItem.status === "Paid" ? new Date() : null },
        { session: mongoSession, new: true },
      );
    }

    await mongoSession.commitTransaction();
    mongoSession.endSession();

    await logAction({
      performedBy,
      action: "UPDATE",
      targetType: "FINANCE",
      targetId: finance._id,
      affectedStudent: finance.student,
      description: `Payment recorded — balance now ₦${finance.outstandingBalance}`,
      changes: { before, after: { totalPaid: finance.totalPaid, outstandingBalance: finance.outstandingBalance } },
      ipAddress,
    });

    return { finance };
  } catch (err) {
    await mongoSession.abortTransaction();
    throw err;
  } finally {
    mongoSession.endSession();
  }
};

// ── VIEW student's own finance records ────────────────────────────────────────
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
const viewAllFinanceService = async ({ session, semester, studentId } = {}) => {
  const query = {};
  if (session)   query.session  = session;
  if (semester)  query.semester = semester;
  if (studentId) query.student  = studentId;

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

  const totalFeesCreated = allRecords.reduce((s, r) => s + (r.totalAmount        || 0), 0);
  const totalCollected   = allRecords.reduce((s, r) => s + (r.totalPaid          || 0), 0);
  const totalOutstanding = allRecords.reduce((s, r) => s + (r.outstandingBalance || 0), 0);

  return { data: { totalStudents, totalFeesCreated, totalCollected, totalOutstanding } };
};

// ── BULK finance creation ──────────────────────────────────────────────────────
const createBulkFinanceService = async ({
  session, semester, items,
  target, department, level, faculty,
  performedBy, ipAddress,
}) => {
  const filter = {};
  if (target === "department") {
    if (department) filter.department = department;
    if (level)      filter.level      = Number(level);
  } else if (target === "faculty") {
    if (faculty) filter.faculty = faculty;
  }
  // target === "all" → no filter

  const students = await Student.find(filter).select("_id name matricNumber");
  if (!students.length) throw new AppError("No students found for this target", 404);

  let created = 0, skipped = 0;

  for (const student of students) {
    const existing = await Finance.findOne({ student: student._id, session, semester });
    if (existing) { skipped++; continue; }

    const previousRecords = await Finance.find({
      student: student._id,
      session: { $ne: session },
      outstandingBalance: { $gt: 0 },
    });
    const carriedOverBalance = previousRecords.reduce((s, r) => s + r.outstandingBalance, 0);

    const finance = new Finance({ student: student._id, session, semester, items, carriedOverBalance });
    recalculateFinance(finance);
    await finance.save();

    await logAction({
      performedBy,
      action: "CREATE",
      targetType: "FINANCE",
      targetId: finance._id,
      affectedStudent: student._id,
      description: `Bulk: finance record created for ${student.name || student.matricNumber} — ${session} ${semester}`,
      ipAddress,
    });

    created++;
  }

  return { data: { created, skipped, total: students.length } };
};

// ── ADD ITEM to existing record ────────────────────────────────────────────────
const addItemToFinanceService = async ({ financeId, label, amount, performedBy, ipAddress }) => {
  const finance = await Finance.findById(financeId).populate("student", "name matricNumber");
  if (!finance) throw new AppError("Finance record not found", 404);

  const exists = finance.items.find((i) => i.label.toLowerCase() === label.toLowerCase());
  if (exists) throw new AppError(`Item "${label}" already exists in this record`, 409);

  finance.items.push({ label, amount, paidAmount: 0, status: "Unpaid" });
  recalculateFinance(finance);
  finance.markModified("items");
  await finance.save();

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "FINANCE",
    targetId: finance._id,
    affectedStudent: finance.student?._id,
    description: `Item "${label}" (₦${amount}) added to finance record for ${finance.student?.name || finance.student?.matricNumber}`,
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