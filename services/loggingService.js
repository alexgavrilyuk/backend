// services/loggingService.js

const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Create log directory if it doesn't exist
const logDir = process.env.LOG_DIR || 'logs';
require('fs').mkdirSync(logDir, { recursive: true });

// Define the logger configuration
const logger = winston.createLogger({
  levels: logLevels,
  // Set the logging level based on environment
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'dataset-service' },
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      ),
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    }),
    // Write all logs to file
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    // Write error logs to separate file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
  ],
});

/**
 * Log HTTP requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Additional options
 */
function logHttpRequest(req, res, options = {}) {
  const { userId, datasetId, duration } = options;

  logger.http({
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId,
    datasetId,
    duration,
    userAgent: req.headers['user-agent'],
    status: res.statusCode,
  });
}

/**
 * Log a dataset operation
 * @param {string} operation - Operation name (create, update, delete, etc.)
 * @param {string} userId - User ID
 * @param {string} datasetId - Dataset ID
 * @param {Object} details - Additional details
 */
function logDatasetOperation(operation, userId, datasetId, details = {}) {
  logger.info(`Dataset ${operation}`, {
    operation,
    userId,
    datasetId,
    ...details,
  });
}

/**
 * Log an error
 * @param {Error} error - Error object
 * @param {Object} context - Error context
 */
function logError(error, context = {}) {
  logger.error(`${error.message}`, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

module.exports = {
  logger,
  logHttpRequest,
  logDatasetOperation,
  logError,
};