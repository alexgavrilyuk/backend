This README is in backend/modules/bigquery

# BigQuery Module

This module is responsible for all BigQuery-related operations in the application.

## Responsibilities

- Creating and managing BigQuery datasets and tables
- Loading data into BigQuery
- Executing queries against BigQuery tables
- Verifying BigQuery connectivity
- Managing BigQuery schema definitions
- Updating BigQuery table schemas
- Enhanced type mapping and detection
- Error handling and diagnostics

## API

The module exports the following functions:

- `createBigQueryTable(datasetId, userId, columns, gcsFilePath, dataType)`: Creates a BigQuery table for a dataset
- `deleteBigQueryTable(datasetId, userId)`: Deletes a BigQuery table
- `createBigQueryView(datasetId, userId, viewName, columnNames)`: Creates a BigQuery view
- `runBigQueryQuery(userId, query)`: Executes a SQL query against BigQuery
- `updateTableSchema(datasetId, userId, columns)`: Updates an existing BigQuery table schema
- `verifyConnectivity()`: Verifies connectivity to BigQuery
- `checkConfig()`: Checks if the BigQuery configuration is complete

## Enhanced Type Mapping

The module includes an enhanced type mapping system that:

- Maps application-level column types to BigQuery types
- Uses sample data to improve type detection accuracy
- Handles special cases like dates, booleans, and numeric data
- Provides safe fallbacks for ambiguous types
- Ensures compatibility with BigQuery's type system

Example mapping:
```javascript
// Application type -> BigQuery type
{
  'integer': 'INTEGER',
  'float': 'FLOAT',
  'date': 'DATE',
  'boolean': 'BOOLEAN',
  'string': 'STRING'
}
```

## Schema Updates

The `updateTableSchema` function allows you to modify an existing BigQuery table schema:

```javascript
/**
 * Update a BigQuery table schema
 * @param {string} datasetId - The dataset ID
 * @param {string} userId - The user ID
 * @param {Array} columns - The updated column definitions
 * @returns {Promise<object>} - The updated table metadata
 */
async function updateTableSchema(datasetId, userId, columns) {
  // Implementation details...
}
```

This function:
- Retrieves the existing table schema
- Creates a new schema based on updated column definitions
- Updates the table metadata with the new schema
- Handles errors and edge cases
- Provides detailed logging and diagnostics

## Query Execution

The module provides enhanced query execution capabilities:

- Safe BigQuery requests that prevent query truncation
- Improved error handling with diagnostic information
- Support for EXTRACT date functions and other complex SQL features
- Handling of column names with spaces using backticks
- Special case handling for common query patterns

## Error Handling

The module includes comprehensive error handling:

- Detailed error messages with troubleshooting suggestions
- Region-specific error diagnostics
- Permission and authorization error detection
- API enablement diagnostics
- Retry mechanisms for transient errors

## Loading Data

Data loading into BigQuery has been enhanced with:

- Multiple loading strategies for reliability
- Fallback mechanisms when primary loading methods fail
- Automatic schema detection when needed
- Robust CSV parsing options
- Automatic conversion of Excel files to CSV

## Dependencies

This module depends on:
- `@google-cloud/bigquery`: Google BigQuery client library
- `@google-cloud/storage`: Google Cloud Storage client library
- Storage Module: For file operations
- File Processing Module: For Excel to CSV conversion

## Configuration

The module requires the following environment variables:
- `GCP_PROJECT_ID`: Google Cloud Project ID
- `GCP_KEY_FILE`: Path to Google Cloud service account key file
- `GCS_BUCKET_NAME`: Google Cloud Storage bucket name

## Region Configuration

The module supports explicit region configuration:
- Default region is set to 'us-central1'
- Region is explicitly specified in all operations
- Location is included in query options

## Usage Examples

### Creating a BigQuery Table

```javascript
const { createBigQueryTable } = require('../modules/bigquery');

// Column definitions
const columns = [
  { name: 'id', type: 'integer', nullable: false, primaryKey: true },
  { name: 'name', type: 'string', nullable: false },
  { name: 'created_date', type: 'date', nullable: true },
  { name: 'price', type: 'float', nullable: true }
];

// Create a BigQuery table
const result = await createBigQueryTable(
  'dataset123',
  'user456',
  columns,
  'users/user456/datasets/dataset123/data.csv',
  'csv'
);
```

### Updating a BigQuery Table Schema

```javascript
const { updateTableSchema } = require('../modules/bigquery');

// Updated column definitions
const updatedColumns = [
  { name: 'id', type: 'integer', nullable: false, primaryKey: true },
  { name: 'name', type: 'string', nullable: false },
  { name: 'created_date', type: 'date', nullable: true },
  { name: 'price', type: 'float', nullable: true },
  { name: 'description', type: 'string', nullable: true } // New column
];

// Update the BigQuery table schema
const result = await updateTableSchema(
  'dataset123',
  'user456',
  updatedColumns
);
```

### Running a Query

```javascript
const { runBigQueryQuery } = require('../modules/bigquery');

// Execute a SQL query
const results = await runBigQueryQuery(
  'user456',
  'SELECT * FROM `dataset_123` WHERE price > 100 ORDER BY created_date DESC LIMIT 10'
);
```

## Best Practices

- Always specify column types explicitly when creating tables
- Use the `updateTableSchema` function for schema modifications
- Include proper error handling when calling BigQuery functions
- Use backticks for column names with spaces
- Verify connectivity before critical operations