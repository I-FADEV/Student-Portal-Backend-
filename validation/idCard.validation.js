const joi = require("joi");

// ─── Patterns (kept from original) ───────────────────────────────────────────
const matricPattern = /^I-FAT\/\d{2}\/[A-Z]{3,5}\/\d{4}(TF)?$/i;
const sessionPattern = /^\d{4}\/\d{4}$/;
const phonePattern = /^(\+234[789]\d{9}|0[789]\d{9}|\+229\d{10}|0\d{9})$/;

// ─── Schema (field names match what IDCard.jsx sends via FormData) ─────────────
const createIdCardSchema = joi.object({
  fullName: joi.string().required().uppercase().messages({
    "any.required": "Full name is required",
    "string.empty": "Full name cannot be empty",
  }),

  nationality: joi.string().required().uppercase().messages({
    "any.required": "Nationality is required",
    "string.empty": "Nationality cannot be empty",
  }),

  dateOfBirth: joi
    .string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .messages({
      "string.pattern.base": "Date of birth must follow the format: YYYY-MM-DD",
      "any.required": "Date of birth is required",
    }),

  department: joi.string().required().uppercase().messages({
    "any.required": "Department is required",
    "string.empty": "Department cannot be empty",
  }),

  session: joi.string().pattern(sessionPattern).required().messages({
    "string.pattern.base": "Session must follow the format: 2025/2026",
    "any.required": "Session is required",
  }),

  gender: joi.string().valid("Male", "Female").required().messages({
    "any.only": "Gender must be Male or Female",
    "any.required": "Gender is required",
  }),

  // Comes as string from FormData — Joi coerces "200" → 200 automatically
  level: joi.number().valid(100, 200, 300, 400, 500).required().messages({
    "any.only": "Level must be 100, 200, 300, 400 or 500",
    "any.required": "Level is required",
  }),

  matricNumber: joi.string().pattern(matricPattern).required().messages({
    "string.pattern.base":
      "Matric number must follow the format: I-FAT/26/CSC/0187 (or I-FAT/26/CSC/0187TF for transfer students)",
    "any.required": "Matric number is required",
  }),

  phone: joi.string().pattern(phonePattern).required().messages({
    "string.pattern.base":
      "Phone must be a valid Nigerian or Beninese number e.g. 08012345678, +2348012345678, +2290112345678",
    "any.required": "Phone number is required",
  }),
});

module.exports = { createIdCardSchema };
