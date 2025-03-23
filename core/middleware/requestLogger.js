// core/middleware/requestLogger.js

/**
 * Middleware to log HTTP requests and responses
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function requestLoggerMiddleware(req, res, next) {
  // Record start time
  const start = Date.now();

  // Add response listener to log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;

    // Extract user ID from request if available
    const userId = req.user ? req.user.id : undefined;

    // Basic logging to console
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - User: ${userId || 'anonymous'}`);
  });

  next();
}

module.exports = requestLoggerMiddleware;