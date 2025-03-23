// modules/uploads/index.js
const uploadController = require('./controller');
const uploadRoutes = require('./routes');

/**
 * Uploads module
 * Responsible for all file upload functionality including:
 * - Chunked file uploads
 * - Upload status tracking
 * - File processing initialization
 */
module.exports = {
  // Export the controller methods for direct use by other modules if needed
  controller: uploadController,

  // Export the routes for registration in the main app
  routes: uploadRoutes,

  // Module metadata - useful for documentation and discovery
  metadata: {
    name: 'uploads',
    description: 'Handles file uploads, chunked uploads for large files, and upload status tracking'
  }
};