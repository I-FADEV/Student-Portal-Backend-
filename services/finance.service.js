const logAction = require("../utils/logAction");
const Finance = require("../models/finance.model");
const IdCard = require("../models/idCard.model");
const recalculateFinance = require("../utils/financeRecalculator");
const mongoose = require("mongoose");

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

const payFinanceAndSyncIdCardService = async ({ financeId, payments }) => {
  const mongoSession = await mongoose.startSession();

  try {
    mongoSession.startTransaction();

    const finance = await Finance.findById(financeId).session(mongoSession);

    if (!finance) {
      throw new Error("Finance not found");
    }

    // loop through each payment
    for (const payment of payments) {
      const item = finance.items.find((i) => i.label === payment.itemLabel);

      if (!item) {
        throw new Error(`Item "${payment.itemLabel}" not found`);
      }

      if (item.paidAmount + payment.amountPaid > item.amount) {
        throw new Error(
          `Payment for "${payment.itemLabel}" exceeds required amount`,
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
      // check what student ID we're searching with
      console.log("Searching for student:", finance.student);

      // check what's actually in the IdCard collection
      const allCards = await IdCard.find({});
      console.log("All IdCards in DB:", JSON.stringify(allCards, null, 2));

      const updatedCard = await IdCard.findOneAndUpdate(
        { student: finance.student },
        { paidStatus: idCardItem.status === "Paid" ? "Paid" : "Unpaid" },
        { session: mongoSession, new: true },
      );
      console.log("updatedCard:", updatedCard);
    }

    await mongoSession.commitTransaction();
    mongoSession.endSession();

    return { finance };
  } catch (err) {
    await mongoSession.abortTransaction();
    mongoSession.endSession();
    throw err;
  }
};

const viewStudentFinance = async ({ session, semester, studentId }) => {
  const existing = await Finance.findOne({
    session,
    semester,
    student: studentId,
  });

  if (!existing) {
    throw new Error("Finance not found for this student, semester and session");
  }

  return { data: existing };
};

module.exports = {
  createFinanceService,
  payFinanceAndSyncIdCardService,
  viewStudentFinance,
};
