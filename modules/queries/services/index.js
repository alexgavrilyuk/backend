// modules/queries/services/index.js

/**
 * Export all NLP services for easy access
 */

const nlpService = require('./nlpService');
const schemaProcessor = require('./schemaProcessor');
const sqlGenerator = require('./sqlGenerator');
const sqlValidator = require('./sqlValidator');
const analyticsExtractor = require('./analyticsExtractor');

module.exports = {
  // Main NLP service
  nlpService,

  // Individual services
  schemaProcessor,
  sqlGenerator,
  sqlValidator,
  analyticsExtractor
};