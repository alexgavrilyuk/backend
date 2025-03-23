// core/middleware/index.js

const errorHandlerModule = require('./errorHandler');
const requestLoggerMiddleware = require('./requestLogger');
const rateLimitModule = require('./rateLimit');
const securityModule = require('./security');

module.exports = {
  // Error handler exports
  errorHandler: errorHandlerModule.errorHandler,

  // Individual error handler functions and classes
  ValidationError: errorHandlerModule.ValidationError,
  AuthenticationError: errorHandlerModule.AuthenticationError,
  ForbiddenError: errorHandlerModule.ForbiddenError,
  NotFoundError: errorHandlerModule.NotFoundError,
  asyncHandler: errorHandlerModule.asyncHandler,

  // Request logger
  requestLogger: requestLoggerMiddleware,

  // Rate limiting
  apiLimiter: rateLimitModule.apiLimiter,
  uploadLimiter: rateLimitModule.uploadLimiter,

  // Security
  setupSecurity: securityModule.setupSecurity,
  validateFileType: securityModule.validateFileType
};