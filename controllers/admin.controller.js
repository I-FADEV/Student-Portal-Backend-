const {
  deleteAdminService,
  checkLogsService,
  getAllAdminsService,
  createFacultyEntryService,
  getAllFacultyService,
  updateFacultyEntryService,
  deleteFacultyEntryService,
  createDepartmentService,
  getAllDepartmentsService,
  updateDepartmentService,
  deleteDepartmentService,
} = require("../services/admin.service");

// ─── ADMIN CONTROLLERS ────────────────────────────────────────────

const deleteAdmin = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { message } = await deleteAdminService({
      adminId: req.params.id,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

const getAllAdmins = async (req, res, next) => {
  try {
    const { data } = await getAllAdminsService();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const checkLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;   // use query params, not route params
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { data } = await checkLogsService({ page, limit, skip });
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

// ─── FACULTY CONTROLLERS ──────────────────────────────────────────

const createFacultyEntry = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;
    const { name } = req.body;

    const { data } = await createFacultyEntryService({
      name,
      performedBy,  // fixed: now actually passing these through
      ipAddress,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const getAllFaculty = async (req, res, next) => {
  try {
    const { name } = req.query;

    const { data } = await getAllFacultyService({ name });
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const updateFacultyEntry = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { data } = await updateFacultyEntryService({
      entryId: req.params.id,
      ...req.body,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteFacultyEntry = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { message } = await deleteFacultyEntryService({
      entryId: req.params.id,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

// ─── DEPARTMENT CONTROLLERS ───────────────────────────────────────

const createDepartment = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;
    const { name, minLevel, maxLevel } = req.body;

    const { data } = await createDepartmentService({
      facultyId: req.params.facultyId,
      name,
      minLevel,
      maxLevel,
      performedBy,
      ipAddress,
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

// Returns all departments + stats (count, min/max level) for a faculty
const getAllDepartments = async (req, res, next) => {
  try {
    const { data } = await getAllDepartmentsService({
      facultyId: req.params.facultyId,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { data } = await updateDepartmentService({
      facultyId: req.params.facultyId,
      departmentId: req.params.departmentId,
      ...req.body,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const performedBy = req.user.userId;
    const ipAddress = req.ip;

    const { message } = await deleteDepartmentService({
      facultyId: req.params.facultyId,
      departmentId: req.params.departmentId,
      performedBy,
      ipAddress,
    });

    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  deleteAdmin,
  checkLogs,
  getAllAdmins,
  createFacultyEntry,
  getAllFaculty,
  updateFacultyEntry,
  deleteFacultyEntry,
  createDepartment,
  getAllDepartments,
  updateDepartment,
  deleteDepartment,
};
