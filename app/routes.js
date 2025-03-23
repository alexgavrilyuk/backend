// app/routes.js

/**
 * Main route registry for the application
 * This file imports and registers all routes from the various modules
 */

// Import middleware
const { errorHandler, requestLogger: requestLoggerMiddleware, apiLimiter } = require('../core/middleware');

// Import module routes
const { routes: datasetRoutes } = require('../modules/datasets');
const { routes: uploadRoutes } = require('../modules/uploads');
const { routes: queryRoutes } = require('../modules/queries');
const { routes: reportRoutes } = require('../modules/reports'); // Import the new reports routes
const { middleware: authMiddleware } = require('../modules/auth');

/**
 * Register all routes with the Express application
 * @param {Object} app - Express application instance
 */
function registerRoutes(app) {
  // Apply global middleware
  app.use(requestLoggerMiddleware);
  app.use('/api', apiLimiter);

  // Register routes from modules
  app.use('/api/datasets', datasetRoutes);
  app.use('/api/chunked-upload', uploadRoutes);
  app.use('/api/query', queryRoutes);
  app.use('/api/reports', reportRoutes); // Register the reports routes

  // Debug routes for Firebase authentication
  app.get('/api/auth-test', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'This is a public endpoint - no authentication required'
    });
  });

  // Debug route to help troubleshoot authentication
  app.get('/api/auth-debug', (req, res) => {
    // Log the headers for debugging
    console.log('Auth Debug - Request Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Auth Debug - Cookies:', req.cookies);

    res.status(200).json({
      success: true,
      message: 'Authentication debug information logged to server console',
      headers: req.headers,
      cookies: req.cookies
    });
  });

  // Apply global error handler - must be last
  app.use(errorHandler);

  // Return the configured app
  return app;
}

module.exports = { registerRoutes };