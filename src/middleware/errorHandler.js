function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  console.error(err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Server error';
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
