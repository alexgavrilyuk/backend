// modules/fileProcessing/utils/fileProcessing.js

/**
 * Utilities for processing files and detecting column types
 */

/**
 * Detects the data type of a column based on sample values
 * @param {Array} samples - Array of sample values from the column
 * @returns {string} - The detected data type ('string', 'integer', 'float', 'date', 'boolean')
 */
function detectColumnType(samples) {
  // Filter out null/empty values
  const nonEmptySamples = samples.filter(s => s !== null && s !== undefined && s !== '');

  if (nonEmptySamples.length === 0) return 'string'; // Default to string if no data

  // Date detection
  const datePattern = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}\.\d{2}\.\d{4}$/;
  const possibleDateCount = nonEmptySamples.filter(s =>
    typeof s === 'string' && datePattern.test(s)
  ).length;

  if (possibleDateCount / nonEmptySamples.length > 0.9) return 'date';

  // Boolean detection
  const boolValues = ['true', 'false', 'yes', 'no', '0', '1', 'y', 'n'];
  const possibleBoolCount = nonEmptySamples.filter(s => {
    const value = String(s).toLowerCase();
    return boolValues.includes(value);
  }).length;

  if (possibleBoolCount / nonEmptySamples.length > 0.9) return 'boolean';

  // Number detection
  const numberPattern = /^-?\d+(\.\d+)?$/;
  const possibleNumberCount = nonEmptySamples.filter(s => {
    if (typeof s === 'number') return true;
    return typeof s === 'string' && numberPattern.test(s);
  }).length;

  if (possibleNumberCount / nonEmptySamples.length > 0.9) {
    // Check if integer or float
    const integerPattern = /^-?\d+$/;
    const possibleIntCount = nonEmptySamples.filter(s => {
      if (Number.isInteger(s)) return true;
      return typeof s === 'string' && integerPattern.test(s);
    }).length;

    if (possibleIntCount / nonEmptySamples.length > 0.9) return 'integer';
    return 'float';
  }

  // Default to string
  return 'string';
}

/**
 * Validates a file based on type, size, and extension
 * @param {Object} file - The file object from express-fileupload
 * @param {number} maxSizeMB - Maximum file size in MB
 * @returns {Object} - Object with validation result and any error message
 */
function validateFile(file, maxSizeMB = 100) {
  try {
    // Check if file exists
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size exceeds the maximum limit of ${maxSizeMB}MB` };
    }

    // Check file type
    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: 'Invalid file type. Only CSV and Excel files are allowed.' };
    }

    // Check file extension
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return { valid: false, error: 'Invalid file extension. Only .csv, .xls and .xlsx are allowed.' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `File validation error: ${error.message}` };
  }
}

module.exports = {
  detectColumnType,
  validateFile
};