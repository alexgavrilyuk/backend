// core/middleware/security.js

const helmet = require('helmet');
const xss = require('xss-clean');
const hpp = require('hpp');
const sanitize = require('sanitize');
const rateLimit = require('express-rate-limit');

/**
 * Setup security middleware for Express app
 * @param {Object} app - Express app
 */
function setupSecurity(app) {
  // Set security headers with Helmet
  app.use(helmet());

  // Prevent XSS attacks
  app.use(xss());

  // Prevent HTTP Parameter Pollution attacks
  app.use(hpp());

  // Sanitize data
  app.use(sanitize.middleware);

  // Add global rate limiter
  const globalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per IP
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(globalRateLimit);

  // CORS configuration
  app.use((req, res, next) => {
    // Configure allowed origins based on environment
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000']; // Default to localhost in development

    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });
}

/**
 * File type validation middleware
 * @param {Array} allowedTypes - Array of allowed file types
 * @returns {Function} - Express middleware
 */
function validateFileType(allowedTypes) {
  return (req, res, next) => {
    if (!req.files || !req.files.file) {
      return next();
    }

    const file = req.files.file;
    const fileType = file.mimetype;

    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      });
    }

    next();
  };
}

module.exports = {
  setupSecurity,
  validateFileType,
};