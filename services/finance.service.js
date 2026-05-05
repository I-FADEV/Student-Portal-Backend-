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

  // Check if student has outstanding balance from any previous sessions
  const previousRecords = await Finance.find({
    student: studentId,
    session: { $ne: session }, // any session that isn't the current one
    outstandingBalance: { $gt: 0 }, // only if they actually owe something
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

  //calculate BEFORE saving
  recalculateFinance(finance);

  await finance.save();

  //await logAction({})

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

    // loop through each payment
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

    // find the ID Card item specifically
    const idCardItem = finance.items.find((i) => i.label === "ID Card");

    // only update if the ID Card item exists in this finance record

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
    mongoSession.endSession(); // always runs no matter what
  }
};

const viewStudentFinance = async ({ session, semester, studentId }) => {
  const existing = await Finance.findOne({
    session,
    semester,
    student: studentId,
  });

  if (!existing) {
    throw new AppError(
      "Finance not found for this student, semester and session",
      404,
    );
  }

  return { data: existing };
};

module.exports = {
  createFinanceService,
  payFinanceAndSyncIdCardService,
  viewStudentFinance,
};
