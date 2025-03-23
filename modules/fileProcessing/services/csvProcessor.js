// modules/fileProcessing/services/csvProcessor.js

const csv = require('csv-parser');
const { Readable } = require('stream');
const { detectColumnType } = require('../utils/fileProcessing');

/**
 * Process a CSV file buffer and extract schema information and sample data
 * @param {Buffer} fileBuffer - The CSV file as a buffer
 * @returns {Promise<Object>} - Object containing columns, rowCount, and sample data
 */
async function processCSV(fileBuffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const columns = new Map();
    let rowCount = 0;

    // Create readable stream from buffer
    const readableStream = new Readable();
    readableStream.push(fileBuffer);
    readableStream.push(null);

    readableStream
      .pipe(csv())
      .on('headers', (headers) => {
        // Initialize column detection
        headers.forEach(header => {
          columns.set(header, {
            name: header,
            type: null,
            nullable: true,
            primaryKey: false,
            samples: []
          });
        });
      })
      .on('data', (data) => {
        rowCount++;

        // Only store first 1000 rows for preview
        if (results.length < 1000) {
          results.push(data);
        }

        // Sample values for type detection (up to 1000 samples)
        if (rowCount <= 1000) {
          for (const [header, value] of Object.entries(data)) {
            if (columns.has(header)) {
              const column = columns.get(header);
              if (column.samples.length < 1000) {
                column.samples.push(value);
              }
            }
          }
        }
      })
      .on('end', () => {
        // Detect column types
        for (const [header, column] of columns.entries()) {
          column.type = detectColumnType(column.samples);
          column.nullable = column.samples.some(sample => sample === null || sample === '');

          // Clean up samples to avoid memory bloat
          delete column.samples;
        }

        resolve({
          columns: Array.from(columns.values()),
          rowCount,
          data: results
        });
      })
      .on('error', (error) => {
        reject(new Error(`Error processing CSV: ${error.message}`));
      });
  });
}

module.exports = {
  processCSV
};