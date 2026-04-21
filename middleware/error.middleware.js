const errorHandler = (err, req, res, next) => {
  console.error(err); // basic logging

  const statusCode = err.status || 500;
  const isDev = process.env.NODE_ENV === "development";

  return res.status(statusCode).json({
    // In production, 500 errors show a generic message
    // Your own thrown errors (400, 401, 404) still show their message
    error:
      statusCode === 500 && !isDev
        ? "Something went wrong. Please try again."
        : err.message || "Internal Server Error",

    // Stack trace only in development
    stack: isDev ? err.stack : undefined,
  });
};

module.exports = errorHandler;
