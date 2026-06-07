const {
  createFinanceTemplateService,
  getAllFinanceTemplatesService,
  applyTemplateToExistingStudents,
  deleteFinanceTemplateService,
} = require("../services/financeTemplate.service");

// ── CREATE finance template ─────────────────────────────────────────────────────
const createFinanceTemplate = async (req, res, next) => {
  try {
    const { target, department, faculty, level, items } = req.body;

    const { data } = await createFinanceTemplateService({
      target,
      department,
      faculty,
      level,
      items,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── GET all finance templates ────────────────────────────────────────────────────
const getAllFinanceTemplates = async (req, res, next) => {
  try {
    const { data } = await getAllFinanceTemplatesService();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── APPLY template to existing students ───────────────────────────────────────────
const applyTemplateToStudents = async (req, res, next) => {
  try {
    const { templateId, session, semester } = req.body;

    const { data } = await applyTemplateToExistingStudents({
      templateId,
      session,
      semester,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ── DELETE finance template ───────────────────────────────────────────────────────
const deleteFinanceTemplate = async (req, res, next) => {
  try {
    const { data } = await deleteFinanceTemplateService({
      templateId: req.params.id,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFinanceTemplate,
  getAllFinanceTemplates,
  applyTemplateToStudents,
  deleteFinanceTemplate,
};
