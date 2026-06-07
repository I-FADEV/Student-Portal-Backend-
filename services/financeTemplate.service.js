const FinanceTemplate = require("../models/financeTemplate.model");
const Student = require("../models/student.model");
const Finance = require("../models/finance.model");
const AppError = require("../utils/appError");
const logAction = require("../utils/logAction");
const { getActiveSession } = require("../utils/activeSession");
const financeRecalculator = require("../utils/financeRecalculator");

// ── CREATE finance template ─────────────────────────────────────────────────────
const createFinanceTemplateService = async ({
  target,
  department,
  faculty,
  level,
  items,
  performedBy,
  ipAddress,
}) => {
  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError("Items array is required", 400);
  }
  for (const item of items) {
    if (item.currency && !["NGN", "XAF"].includes(item.currency)) {
      throw new AppError(`Item "${item.label}" must have a valid currency (NGN or XAF)`, 400);
    }
  }

  // Check if template already exists for this target
  const filter = { target, isActive: true };
  if (target === "department") {
    if (!department) throw new AppError("Department is required for department target", 400);
    filter.department = { $regex: department, $options: "i" };
    if (level) filter.level = Number(level);
  } else if (target === "faculty") {
    if (!faculty) throw new AppError("Faculty is required for faculty target", 400);
    filter.faculty = { $regex: faculty, $options: "i" };
    if (level) filter.level = Number(level);
  }

  const existingTemplate = await FinanceTemplate.findOne(filter);
  if (existingTemplate) {
    // Deactivate existing template
    existingTemplate.isActive = false;
    await existingTemplate.save();
  }

  const template = await FinanceTemplate.create({
    target,
    department: target === "department" ? department : undefined,
    faculty: target === "faculty" ? faculty : undefined,
    level: level ? Number(level) : undefined,
    items,
    createdBy: performedBy,
  });

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "FINANCE_TEMPLATE",
    targetId: template._id,
    description: `Finance template created for ${target}${department ? ` - ${department}` : ""}${faculty ? ` - ${faculty}` : ""}${level ? ` - Level ${level}` : ""}`,
    ipAddress,
  });

  return { data: template };
};

// ── GET all finance templates ────────────────────────────────────────────────────
const getAllFinanceTemplatesService = async () => {
  const templates = await FinanceTemplate.find()
    .populate("createdBy", "username adminType")
    .sort({ createdAt: -1 });

  return { data: templates };
};

// ── GET active finance template for a student ─────────────────────────────────────
const getActiveTemplateForStudent = async (student) => {
  const filter = { isActive: true };

  // Try department match first
  let template = await FinanceTemplate.findOne({
    ...filter,
    target: "department",
    department: { $regex: student.department, $options: "i" },
    level: student.level,
  });

  // If no department match, try faculty match
  if (!template && student.faculty) {
    template = await FinanceTemplate.findOne({
      ...filter,
      target: "faculty",
      faculty: { $regex: student.faculty, $options: "i" },
      level: student.level,
    });
  }

  // If no faculty match, try "all" target
  if (!template) {
    template = await FinanceTemplate.findOne({
      ...filter,
      target: "all",
    });
  }

  return template;
};

// ── APPLY template to a student ───────────────────────────────────────────────────
const applyTemplateToStudent = async (student, template, session, semester) => {
  // Check if finance record already exists for this session/semester
  const existingFinance = await Finance.findOne({
    student: student._id,
    session,
    semester,
  });

  if (existingFinance) {
    // Add new items from template that don't already exist
    let itemsAdded = 0;
    for (const templateItem of template.items) {
      const existingItem = existingFinance.items.find(
        (i) => i.label.toLowerCase() === templateItem.label.toLowerCase()
      );
      if (!existingItem) {
        existingFinance.items.push({
          label: templateItem.label,
          amount: templateItem.amount,
          currency: templateItem.currency || "NGN",
          paidAmount: 0,
          status: "Unpaid",
        });
        itemsAdded++;
      }
    }

    if (itemsAdded > 0) {
      financeRecalculator(existingFinance);
      existingFinance.markModified("items");
      await existingFinance.save();
    }

    return { created: false, updated: itemsAdded > 0 };
  } else {
    // Create new finance record
    const previousRecords = await Finance.find({
      student: student._id,
      session: { $ne: session },
      outstandingBalance: { $gt: 0 },
    });
    const carriedOverBalance = previousRecords.reduce((s, r) => s + r.outstandingBalance, 0);

    const currency = template.items[0]?.currency || "NGN";

    const finance = new Finance({
      student: student._id,
      session,
      semester,
      items: template.items.map((item) => ({
        label: item.label,
        amount: item.amount,
        currency: item.currency || "NGN",
        paidAmount: 0,
        status: "Unpaid",
      })),
      carriedOverBalance,
      currency,
    });

    financeRecalculator(finance);
    await finance.save();

    return { created: true, updated: false };
  }
};

// ── APPLY template to existing students ───────────────────────────────────────────
const applyTemplateToExistingStudents = async ({
  templateId,
  session,
  semester,
  performedBy,
  ipAddress,
}) => {
  const template = await FinanceTemplate.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  if (!template.isActive) {
    throw new AppError("Template is not active", 400);
  }

  // Get active session if not provided
  if (!session || !semester) {
    const activeSession = await getActiveSession();
    session = session || activeSession.session;
    semester = semester || activeSession.semester;
  }

  // Find matching students
  const filter = {};
  if (template.target === "department") {
    filter.department = { $regex: template.department, $options: "i" };
    if (template.level) filter.level = template.level;
  } else if (template.target === "faculty") {
    filter.faculty = { $regex: template.faculty, $options: "i" };
    if (template.level) filter.level = template.level;
  }

  const students = await Student.find(filter).select("_id name matricNumber");
  if (!students.length) {
    throw new AppError("No students found for this template", 404);
  }

  let created = 0;
  let updated = 0;

  for (const student of students) {
    const result = await applyTemplateToStudent(student, template, session, semester);
    if (result.created) created++;
    if (result.updated) updated++;
  }

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "FINANCE_TEMPLATE",
    targetId: template._id,
    description: `Finance template applied to ${created + updated} students (${created} created, ${updated} updated)`,
    ipAddress,
  });

  return { data: { created, updated, total: students.length } };
};

// ── DELETE finance template ───────────────────────────────────────────────────────
const deleteFinanceTemplateService = async ({ templateId, performedBy, ipAddress }) => {
  const template = await FinanceTemplate.findById(templateId);
  if (!template) {
    throw new AppError("Template not found", 404);
  }

  await FinanceTemplate.findByIdAndDelete(templateId);

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "FINANCE_TEMPLATE",
    targetId: template._id,
    description: `Finance template deleted for ${template.target}`,
    ipAddress,
  });

  return { message: "Template deleted successfully" };
};

module.exports = {
  createFinanceTemplateService,
  getAllFinanceTemplatesService,
  getActiveTemplateForStudent,
  applyTemplateToStudent,
  applyTemplateToExistingStudents,
  deleteFinanceTemplateService,
};
