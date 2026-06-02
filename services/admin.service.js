const Admin = require("../models/admin.model");
const logAction = require("../utils/logAction");
const Log = require("../models/auditLog.model");
const Register = require("../models/register.model");

// ─── ADMIN SERVICES ───────────────────────────────────────────────

const deleteAdminService = async ({ adminId, performedBy, ipAddress }) => {
  const admin = await Admin.findByIdAndDelete(adminId);
  if (!admin) throw new Error("Admin not found");

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "ADMIN",
    targetId: adminId,
    description: `Admin ${admin.username} was deleted`,
    ipAddress,
  });

  return { message: "Admin deleted" };
};

const checkLogsService = async ({ page, limit, skip }) => {
  const [logs, totalLogs] = await Promise.all([
    Log.find()
      .sort({ createdAt: -1 }) // 👈 ADD THIS
      .skip(skip)
      .limit(limit),
    Log.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalLogs / limit);

  return {
    data: {
      logs,
      pagination: {
        currentPage: page,
        totalPages,
        totalLogs,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  };
};

const getAllAdminsService = async () => {
  const admins = await Admin.find();
  if (!admins) throw new Error("Admins not found");

  return { data: admins };
};

// ─── FACULTY SERVICES ─────────────────────────────────────────────

// Create a new faculty (with optional initial departments)
const createFacultyEntryService = async ({ name, performedBy, ipAddress }) => {
  const existing = await Register.findOne({ faculty: name });
  if (existing) throw new Error("Faculty already exists");

  const entry = await Register.create({ faculty: name, departments: [] });

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "FACULTY",
    targetId: entry._id,
    description: `Faculty "${name}" was created`,
    ipAddress,
  });

  return { data: entry };
};

// Get all faculties, optional filter by name
const getAllFacultyService = async ({ name }) => {
  const query = {};
  if (name) query.faculty = { $regex: name, $options: "i" }; // case-insensitive search

  const faculties = await Register.find(query);
  return { data: faculties };
};

// Update a faculty's name
const updateFacultyEntryService = async ({
  entryId,
  name,
  performedBy,
  ipAddress,
}) => {
  const entry = await Register.findById(entryId);
  if (!entry) throw new Error("Faculty not found");

  const oldName = entry.faculty;
  entry.faculty = name || entry.faculty;
  await entry.save();

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "FACULTY",
    targetId: entryId,
    description: `Faculty renamed from "${oldName}" to "${entry.faculty}"`,
    ipAddress,
  });

  return { data: entry };
};

// Delete a faculty and all its departments
const deleteFacultyEntryService = async ({
  entryId,
  performedBy,
  ipAddress,
}) => {
  const entry = await Register.findByIdAndDelete(entryId);
  if (!entry) throw new Error("Faculty not found");

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "FACULTY",
    targetId: entryId,
    description: `Faculty "${entry.faculty}" and all its departments were deleted`,
    ipAddress,
  });

  return { message: "Faculty deleted" };
};

// ─── DEPARTMENT SERVICES ──────────────────────────────────────────

// Add a department to a faculty
const createDepartmentService = async ({
  facultyId,
  name,
  minLevel,
  maxLevel,
  performedBy,
  ipAddress,
}) => {
  const faculty = await Register.findById(facultyId);
  if (!faculty) throw new Error("Faculty not found");

  // Check department doesn't already exist in this faculty
  const alreadyExists = faculty.departments.find((d) => d.name === name);
  if (alreadyExists) throw new Error("Department already exists in this faculty");

  faculty.departments.push({ name, minLevel, maxLevel });
  await faculty.save();

  await logAction({
    performedBy,
    action: "CREATE",
    targetType: "DEPARTMENT",
    targetId: faculty._id,
    description: `Department "${name}" added to faculty "${faculty.faculty}"`,
    ipAddress,
  });

  return { data: faculty };
};

// Get all departments for a faculty, with stats (count, min/max level)
const getAllDepartmentsService = async ({ facultyId }) => {
  const faculty = await Register.findById(facultyId);
  if (!faculty) throw new Error("Faculty not found");

  const departments = faculty.departments;

  const stats = {
    count: departments.length,
    // finds the lowest minLevel across all departments in this faculty
    overallMinLevel: departments.length
      ? Math.min(...departments.map((d) => d.minLevel))
      : null,
    // finds the highest maxLevel across all departments in this faculty
    overallMaxLevel: departments.length
      ? Math.max(...departments.map((d) => d.maxLevel))
      : null,
  };

  return { data: { faculty: faculty.faculty, departments, stats } };
};

// Update a department inside a faculty
const updateDepartmentService = async ({
  facultyId,
  departmentId,
  name,
  minLevel,
  maxLevel,
  performedBy,
  ipAddress,
}) => {
  const faculty = await Register.findById(facultyId);
  if (!faculty) throw new Error("Faculty not found");

  const department = faculty.departments.id(departmentId); // mongoose subdocument helper
  if (!department) throw new Error("Department not found");

  const oldName = department.name;

  if (name) department.name = name;
  if (minLevel) department.minLevel = minLevel;
  if (maxLevel) department.maxLevel = maxLevel;

  await faculty.save();

  await logAction({
    performedBy,
    action: "UPDATE",
    targetType: "DEPARTMENT",
    targetId: departmentId,
    description: `Department "${oldName}" updated in faculty "${faculty.faculty}"`,
    ipAddress,
  });

  return { data: faculty };
};

// Delete a department from a faculty
const deleteDepartmentService = async ({
  facultyId,
  departmentId,
  performedBy,
  ipAddress,
}) => {
  const faculty = await Register.findById(facultyId);
  if (!faculty) throw new Error("Faculty not found");

  const department = faculty.departments.id(departmentId);
  if (!department) throw new Error("Department not found");

  const deptName = department.name;
  department.deleteOne(); // mongoose subdocument removal
  await faculty.save();

  await logAction({
    performedBy,
    action: "DELETE",
    targetType: "DEPARTMENT",
    targetId: departmentId,
    description: `Department "${deptName}" removed from faculty "${faculty.faculty}"`,
    ipAddress,
  });

  return { message: "Department deleted" };
};

module.exports = {
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
};
