const logAction = require("../utils/logAction");
const Finance = require("../models/finance.model");
const IdCard = require("../models/idCard.model");
const recalculateFinance = require("../utils/financeRecalculator");
const mongoose = require("mongoose");

const createFinanceService = async ({ session, semester, items, userId }) => {
  const existing = await Finance.findOne({
    student: userId,
    session,
    semester,
  });

  if (existing) {
    throw new Error("Finance Record already exists");
  }

  const finance = new Finance({
    student: userId,
    session,
    semester,
    items,
  });

  //calculate BEFORE saving
  recalculateFinance(finance);

  await finance.save();

  //await logAction({})

  return { data: finance };
};

const payFinanceAndSyncIdCardService = async ({
  financeId,
  itemLabel,
  amount,
}) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const finance = await Finance.findById(financeId).session(session);

    if (!finance) {
      throw new Error("Finance not found");
    }

    const item = finance.items.find((i) => i.label === itemLabel);

    if (!item) {
      throw new Error("Item not found");
    }

    if (item.paidAmount + amount > item.amount) {
      throw new Error("Payment exceeds required amount");
    }

    item.paidAmount += amount;

    recalculateFinance(finance);

    await finance.save({ session });

    await IdCard.findOneAndUpdate(
      { user: finance.student },
      { paidStatus: finance.paymentStatus === "Paid" ? "Paid" : "Unpaid" },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return { finance };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

module.exports = { createFinanceService, payFinanceAndSyncIdCardService };
