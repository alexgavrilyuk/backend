This README is in backend/modules/fileProcessing

# File Processing Module

This module is responsible for processing CSV and Excel files, extracting schema information, and preparing data for database storage and querying.

## Responsibilities

- CSV file parsing and processing
- Excel file parsing and processing
- Data type detection
- Schema extraction
- Sample data extraction
- Excel to CSV conversion for BigQuery

## API

The module exports the following functions:

### processCSV

```javascript
/**
 * Process a CSV file buffer and extract schema information and sample data
 * @param {Buffer} fileBuffer - The CSV file as a buffer
 * @returns {Promise<Object>} - Object containing columns, rowCount, and sample data
 */
async function processCSV(fileBuffer)
```

### processExcel

```javascript
/**
 * Process an Excel file buffer and extract schema information and sample data
 * @param {Buffer} fileBuffer - The Excel file as a buffer
 * @returns {Promise<Object>} - Object containing columns, rowCount, and sample data
 */
async function processExcel(fileBuffer)
```

### excelToCSV

```javascript
/**
 * Convert Excel file to CSV format for BigQuery
 * @param {Buffer} fileBuffer - The Excel file as a buffer
 * @returns {Promise<string>} - CSV content as a string
 */
async function excelToCSV(fileBuffer)
```

## Usage

```javascript
const { processCSV, processExcel, excelToCSV } = require('../modules/fileProcessing');

// Process a CSV file
const csvBuffer = await downloadFile('path/to/file.csv');
const csvResult = await processCSV(csvBuffer);
console.log(`Extracted ${csvResult.columns.length} columns and ${csvResult.rowCount} rows`);

// Process an Excel file
const excelBuffer = await downloadFile('path/to/file.xlsx');
const excelResult = await processExcel(excelBuffer);
console.log(`Extracted ${excelResult.columns.length} columns and ${excelResult.rowCount} rows`);

// Convert Excel to CSV for BigQuery
const csvContent = await excelToCSV(excelBuffer);
```

## Return Structure

Both `processCSV` and `processExcel` return an object with the following structure:

```javascript
{
  columns: [
    {
      name: "column1",
      type: "string", // One of: string, integer, float, date, boolean
      nullable: true,
      primaryKey: false,
      description: ""
    },
    // More columns...
  ],
  rowCount: 1000, // Total number of rows in the file
  data: [
    { column1: "value1", column2: "value2" },
    // Sample rows (up to 1000)
  ]
}
```

## Dependencies

This module depends on:
- `csv-parser`: For CSV file processing
- `xlsx`: For Excel file processing
- `stream`: For handling stream operations
- `utils/fileProcessing`: For data type detection (to be moved to core/utils later)