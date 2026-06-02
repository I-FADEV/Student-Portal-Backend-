const {
  getRegistryStatsService,
  getFacultiesService,
  createFacultyService,
  deleteFacultyService,
  getDepartmentsService,
  createDepartmentService,
  updateDepartmentService,
  deleteDepartmentService,
} = require("../services/registry.service");

// ── STATS ─────────────────────────────────────────────────────────────────────
const getRegistryStats = async (req, res, next) => {
  try {
    const data = await getRegistryStatsService();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// ── FACULTIES ─────────────────────────────────────────────────────────────────
const getFaculties = async (req, res, next) => {
  try {
    const { data } = await getFacultiesService();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const createFaculty = async (req, res, next) => {
  try {
    const { name } = req.body;
    const { data } = await createFacultyService({
      name,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteFaculty = async (req, res, next) => {
  try {
    const { message } = await deleteFacultyService({
      facultyId: req.params.id,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
const getDepartments = async (req, res, next) => {
  try {
    const { data } = await getDepartmentsService();
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const { name, facultyId, minLevel, maxLevel } = req.body;
    const { data } = await createDepartmentService({
      name,
      facultyId,
      minLevel,
      maxLevel,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });
    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const { name, facultyId, minLevel, maxLevel } = req.body;
    const { data } = await updateDepartmentService({
      deptId: req.params.id,
      name,
      facultyId,
      minLevel,
      maxLevel,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const { message } = await deleteDepartmentService({
      deptId: req.params.id,
      performedBy: req.user.userId,
      ipAddress: req.ip,
    });
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRegistryStats,
  getFaculties,
  createFaculty,
  deleteFaculty,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};