const Faculty = require("../models/faculty.model");
const Department = require("../models/department.model");
const Student = require("../models/student.model");
const logAction = require("../utils/logAction");
const AppError = require("../utils/appError");

// ── STATS ─────────────────────────────────────────────────────────────────────
const getRegistryStatsService = async () => {
  const [totalFaculties, totalDepartments] = await Promise.all([
    Faculty.countDocuments(),
    Department.countDocuments(),
  ]);

  return {
    totalFaculties,
    totalDepartments,
    matricToday: 0,   // placeholder — matric generator logic TBD
    matricTotal: 0,
  };
};

// ── FACULTIES ─────────────────────────────────────────────────────────────────
const getFacultiesService = async () => {
  const faculties = await Faculty.find().sort({ name: 1 });

  // Count departments per faculty in one aggregation
  const deptCounts = await Department.aggregate([
    { $group: { _id: "$faculty", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  deptCounts.forEach((d) => {
    countMap[d._id.toString()] = d.count;
  });

  const result = faculties.map((f) => ({
    _id: f._id,
    name: f.name,
    departmentCount: countMap[f._id.toString()] || 0,
    createdAt: f.createdAt,
  }));

  return { data: result };
};

const createFacultyService = async ({ name, performedBy, ipAddress }) => {
  // Case-insensitive duplicate check
  const existing = await Faculty.findOne({
    name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
  });
  if (existing) throw new AppError("A faculty with this name already exists", 409);

  const faculty = await Faculty.create({ name: name.trim() });

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "FACULTY",
    targetId: faculty._id,
    description: `Faculty created: ${faculty.name}`,
    changes: { before: null, after: { name: faculty.name } },
    ipAddress,
  });

  return { data: { _id: faculty._id, name: faculty.name, departmentCount: 0, createdAt: faculty.createdAt } };
};

const deleteFacultyService = async ({ facultyId, performedBy, ipAddress }) => {
  const faculty = await Faculty.findById(facultyId);
  if (!faculty) throw new AppError("Faculty not found", 404);

  // Block if departments still belong to this faculty
  const deptCount = await Department.countDocuments({ faculty: facultyId });
  if (deptCount > 0) {
    throw new AppError(
      `Cannot delete: ${deptCount} department(s) are still registered under this faculty. Remove them first.`,
      400
    );
  }

  // Block if students are registered under this faculty (faculty field on Student)
  const studentCount = await Student.countDocuments({ faculty: faculty.name });
  if (studentCount > 0) {
    throw new AppError(
      `Cannot delete: ${studentCount} student(s) are registered under this faculty.`,
      400
    );
  }

  await Faculty.findByIdAndDelete(facultyId);

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "FACULTY",
    targetId: faculty._id,
    description: `Faculty deleted: ${faculty.name}`,
    changes: { before: { name: faculty.name }, after: null },
    ipAddress,
  });

  return { message: "Faculty deleted successfully" };
};

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
const getDepartmentsService = async () => {
  const departments = await Department.find()
    .populate("faculty", "name")
    .sort({ name: 1 });

  // Count students per department in one aggregation
  const studentCounts = await Student.aggregate([
    { $group: { _id: "$department", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  studentCounts.forEach((s) => {
    countMap[s._id] = s.count;
  });

  const result = departments.map((d) => ({
    _id: d._id,
    name: d.name,
    faculty: d.faculty,
    minLevel: d.minLevel,
    maxLevel: d.maxLevel,
    abbreviation: d.abbreviation,
    studentCount: countMap[d.name] || 0,
    createdAt: d.createdAt,
  }));

  return { data: result };
};

const createDepartmentService = async ({
  name,
  facultyId,
  minLevel,
  maxLevel,
  abbreviation,
  performedBy,
  ipAddress,
}) => {
  const faculty = await Faculty.findById(facultyId);
  if (!faculty) throw new AppError("Faculty not found", 404);

  if (Number(minLevel) >= Number(maxLevel)) {
    throw new AppError("Min level must be less than max level", 400);
  }

  if (!abbreviation) {
    throw new AppError("Department abbreviation is required for matric number generation", 400);
  }

  // Check if abbreviation already exists
  const existingAbbreviation = await Department.findOne({
    abbreviation: abbreviation.trim().toUpperCase(),
  });
  if (existingAbbreviation) {
    throw new AppError("A department with this abbreviation already exists", 409);
  }

  // Case-insensitive duplicate check within same faculty
  const existing = await Department.findOne({
    name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    faculty: facultyId,
  });
  if (existing) {
    throw new AppError("A department with this name already exists in this faculty", 409);
  }

  const department = await Department.create({
    name: name.trim(),
    faculty: facultyId,
    minLevel: Number(minLevel),
    maxLevel: Number(maxLevel),
    abbreviation: abbreviation.trim().toUpperCase(),
  });

  const populated = await Department.findById(department._id).populate("faculty", "name");

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "DEPARTMENT",
    targetId: department._id,
    description: `Department created: ${name} (${abbreviation}) under ${faculty.name}`,
    changes: {
      before: null,
      after: { name, abbreviation: abbreviation.trim().toUpperCase(), faculty: faculty.name, minLevel, maxLevel },
    },
    ipAddress,
  });

  return {
    data: {
      _id: populated._id,
      name: populated.name,
      faculty: populated.faculty,
      minLevel: populated.minLevel,
      maxLevel: populated.maxLevel,
      abbreviation: populated.abbreviation,
      studentCount: 0,
      createdAt: populated.createdAt,
    },
  };
};

const updateDepartmentService = async ({
  deptId,
  name,
  facultyId,
  minLevel,
  maxLevel,
  abbreviation,
  performedBy,
  ipAddress,
}) => {
  const department = await Department.findById(deptId).populate("faculty", "name");
  if (!department) throw new AppError("Department not found", 404);

  const oldData = {
    name: department.name,
    faculty: department.faculty?.name,
    minLevel: department.minLevel,
    maxLevel: department.maxLevel,
    abbreviation: department.abbreviation,
  };

  if (facultyId) {
    const faculty = await Faculty.findById(facultyId);
    if (!faculty) throw new AppError("Faculty not found", 404);
    department.faculty = facultyId;
  }

  if (name) department.name = name.trim();
  if (minLevel !== undefined) department.minLevel = Number(minLevel);
  if (maxLevel !== undefined) department.maxLevel = Number(maxLevel);
  if (abbreviation) {
    // Check if abbreviation already exists (excluding current department)
    const existingAbbreviation = await Department.findOne({
      abbreviation: abbreviation.trim().toUpperCase(),
      _id: { $ne: deptId },
    });
    if (existingAbbreviation) {
      throw new AppError("A department with this abbreviation already exists", 409);
    }
    department.abbreviation = abbreviation.trim().toUpperCase();
  }

  if (department.minLevel >= department.maxLevel) {
    throw new AppError("Min level must be less than max level", 400);
  }

  await department.save();
  const updated = await Department.findById(deptId).populate("faculty", "name");

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "DEPARTMENT",
    targetId: department._id,
    description: `Department updated: ${updated.name}`,
    changes: {
      before: oldData,
      after: {
        name: updated.name,
        faculty: updated.faculty?.name,
        minLevel: updated.minLevel,
        maxLevel: updated.maxLevel,
        abbreviation: updated.abbreviation,
      },
    },
    ipAddress,
  });

  return {
    data: {
      _id: updated._id,
      name: updated.name,
      faculty: updated.faculty,
      minLevel: updated.minLevel,
      maxLevel: updated.maxLevel,
      abbreviation: updated.abbreviation,
      createdAt: updated.createdAt,
    },
  };
};

const deleteDepartmentService = async ({ deptId, performedBy, ipAddress }) => {
  const department = await Department.findById(deptId).populate("faculty", "name");
  if (!department) throw new AppError("Department not found", 404);

  // Block if students are registered under this department
  const studentCount = await Student.countDocuments({ department: department.name });
  if (studentCount > 0) {
    throw new AppError(
      `Cannot delete: ${studentCount} student(s) are registered under this department.`,
      400
    );
  }

  await Department.findByIdAndDelete(deptId);

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "DEPARTMENT",
    targetId: department._id,
    description: `Department deleted: ${department.name} (was under ${department.faculty?.name})`,
    changes: {
      before: { name: department.name, faculty: department.faculty?.name },
      after: null,
    },
    ipAddress,
  });

  return { message: "Department deleted successfully" };
};

module.exports = {
  getRegistryStatsService,
  getFacultiesService,
  createFacultyService,
  deleteFacultyService,
  getDepartmentsService,
  createDepartmentService,
  updateDepartmentService,
  deleteDepartmentService,
};