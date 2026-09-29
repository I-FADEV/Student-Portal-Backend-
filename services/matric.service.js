const Department = require("../models/department.model");
const MatricCounter = require("../models/matricCounter.model");
const logAction = require("../utils/logAction");

const generateMatricNumberService = async ({
  departmentId,
  level,
  isTransfer = false,
  manualCounter = null,
  performedBy,
  ipAddress,
}) => {
  // 1. Get department details
  const department = await Department.findById(departmentId);
  if (!department) {
    throw new Error("Department not found");
  }

  if (!department.abbreviation) {
    throw new Error("Department abbreviation not set. Please update department with abbreviation.");
  }

  // 2. Calculate graduation year
  const currentYear = new Date().getFullYear();
  const yearsToGraduate = (department.maxLevel - level) / 100;
  const graduationYear = currentYear + yearsToGraduate;
  const gradYearSuffix = String(graduationYear).slice(-2); // Last 2 digits

  const AppError = require('../utils/appError');
  level = Number(level);
  if (!Number.isInteger(level) || level < department.minLevel || level > department.maxLevel || level % 100) throw new AppError('Invalid level for this department', 400);
  if (manualCounter !== null && (!Number.isInteger(Number(manualCounter)) || Number(manualCounter) < 1 || Number(manualCounter) > 9999)) throw new AppError('Counter must be from 1 to 9999', 400);
  // Initialize separately; the unique level index resolves concurrent initialization.
  try { await MatricCounter.updateOne({ level }, { $setOnInsert: { counter: 0 } }, { upsert: true }); } catch(e) { if (e.code !== 11000) throw e; }
  const counter = await MatricCounter.findOneAndUpdate(
    { level, counter: { $lt: manualCounter !== null ? Number(manualCounter) : 9999 } },
    manualCounter !== null ? { $set: { counter: Number(manualCounter) } } : { $inc: { counter: 1 } },
    { new: true, runValidators: true }
  );
  if (!counter) throw new AppError('Counter already used, moved forward, or exhausted. Refresh and try again.', 409);
  const counterValue = counter.counter;

  // 5. Format counter as 4-digit zero-padded
  const counterSuffix = String(counterValue).padStart(4, "0");

  // 6. Build matric number
  const matricNumber = `I-FAT/${gradYearSuffix}/${department.abbreviation}/${counterSuffix}`;

  // 7. Append TF if transfer student
  const finalMatricNumber = isTransfer ? `${matricNumber}TF` : matricNumber;

  await require("../models/matricReservation.model").create({ matricNumber: finalMatricNumber, department: department._id, level, createdBy: performedBy });

  // 8. Log the action
  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "MATRIC",
    targetId: null,
    description: `Matric number generated: ${finalMatricNumber} for ${department.name} level ${level}${isTransfer ? " (Transfer)" : ""}`,
    changes: {
      before: null,
      after: {
        matricNumber: finalMatricNumber,
        department: department.name,
        level,
        isTransfer,
        counter: counterValue,
      },
    },
    ipAddress,
  });

  return {
    matricNumber: finalMatricNumber,
    department: department.name,
    abbreviation: department.abbreviation,
    level,
    graduationYear,
    counter: counterValue,
    isTransfer,
  };
};

const getMatricCounterService = async ({ level }) => {
  const matricCounter = await MatricCounter.findOne({ level });

  if (!matricCounter) {
    return {
      exists: false,
      nextCounter: 1,
      level,
    };
  }

  return {
    exists: true,
    currentCounter: matricCounter.counter,
    nextCounter: matricCounter.counter + 1,
    level: matricCounter.level,
  };
};

const getMatricStatsService = async () => {
  const AuditLog = require("../models/auditLog.model");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayCount, totalCount] = await Promise.all([
    AuditLog.countDocuments({
      targetType: "MATRIC",
      action: "CREATE",
      createdAt: { $gte: today },
    }),
    AuditLog.countDocuments({
      targetType: "MATRIC",
      action: "CREATE",
    }),
  ]);

  return {
    today: todayCount,
    total: totalCount,
  };
};

module.exports = {
  generateMatricNumberService,
  getMatricCounterService,
  getMatricStatsService,
};
