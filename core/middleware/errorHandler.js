// core/middleware/errorHandler.js

/**
 * Global error handler middleware
 */

// Define custom error types
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

// New error types for report generation
class ReportGenerationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ReportGenerationError';
    this.statusCode = 500;
    this.details = details;
  }
}

class QueryExecutionError extends Error {
  constructor(message, query = '', details = {}) {
    super(message);
    this.name = 'QueryExecutionError';
    this.statusCode = 500;
    this.details = { query, ...details };
  }
}

class VisualizationError extends Error {
  constructor(message, data = {}, details = {}) {
    super(message);
    this.name = 'VisualizationError';
    this.statusCode = 500;
    this.details = { dataFormat: data, ...details };
  }
}

/**
 * Async function wrapper to catch errors and pass them to the error handler
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Central error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error with appropriate severity based on status code
  const isServerError = !err.statusCode || err.statusCode >= 500;

  // Enhanced error logging for reports
  if (err.name === 'ReportGenerationError' ||
      err.name === 'QueryExecutionError' ||
      err.name === 'VisualizationError') {
    console.error(`Report Error [${err.name}]: ${err.message}`, {
      errorDetails: err.details,
      userId: req.user?.id,
      route: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  } else if (isServerError) {
    console.error('API Error:', err);
  } else {
    console.warn('Client Error:', err.message);
  }

  // Get status code from error or default to 500
  const statusCode = err.statusCode || 500;

  // Prepare error response
  const errorResponse = {
    success: false,
    error: err.message || 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  // Add additional details if available
  if (err.details) {
    errorResponse.details = err.details;
  }

  // For report generation errors, provide more user-friendly guidance
  if (err.name === 'ReportGenerationError') {
    errorResponse.userGuidance = 'There was a problem generating your report. Please try again or simplify your query.';
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

module.exports = {
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ReportGenerationError,
  QueryExecutionError,
  VisualizationError,
  asyncHandler,
  errorHandler
};