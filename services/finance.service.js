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

  return { data: finance };
};

const payFinanceAndSyncIdCardService = async ({ financeId, payments }) => {
  const mongoSession = await mongoose.startSession();

  try {
    mongoSession.startTransaction();

    const finance = await Finance.findById(financeId).session(mongoSession);

    if (!finance) {
      throw new AppError("Finance not found", 404);
    }

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

    return { finance };
  } catch (err) {
    await mongoSession.abortTransaction();
    throw err;
  } finally {
    mongoSession.endSession();
  }
};

const viewStudentFinance = async ({ session, semester, studentId }) => {
  // Build query — if no session/semester provided, fetch all records for this student
  const query = { student: studentId };
  if (session)  query.session  = session;
  if (semester) query.semester = semester;

  // If filtering by session+semester, return single record; otherwise return all
  if (session && semester) {
    const record = await Finance.findOne(query);
    // Return null instead of throwing — frontend handles empty state gracefully
    return { data: record || null };
  }

  // No filters — return all finance records for the student
  const records = await Finance.find(query).sort({ createdAt: -1 });
  return { data: records };
};

module.exports = {
  createFinanceService,
  payFinanceAndSyncIdCardService,
  viewStudentFinance,
};