// modules/fileProcessing/service.js

const csvProcessor = require('./services/csvProcessor');
const excelProcessor = require('./services/excelProcessor');

/**
 * Process a CSV file buffer and extract schema information and sample data
 * @param {Buffer} fileBuffer - The CSV file as a buffer
 * @returns {Promise<Object>} - Object containing columns, rowCount, and sample data
 */
async function processCSV(fileBuffer) {
  return csvProcessor.processCSV(fileBuffer);
}

/**
 * Process an Excel file buffer and extract schema information and sample data
 * @param {Buffer} fileBuffer - The Excel file as a buffer
 * @returns {Promise<Object>} - Object containing columns, rowCount, and sample data
 */
async function processExcel(fileBuffer) {
  return excelProcessor.processExcel(fileBuffer);
}

/**
 * Convert Excel file to CSV format for BigQuery
 * @param {Buffer} fileBuffer - The Excel file as a buffer
 * @returns {Promise<string>} - CSV content as a string
 */
async function excelToCSV(fileBuffer) {
  return excelProcessor.excelToCSV(fileBuffer);
}

module.exports = {
  processCSV,
  processExcel,
  excelToCSV
};