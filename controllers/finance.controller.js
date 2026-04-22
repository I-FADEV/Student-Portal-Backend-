const {
  createFinanceService,
  payFinanceAndSyncIdCardService,
  viewStudentFinance,
} = require("../services/finance.service");

const createFinance = async (req, res, next) => {
  try {
    const { session, semester, items, studentId } = req.body;

    // const userId = req.user.userId;

    const { data } = await createFinanceService({
      session,
      semester,
      items,
      studentId,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const payFinance = async (req, res, next) => {
  try {
    const { payments } = req.body;

    const { finance } = await payFinanceAndSyncIdCardService({
      payments,
      financeId: req.params.id,
    });

    res.status(200).json({ data: finance });
  } catch (error) {
    next(error);
  }
};

const viewFinance = async (req, res, next) => {
  try {
    const { session, semester } = req.query;

    const { data } = await viewStudentFinance({
      session,
      semester,
      studentId: req.user.userId,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFinance,
  payFinance,
  viewFinance,
};
