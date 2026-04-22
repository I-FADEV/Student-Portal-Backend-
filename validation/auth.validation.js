const joi = require("joi");

const matricPattern = /^I-FAT\/\d{2}\/[A-Z]{3,5}\/\d{4}$/i;

const adminRegisterSchema = joi.object({
  username: joi.string().min(2).max(50).required().messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 50 characters",
    "any.required": "Name is required",
  }),
  password: joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters",
    "any.required": "Password is required",
  }),
  confirmPassword: joi
    .string()
    .valid(joi.ref("password")) // must match password exactly
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Please confirm your password",
    }),
  adminType: joi
    .string()
    .valid("general_admin", "finance_admin", "idcard_admin", "timetable_admin")
    .required()
    .messages({
      "any.only":
        "adminType must be general_admin, finance_admin, timetable_admin or idcard_admin",
      "any.required": "adminType is required",
    }),
});

const adminLoginSchema = joi.object({
  username: joi.string().min(2).max(50).required().messages({
    "any.required": "Name is required",
  }),
  password: joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

const studentRegisterSchema = joi.object({
  matricNumber: joi.string().pattern(matricPattern).required().messages({
    "string.pattern.base":
      "Matric number must follow the format: I-FAT/26/CSC/0187",
    "any.required": "Matric number is required",
  }),

  password: joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters",
    "any.required": "Password is required",
  }),

  confirmPassword: joi
    .string()
    .valid(joi.ref("password")) // must match password exactly
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Please confirm your password",
    }),

  department: joi.string().required().messages({
    "any.required": "Department is required",
  }),

  level: joi.number().valid(100, 200, 300, 400, 500).required().messages({
    "any.only": "Level must be 100, 200, 300, 400 or 500",
    "any.required": "Level is required",
  }),
});

const studentLoginSchema = joi.object({
  matricNumber: joi.string().pattern(matricPattern).required().messages({
    "string.pattern.base":
      "Matric number must follow the format: I-FAT/26/CSC/0187",
    "any.required": "Matric number is required",
  }),
  password: joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

module.exports = {
  adminRegisterSchema,
  adminLoginSchema,
  studentRegisterSchema,
  studentLoginSchema,
};
