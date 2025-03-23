// modules/bigquery/index.js
const bigQueryService = require('./service');
const connectivity = require('./connectivity');

module.exports = {
  // Main service functions
  createBigQueryTable: bigQueryService.createBigQueryTable,
  deleteBigQueryTable: bigQueryService.deleteBigQueryTable,
  createBigQueryView: bigQueryService.createBigQueryView,
  runBigQueryQuery: bigQueryService.runBigQueryQuery,
  updateTableSchema: bigQueryService.updateTableSchema, // Added new function export

  // Connectivity functions
  verifyConnectivity: connectivity.verifyBigQueryConnectivity,
  checkConfig: connectivity.checkBigQueryConfig,

  // Module metadata
  metadata: {
    name: 'bigquery',
    description: 'Handles BigQuery integration for data processing and querying'
  }
};