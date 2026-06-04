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

  // 3. Get or create counter for this level (shared across all departments)
  let matricCounter = await MatricCounter.findOne({ level });

  if (!matricCounter) {
    // If manual counter provided, use it; otherwise start from 0
    const initialCounter = manualCounter !== null ? manualCounter : 0;
    matricCounter = await MatricCounter.create({
      level,
      counter: initialCounter,
    });
  }

  // 4. Determine the counter value to use
  let counterValue;
  if (manualCounter !== null) {
    // Admin manually overrode the counter
    counterValue = manualCounter;
    // Update the stored counter to this new value
    matricCounter.counter = manualCounter;
    await matricCounter.save();
  } else {
    // Auto-increment
    counterValue = matricCounter.counter + 1;
    matricCounter.counter = counterValue;
    await matricCounter.save();
  }

  // 5. Format counter as 4-digit zero-padded
  const counterSuffix = String(counterValue).padStart(4, "0");

  // 6. Build matric number
  const matricNumber = `i-FAT/${gradYearSuffix}/${department.abbreviation}/${counterSuffix}`;

  // 7. Append TF if transfer student
  const finalMatricNumber = isTransfer ? `${matricNumber}TF` : matricNumber;

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
