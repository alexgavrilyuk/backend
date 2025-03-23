// modules/fileProcessing/index.js

const service = require('./service');
const fileProcessingUtils = require('./utils/fileProcessing');

/**
 * File Processing module
 * Responsible for all file processing functionality including:
 * - CSV parsing and processing
 * - Excel file processing
 * - File type detection
 * - Schema extraction
 */
module.exports = {
  // Export core file processing services
  processCSV: service.processCSV,
  processExcel: service.processExcel,
  excelToCSV: service.excelToCSV,

  // Export file processing utilities
  utils: {
    detectColumnType: fileProcessingUtils.detectColumnType,
    validateFile: fileProcessingUtils.validateFile
  },

  // Module metadata - useful for documentation and discovery
  metadata: {
    name: 'fileProcessing',
    description: 'Handles file processing for CSV and Excel files'
  }
};