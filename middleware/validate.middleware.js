const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  // abortEarly: false → returns ALL errors at once, not just the first one

  if (error) {
    return res.status(400).json({
      errors: error.details.map((e) => e.message),
    });
  }

  next();
};

module.exports = validate;
