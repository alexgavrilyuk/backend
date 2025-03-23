// app/index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const { registerRoutes } = require('./routes');
const { testConnection } = require('../core/config').database;
const { middleware: authMiddleware } = require('../modules/auth'); // Updated import for auth module
const runMigrations = require('../migrations/runMigrations');
const { verifyConnectivity, checkConfig } = require('../modules/bigquery');

/**
 * Create and configure the Express application
 * @returns {Object} Configured Express application
 */
function createApp() {
  const app = express();
  const port = process.env.PORT || 5001;

  // Trust proxy - needed for proper rate limiting when behind a proxy/load balancer
  app.set('trust proxy', 1);

  // Initialize Firebase Admin SDK
  try {
    authMiddleware.initializeFirebaseAdmin();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    console.warn('Authentication features may not work correctly');
  }

  // Enable CORS with credentials
  app.use(cors({
    origin: true, // Allow all origins (or specify your frontend URL)
    credentials: true // Allow cookies to be sent
  }));

  // Parse cookies
  app.use(cookieParser());

  // Parse JSON bodies
  app.use(express.json({ limit: '50mb' }));

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Install express-fileupload middleware
  app.use(fileUpload({
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max file size
    abortOnLimit: true,
    useTempFiles: false, // Store files in memory
    debug: process.env.NODE_ENV === 'development'
  }));

  // Register routes
  registerRoutes(app);

  // Define start method
  app.start = async () => {
    try {
      // Test database connection
      await testConnection();
      console.log('Database connection successful');

      // Run migrations
      await runMigrations();
      console.log('Migrations completed successfully');

      // Check BigQuery config
      const bqConfig = checkConfig();
      if (!bqConfig.isComplete) {
        console.warn('Warning: BigQuery configuration is incomplete:', bqConfig.message);
        console.warn('Some features may not work correctly without complete BigQuery configuration.');
      } else {
        // Only verify connectivity if configuration is complete
        try {
          await verifyConnectivity();
          console.log('BigQuery connectivity verified successfully');
        } catch (err) {
          console.warn('Warning: BigQuery connectivity check failed:', err.message);
          console.warn('Dataset querying features may not work correctly.');
        }
      }

      // Start the server
      app.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });
    } catch (err) {
      console.error('Application startup error:', err);
      process.exit(1);
    }
  };

  return app;
}

module.exports = { createApp };