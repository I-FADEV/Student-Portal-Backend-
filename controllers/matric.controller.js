const {
  generateMatricNumberService,
  getMatricCounterService,
  getMatricStatsService,
} = require("../services/matric.service");

const generateMatricNumber = async (req, res, next) => {
  try {
    const { departmentId, level, isTransfer, manualCounter } = req.body;

    const result = await generateMatricNumberService({
      departmentId,
      level,
      isTransfer: isTransfer || false,
      manualCounter: manualCounter || null,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });

    res.status(200).json({
      message: "Matric number generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getMatricCounter = async (req, res, next) => {
  try {
    const { level } = req.query;

    const result = await getMatricCounterService({
      level,
    });

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getMatricStats = async (req, res, next) => {
  try {
    const result = await getMatricStatsService();

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateMatricNumber,
  getMatricCounter,
  getMatricStats,
};
