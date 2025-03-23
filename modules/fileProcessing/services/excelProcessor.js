// modules/fileProcessing/services/excelProcessor.js

const XLSX = require('xlsx');
const { detectColumnType } = require('../utils/fileProcessing');

/**
 * Process an Excel file buffer and extract schema information and sample data
 * @param {Buffer} fileBuffer - The Excel file as a buffer
 * @returns {Promise<Object>} - Object containing columns, rowCount, and sample data
 */
async function processExcel(fileBuffer) {
  try {
    // Read Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet name
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON
    const results = XLSX.utils.sheet_to_json(worksheet);

    // Extract columns
    const headers = Object.keys(results[0] || {});
    const columns = new Map();

    headers.forEach(header => {
      columns.set(header, {
        name: header,
        type: null,
        nullable: true,
        primaryKey: false,
        samples: []
      });
    });

    // Sample values for type detection (up to 1000 samples)
    for (let i = 0; i < Math.min(results.length, 1000); i++) {
      const row = results[i];
      for (const [header, value] of Object.entries(row)) {
        if (columns.has(header)) {
          const column = columns.get(header);
          if (column.samples.length < 1000) {
            column.samples.push(value);
          }
        }
      }
    }

    // Detect column types
    for (const [header, column] of columns.entries()) {
      column.type = detectColumnType(column.samples);
      column.nullable = column.samples.some(sample => sample === null || sample === undefined || sample === '');

      // Clean up samples to avoid memory bloat
      delete column.samples;
    }

    return {
      columns: Array.from(columns.values()),
      rowCount: results.length,
      data: results.slice(0, 1000) // Only return first 1000 rows for preview
    };
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw new Error(`Error processing Excel file: ${error.message}`);
  }
}

/**
 * Convert Excel file to CSV format for BigQuery
 * @param {Buffer} fileBuffer - The Excel file as a buffer
 * @returns {Promise<string>} - CSV content as a string
 */
async function excelToCSV(fileBuffer) {
  try {
    // Read Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet name
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to CSV
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    return csvContent;
  } catch (error) {
    console.error('Error converting Excel to CSV:', error);
    throw new Error(`Error converting Excel to CSV: ${error.message}`);
  }
}

module.exports = {
  processExcel,
  excelToCSV
};