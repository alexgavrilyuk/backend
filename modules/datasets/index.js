// modules/datasets/index.js
const datasetController = require('./controller');
const datasetRoutes = require('./routes');

/**
 * Datasets module
 * Responsible for all dataset-related functionality including:
 * - Dataset creation, retrieval, update, and deletion
 * - Dataset schema management
 * - Dataset metadata operations
 */
module.exports = {
  // Export the controller methods for direct use by other modules if needed
  controller: datasetController,

  // Export the routes for registration in the main app
  routes: datasetRoutes,

  // Module metadata - useful for documentation and discovery
  metadata: {
    name: 'datasets',
    description: 'Handles all dataset operations including upload, retrieval, and schema management'
  }
};