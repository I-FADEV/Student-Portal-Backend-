const {
  createFinanceService,
  payFinanceAndSyncIdCardService,
  viewStudentFinance,
  viewAllFinanceService,
  getFinanceStatsService,
  createBulkFinanceService,
  addItemToFinanceService,
} = require("../services/finance.service");

// ── CREATE single finance record ───────────────────────────────────────────────
const createFinance = async (req, res, next) => {
  try {
    const { session, semester, items, studentId } = req.body;

    const { data } = await createFinanceService({
      session,
      semester,
      items,
      studentId,
      performedBy: req.user.userId,
      ipAddress:   req.ip,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── PAY on a finance record ────────────────────────────────────────────────────
const payFinance = async (req, res, next) => {
  try {
    const { payments } = req.body;

    const { finance } = await payFinanceAndSyncIdCardService({
      payments,
      financeId:   req.params.id,
      performedBy: req.user.userId,
      ipAddress:   req.ip,
    });

    res.status(200).json({ data: finance });
  } catch (error) {
    next(error);
  }
};

// ── VIEW finance — student sees own, admin sees all ───────────────────────────
const viewFinance = async (req, res, next) => {
  try {
    const { session, semester, studentId, status } = req.query;

    if (req.user.role === "admin") {
      const { data } = await viewAllFinanceService({ session, semester, studentId, status });
      return res.status(200).json({ data });
    }

    // Student: always their own records
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

// ── FINANCE STATS (bursar dashboard) ─────────────────────────────────────────
const getFinanceStats = async (req, res, next) => {
  try {
    const { data } = await getFinanceStatsService();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── BULK finance creation ──────────────────────────────────────────────────────
const createBulkFinance = async (req, res, next) => {
  try {
    const { session, semester, items, target, department, level, faculty } = req.body;

    const { data } = await createBulkFinanceService({
      session, semester, items,
      target, department, level, faculty,
      performedBy: req.user.userId,
      ipAddress:   req.ip,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── ADD ITEM to existing record ────────────────────────────────────────────────
const addItemToFinance = async (req, res, next) => {
  try {
    const { label, amount, currency } = req.body;

    const { data } = await addItemToFinanceService({
      financeId:   req.params.id,
      label,
      amount,
      currency,
      performedBy: req.user.userId,
      ipAddress:   req.ip,
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
  getFinanceStats,
  createBulkFinance,
  addItemToFinance,
};