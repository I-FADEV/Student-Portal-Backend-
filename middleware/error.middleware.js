const errorHandler = (err, req, res, next) => {
  console.error(err); // basic logging

  const statusCode = err.status || 500;

  return res.status(statusCode).json({
    error: err.message || "Internal Server Error",
  });
};

module.exports = errorHandler;
