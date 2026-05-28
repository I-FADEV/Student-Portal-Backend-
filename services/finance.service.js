const logAction = require("../utils/logAction");
const Finance = require("../models/finance.model");
const IdCard = require("../models/idcard.model");
const recalculateFinance = require("../utils/financeRecalculator");
const mongoose = require("mongoose");
const AppError = require("../utils/appError");

const createFinanceService = async ({
  session,
  semester,
  items,
  studentId,
  performedBy,
  ipAddress,
}) => {
  const existing = await Finance.findOne({
    student: studentId,
    session,
    semester,
  });

  if (existing) {
    throw new AppError("Finance Record already exists", 409);
  }

  const previousRecords = await Finance.find({
    student: studentId,
    session: { $ne: session },
    outstandingBalance: { $gt: 0 },
  });

  const carriedOverBalance = previousRecords.reduce(
    (sum, record) => sum + record.outstandingBalance,
    0,
  );

  const finance = new Finance({
    student: studentId,
    session,
    semester,
    items,
    carriedOverBalance,
  });

  recalculateFinance(finance);
  await finance.save();

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "FINANCE",
    targetId: finance._id,
    affectedStudent: studentId,
    description: `Finance record created for student (${session} ${semester})`,
    changes: {
      before: null,
      after: { session, semester, carriedOverBalance, totalItems: items.length },
    },
    ipAddress,
  });

  return { data: finance };
};

const payFinanceAndSyncIdCardService = async ({
  financeId,
  payments,
  performedBy,
  ipAddress,
}) => {
  const mongoSession = await mongoose.startSession();

  try {
    mongoSession.startTransaction();

    const finance = await Finance.findById(financeId).session(mongoSession);
    if (!finance) {
      throw new AppError("Finance not found", 404);
    }

    // Snapshot before state for the audit log
    const before = {
      totalPaid: finance.totalPaid,
      outstandingBalance: finance.outstandingBalance,
    };

    for (const payment of payments) {
      const item = finance.items.find((i) => i.label === payment.itemLabel);

      if (!item) {
        throw new AppError(`Item "${payment.itemLabel}" not found`, 404);
      }

      if (item.paidAmount + payment.amountPaid > item.amount) {
        throw new AppError(
          `Payment for "${payment.itemLabel}" exceeds required amount`,
          400,
        );
      }

      item.paidAmount += payment.amountPaid;
    }

    recalculateFinance(finance);
    finance.markModified("items");
    await finance.save({ session: mongoSession });

    const idCardItem = finance.items.find((i) => i.label === "ID Card");
    if (idCardItem) {
      await IdCard.findOneAndUpdate(
        { student: finance.student },
        { paidStatus: idCardItem.status === "Paid" ? "Paid" : "Unpaid" },
        { session: mongoSession, new: true },
      );
    }

    await mongoSession.commitTransaction();
    mongoSession.endSession();

    await logAction({
      performedBy,
      action: "UPDATE",
      targetType: "FINANCE",
      targetId: financeId,
      affectedStudent: finance.student,
      description: `Payment recorded on finance record — ${payments.length} item(s) paid`,
      changes: {
        before,
        after: {
          totalPaid: finance.totalPaid,
          outstandingBalance: finance.outstandingBalance,
        },
      },
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

const viewStudentFinance = async ({ session, semester, studentId }) => {
  const query = { student: studentId };
  if (session) query.session = session;
  if (semester) query.semester = semester;

  if (session && semester) {
    const record = await Finance.findOne(query);
    return { data: record || null };
  }

  const records = await Finance.find(query).sort({ createdAt: -1 });
  return { data: records };
};

module.exports = {
  createFinanceService,
  payFinanceAndSyncIdCardService,
  viewStudentFinance,
};
