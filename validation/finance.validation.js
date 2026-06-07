const Joi = require("joi");

const itemSchema = Joi.object({
  label: Joi.string().required().messages({
    "string.empty": "Item label is required",
    "any.required": "Item label is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.positive": "Item amount must be a positive number",
    "any.required": "Item amount is required",
  }),
  currency: Joi.string().valid("NGN", "XAF").optional().messages({
    "any.only": "Currency must be either NGN or XAF",
  }),
  paidAmount: Joi.number().min(0).optional().default(0),
  status: Joi.string().valid("Paid", "Partial", "Unpaid").optional().default("Unpaid"),
});

const createFinanceSchema = Joi.object({
  studentId: Joi.string().required().messages({
    "string.empty": "Student ID is required",
    "any.required": "Student ID is required",
  }),
  session: Joi.string().optional(),
  semester: Joi.string().optional(),
  items: Joi.array().items(itemSchema).min(1).required().messages({
    "array.min": "At least one item is required",
    "any.required": "Items array is required",
  }),
});

const createBulkFinanceSchema = Joi.object({
  target: Joi.string().valid("department", "faculty", "all").required().messages({
    "any.only": "Target must be department, faculty, or all",
    "any.required": "Target is required",
  }),
  department: Joi.string().optional(),
  faculty: Joi.string().optional(),
  level: Joi.number().optional(),
  session: Joi.string().optional(),
  semester: Joi.string().optional(),
  items: Joi.array().items(itemSchema).min(1).required().messages({
    "array.min": "At least one item is required",
    "any.required": "Items array is required",
  }),
});

const addItemSchema = Joi.object({
  label: Joi.string().required().messages({
    "string.empty": "Item label is required",
    "any.required": "Item label is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.positive": "Item amount must be a positive number",
    "any.required": "Item amount is required",
  }),
  currency: Joi.string().valid("NGN", "XAF").optional().messages({
    "any.only": "Currency must be either NGN or XAF",
  }),
});

const paymentSchema = Joi.object({
  payments: Joi.array().items(
    Joi.object({
      itemLabel: Joi.string().required().messages({
        "string.empty": "Item label is required",
        "any.required": "Item label is required",
      }),
      amountPaid: Joi.number().positive().required().messages({
        "number.positive": "Amount paid must be a positive number",
        "any.required": "Amount paid is required",
      }),
    })
  ).min(1).required().messages({
    "array.min": "At least one payment is required",
    "any.required": "Payments array is required",
  }),
});

module.exports = {
  createFinanceSchema,
  createBulkFinanceSchema,
  addItemSchema,
  paymentSchema,
};
