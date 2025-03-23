// app/server.js

/**
 * Application entry point
 * Creates and starts the Express server
 */

const { createApp } = require('./index');

// Create the application
const app = createApp();

// Start the server
app.start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});