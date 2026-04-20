const {
  createFinanceService,
  payFinanceAndSyncIdCardService,
} = require("../services/finance.service");

const createFinance = async (req, res, next) => {
  try {
    const { session, semester, items } = req.body;

    const userId = req.user.userId;

    const { data } = await createFinanceService({
      session,
      semester,
      items,
      userId,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const payFinance = async (req, res, next) => {
  try {
    const { itemLabel, amount } = req.body;

    const { finance } = await payFinanceAndSyncIdCardService({
      itemLabel,
      amount,
      financeId: req.params.id,
    });

    res.status(200).json({ data: finance });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFinance,
  payFinance,
};
