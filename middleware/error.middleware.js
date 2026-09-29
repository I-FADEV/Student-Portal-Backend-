module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.status || err.statusCode || 500;
  if (['ValidationError', 'CastError', 'MulterError'].includes(err.name)) status = 400;
  if (err.code === 11000 || err.name === 'VersionError') status = 409;
  if (status >= 500) console.error(err);
  const message = err.code === 11000 ? 'This record already exists. Refresh and try again.' : err.message;
  res.status(status).json({ error: status >= 500 && process.env.NODE_ENV !== 'development' ? 'Something went wrong. Please try again.' : message });
};
