const joi = require("joi");

const matricPattern = /^I-FAT\/\d{2}\/[A-Z]{3,5}\/\d{4}$/i;
const sessionPattern = /^\d{4}\/\d{4}$/;

const createIdCardSchema = joi.object({
  nameOnCard: joi
    .string()
    .uppercase()
    .required()
    .messages({ "any.required": "Name is required" }),
  matricOnCard: joi
    .string()
    .uppercase()
    .pattern(matricPattern)
    .required()
    .messages({
      "string.pattern.base":
        "Matric number must follow the format: I-FAT/26/CSC/0187",
      "any.required": "Name is required",
    }),
  departmentOnCard: joi
    .string()
    .uppercase()
    .required()
    .messages({ "any.required": "Department is required" }),
  levelOnCard: joi
    .number()
    .required()
    .messages({ "any.required": "level is required" }),
  sessionOnCard: joi.string().pattern(sessionPattern).required().messages({
    "string.pattern.base": "Session must follow the format: 2025/2026",
    "any.required": "Session is required",
  }),
});

module.exports = { createIdCardSchema };
