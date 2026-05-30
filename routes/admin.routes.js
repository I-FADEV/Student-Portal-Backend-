const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const roleCheck = require("../middleware/roleCheck.middleware");
const {
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
} = require("../controllers/admin.controller");

router.delete(
  "/delete",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  deleteAdmin,
);

router.get(
  "/logs",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  checkLogs,
);

router.get(
  "/all",
  protect,
  roleCheck(["admin"], ["general_admin"]),
  getAllAdmins,
);

router.post(
  "/:facultyId/departments",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  createDepartment,
);
router.get(
  "/:facultyId/departments",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  getAllDepartments,
); // includes stats
router.patch(
  "/:facultyId/departments/:departmentId",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  updateDepartment,
);
router.delete(
  "/:facultyId/departments/:departmentId",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  deleteDepartment,
);

router.post(
  "/faculty",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  createFacultyEntry,
);
router.get(
  "/faculty",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  getAllFaculty,
);
router.patch(
  "/faculty/:id",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  updateFacultyEntry,
);
router.delete(
  "/faculty/:id",
  protect,
  roleCheck(["admin"], ["registry_admin"]),
  deleteFacultyEntry,
);
module.exports = router;
