// modules/bigquery/service.js

const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const { excelToCSV } = require('../fileProcessing'); // Updated import
const { downloadFile } = require('../storage');
require('dotenv').config();

// Define the location globally
const BIGQUERY_LOCATION = 'us-central1';

// Initialize BigQuery client with location
const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE,
  location: BIGQUERY_LOCATION
});

// Initialize storage client
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE
});

/**
 * A wrapper around BigQuery requests to ensure queries aren't truncated
 * @param {string} query - SQL query to execute
 * @param {object} options - BigQuery options
 * @returns {Promise<object>} BigQuery response
 */
async function safeBigQueryRequest(query, options = {}) {
  // Create a new Buffer to ensure the full string is sent without any truncation
  const queryBuffer = Buffer.from(query, 'utf8');
  const queryStr = queryBuffer.toString('utf8');

  console.log(`Query length in bytes: ${queryBuffer.length}`);
  console.log(`Query string: ${queryStr}`);

  // Replace any remaining double quotes with backticks for column names
  const finalQuery = queryStr.replace(/"([^"]+)"/g, "`$1`");

  // Ensure we have all options set
  const fullOptions = {
    ...options,
    query: finalQuery,
    location: BIGQUERY_LOCATION,
    useLegacySql: false
  };

  // Send request directly rather than using convenience methods
  return bigquery.request({
    method: 'POST',
    uri: `/projects/${process.env.GCP_PROJECT_ID}/queries`,
    json: fullOptions
  });
}

/**
 * Create a BigQuery dataset for a user if it doesn't exist
 * @param {string} userId - The user ID
 * @returns {Promise<object>} - The BigQuery dataset
 */
async function getBigQueryDataset(userId) {
  // Sanitize userId to be BigQuery compatible (only letters, numbers, and underscores)
  const datasetName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;

  try {
    // Check if dataset exists
    const [datasetExists] = await bigquery.dataset(datasetName).exists();

    if (!datasetExists) {
      // Create the dataset
      const [dataset] = await bigquery.createDataset(datasetName, {
        location: BIGQUERY_LOCATION
      });
      console.log(`Dataset ${datasetName} created.`);
      return dataset;
    } else {
      // Get the existing dataset
      const [dataset] = await bigquery.dataset(datasetName).get();
      return dataset;
    }
  } catch (error) {
    console.error(`Error getting or creating BigQuery dataset ${datasetName}:`, error);
    throw error;
  }
}

/**
 * Convert column type from our system to BigQuery type with enhanced safety
 * @param {string} columnType - The column type in our system
 * @param {Array} sampleValues - Sample values for enhanced type detection
 * @returns {string} - The BigQuery column type
 */
function mapColumnTypeToBigQuery(columnType, sampleValues = []) {
  // Default base mapping
  const typeMapping = {
    'integer': 'INTEGER',
    'float': 'FLOAT',
    'date': 'DATE',
    'boolean': 'BOOLEAN',
    'string': 'STRING'
  };

  // If we have sample values, use them to enhance type detection
  if (sampleValues && sampleValues.length > 0) {
    // Filter out null/undefined/empty values
    const validSamples = sampleValues.filter(v => v !== null && v !== undefined && v !== '');

    if (validSamples.length > 0) {
      // For boolean detection, check if the values are numeric
      if (columnType === 'boolean') {
        const numericPattern = /^[0-9]+$/;
        const hasNumericValues = validSamples.some(v => numericPattern.test(String(v)));

        // If detected as boolean but has numeric values, use INTEGER instead
        if (hasNumericValues) {
          console.log(`Column detected as boolean but contains numeric values. Using INTEGER instead.`);
          return 'INTEGER';
        }
      }

      // For string detection, check if values contain month names
      if (columnType === 'string' &&
          validSamples.some(v => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(String(v)))) {
        console.log(`Column appears to contain month names. Using STRING type.`);
        return 'STRING';
      }
    }
  }

  // Return the mapped type or STRING as a safe default
  return typeMapping[columnType] || 'STRING';
}

/**
 * Create a BigQuery table for a dataset
 * @param {string} datasetId - The dataset ID
 * @param {string} userId - The user ID
 * @param {Array} columns - The columns to create
 * @param {string} gcsFilePath - The path to the file in GCS
 * @param {string} dataType - The type of data ('csv' or 'excel')
 * @returns {Promise<object>} - Information about the BigQuery table
 */
async function createBigQueryTable(datasetId, userId, columns, gcsFilePath, dataType) {
  try {
    // Get or create the user's BigQuery dataset
    const dataset = await getBigQueryDataset(userId);

    // Sanitize datasetId to be BigQuery compatible
    const tableId = `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Sample data to enhance schema detection
    let sampleData = [];
    if (columns.length > 0 && columns[0].samples) {
      sampleData = columns.map(col => ({ name: col.name, samples: col.samples || [] }));
    }

    // Create BigQuery schema from columns with enhanced type detection
    const schema = columns.map(column => {
      const samples = column.samples || [];
      return {
        name: column.name,
        type: mapColumnTypeToBigQuery(column.type, samples),
        mode: column.nullable ? 'NULLABLE' : 'REQUIRED',
        description: column.description || '' // Include description in schema
      };
    });

    console.log(`Creating BigQuery table: ${tableId} in dataset ${dataset.id} with schema:`, JSON.stringify(schema, null, 2));

    // Create the table with schema first, before loading data
    // For safety, we use STRING for columns that might cause parsing issues
    const safeSchema = schema.map(field => {
      // If we're not confident about the type, default to STRING
      // This ensures data loads properly and can be handled in queries
      if ((field.name || '').toLowerCase().includes('month') &&
          !['STRING', 'INTEGER'].includes(field.type)) {
        console.log(`Using STRING for column ${field.name} to ensure compatibility`);
        return {
          ...field,
          type: 'STRING' // Use STRING as a safe default for potential month fields
        };
      }
      return field;
    });

    // Create the table
    const [table] = await dataset.createTable(tableId, {
      schema: safeSchema,
      description: `Uploaded dataset ${datasetId}`,
      expirationTime: undefined  // Never expires
    });

    console.log(`Table ${tableId} created in dataset ${dataset.id}`);

    // Get the bucket
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

    // Verify file exists
    const file = bucket.file(gcsFilePath);
    const [fileExists] = await file.exists();
    if (!fileExists) {
      throw new Error(`Source file does not exist in GCS: ${gcsFilePath}`);
    }
    console.log(`Source file verified in GCS: ${gcsFilePath}`);

    let finalGcsPath = gcsFilePath;

    // Handle Excel files by converting to CSV
    if (dataType === 'excel') {
      // Download the Excel file
      const excelBuffer = await downloadFile(gcsFilePath);

      // Convert to CSV
      const csvContent = await excelToCSV(excelBuffer);

      // Upload CSV to GCS
      finalGcsPath = gcsFilePath.replace(/\.(xlsx|xls)$/i, '.csv');
      const csvFile = bucket.file(finalGcsPath);

      await csvFile.save(csvContent, {
        contentType: 'text/csv'
      });

      console.log(`Converted Excel file to CSV at ${finalGcsPath}`);
    }

    // Try both methods of loading the data, with careful error handling
    let loadingSuccessful = false;
    let rowCount = 0;
    let loadError = null;

    // Use safer, more flexible loading options
    const loadOptions = {
      sourceFormat: 'CSV',
      skipLeadingRows: 1,  // Skip the header row
      allowQuotedNewlines: true,
      allowJaggedRows: true,
      maxBadRecords: 1000000,  // Allow a very high number of bad records
      writeDisposition: 'WRITE_TRUNCATE',
      // Added for CSV parsing flexibility
      fieldDelimiter: ',',
      quote: '"',
      encoding: 'UTF-8',
      ignoreUnknownValues: true  // Ignore values that don't match the schema
    };

    // Method 1: Try direct table.load method first
    try {
      console.log("Attempting to load data using table.load method...");

      // Execute the load
      const [job] = await table.load(file, loadOptions);
      console.log(`BigQuery load job ${job.id} started`);

      // Wait for job completion
      const [metadata] = await job.getMetadata();

      // Check job status
      if (metadata.status && metadata.status.state === 'DONE') {
        if (metadata.status.errors && metadata.status.errors.length > 0) {
          console.warn("Load job completed with errors:", JSON.stringify(metadata.status.errors, null, 2));
          // We'll continue if there are only parsing errors
          if (metadata.statistics && metadata.statistics.load && metadata.statistics.load.outputRows > 0) {
            loadingSuccessful = true;
            rowCount = parseInt(metadata.statistics.load.outputRows);
            console.log(`Loaded ${rowCount} rows despite some errors.`);
          } else {
            loadError = new Error(`Load job completed but with errors and no rows loaded: ${JSON.stringify(metadata.status.errors)}`);
          }
        } else {
          loadingSuccessful = true;
          if (metadata.statistics && metadata.statistics.load) {
            rowCount = parseInt(metadata.statistics.load.outputRows);
            console.log(`Successfully loaded ${rowCount} rows of data.`);
          }
        }
      }
    } catch (error) {
      console.warn("Error loading with table.load method:", error.message);
      loadError = error;
    }

    // Method 2: Use createLoadJob if Method 1 failed
    if (!loadingSuccessful) {
      try {
        console.log("Attempting to load data using createLoadJob method...");

        // Create the GCS URI for the BigQuery load job
        const gcsUri = `gs://${bucket.name}/${finalGcsPath}`;

        // Create job configuration
        const jobConfig = {
          configuration: {
            load: {
              sourceUris: [gcsUri],
              destinationTable: {
                projectId: process.env.GCP_PROJECT_ID,
                datasetId: dataset.id,
                tableId: tableId
              },
              // Include all load options here
              sourceFormat: 'CSV',
              skipLeadingRows: 1,
              allowQuotedNewlines: true,
              allowJaggedRows: true,
              maxBadRecords: 1000000,
              writeDisposition: 'WRITE_TRUNCATE',
              fieldDelimiter: ',',
              quote: '"',
              encoding: 'UTF-8',
              ignoreUnknownValues: true
            }
          }
        };

        // Create and start the job
        const [job] = await bigquery.createJob(jobConfig);
        console.log(`BigQuery load job ${job.id} started with createJob`);

        // Wait for job completion
        const [metadata] = await job.getMetadata();

        // Check job status
        if (metadata.status && metadata.status.state === 'DONE') {
          if (metadata.status.errors && metadata.status.errors.length > 0) {
            console.warn("Load job completed with errors:", JSON.stringify(metadata.status.errors, null, 2));
            // Continue if there are rows loaded despite errors
            if (metadata.statistics && metadata.statistics.load && metadata.statistics.load.outputRows > 0) {
              loadingSuccessful = true;
              rowCount = parseInt(metadata.statistics.load.outputRows);
              console.log(`Loaded ${rowCount} rows despite some errors.`);
            } else {
              loadError = new Error(`Load job completed but with errors and no rows loaded: ${JSON.stringify(metadata.status.errors)}`);
            }
          } else {
            loadingSuccessful = true;
            if (metadata.statistics && metadata.statistics.load) {
              rowCount = parseInt(metadata.statistics.load.outputRows);
              console.log(`Successfully loaded ${rowCount} rows of data.`);
            }
          }
        }
      } catch (error) {
        console.warn("Error loading with createLoadJob method:", error.message);
        // If both methods failed, throw the original error
        if (loadError) {
          throw loadError;
        }
        throw error;
      }
    }

    // Method 3: If both methods failed, try one last approach with autodetect schema
    if (!loadingSuccessful) {
      try {
        console.log("Attempting final load method with schema autodetection...");

        // Drop the existing table
        await table.delete();
        console.log("Dropped existing table for recreation with autodetected schema");

        // Create the GCS URI for the BigQuery load job
        const gcsUri = `gs://${bucket.name}/${finalGcsPath}`;

        // Create job configuration with autodetect
        const jobConfig = {
          configuration: {
            load: {
              sourceUris: [gcsUri],
              destinationTable: {
                projectId: process.env.GCP_PROJECT_ID,
                datasetId: dataset.id,
                tableId: tableId
              },
              autodetect: true,  // Let BigQuery detect the schema
              sourceFormat: 'CSV',
              skipLeadingRows: 1,
              allowQuotedNewlines: true,
              allowJaggedRows: true,
              maxBadRecords: 1000000,
              createDisposition: 'CREATE_IF_NEEDED',
              writeDisposition: 'WRITE_TRUNCATE',
              fieldDelimiter: ',',
              quote: '"',
              encoding: 'UTF-8'
            }
          }
        };

        // Create and start the job
        const [job] = await bigquery.createJob(jobConfig);
        console.log(`BigQuery load job ${job.id} started with schema autodetection`);

        // Wait for job completion
        const [metadata] = await job.getMetadata();

        // Check job status
        if (metadata.status && metadata.status.state === 'DONE') {
          if (metadata.status.errors && metadata.status.errors.length > 0) {
            console.warn("Load job completed with errors:", JSON.stringify(metadata.status.errors, null, 2));
            // Continue if there are rows loaded despite errors
            if (metadata.statistics && metadata.statistics.load && metadata.statistics.load.outputRows > 0) {
              loadingSuccessful = true;
              rowCount = parseInt(metadata.statistics.load.outputRows);
              console.log(`Loaded ${rowCount} rows with autodetect despite some errors.`);
            } else {
              loadError = new Error(`Load job completed but with errors and no rows loaded: ${JSON.stringify(metadata.status.errors)}`);
            }
          } else {
            loadingSuccessful = true;
            if (metadata.statistics && metadata.statistics.load) {
              rowCount = parseInt(metadata.statistics.load.outputRows);
              console.log(`Successfully loaded ${rowCount} rows with autodetected schema.`);
            }
          }
        }
      } catch (error) {
        console.warn("Error loading with autodetect method:", error.message);
        // If all methods failed, throw the original error
        if (loadError) {
          throw loadError;
        }
        throw error;
      }
    }

    // Verify loaded data with a count query
    try {
      const verifyQuery = `SELECT COUNT(*) as count FROM \`${process.env.GCP_PROJECT_ID}.${dataset.id}.${tableId}\``;
      const countResults = await runBigQueryQuery(userId, verifyQuery);

      const verifiedRowCount = countResults.rows[0].count;
      console.log(`Verified ${verifiedRowCount} rows in BigQuery table ${tableId}`);

      if (verifiedRowCount === 0 && !loadingSuccessful) {
        throw new Error("Failed to load any data into BigQuery table.");
      }

      // Use the verified row count
      rowCount = verifiedRowCount;
    } catch (error) {
      console.warn("Error verifying row count:", error.message);
      // Continue even if verification fails
    }

    // Return information about the BigQuery table
    return {
      datasetId: dataset.id,
      tableId,
      rowCount: rowCount,
      schema
    };
  } catch (error) {
    console.error(`Error creating BigQuery table for dataset ${datasetId}:`, error);
    // Log more detailed error information
    if (error.errors) {
      console.error('Detailed errors:', JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}

/**
 * Delete a BigQuery table
 * @param {string} datasetId - The dataset ID
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
async function deleteBigQueryTable(datasetId, userId) {
  try {
    // Get the dataset
    const datasetName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const tableId = `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Check if dataset exists
    const [datasetExists] = await bigquery.dataset(datasetName).exists();

    if (!datasetExists) {
      console.log(`Dataset ${datasetName} does not exist. Nothing to delete.`);
      return true;
    }

    // Check if table exists
    const dataset = bigquery.dataset(datasetName);
    const [tableExists] = await dataset.table(tableId).exists();

    if (!tableExists) {
      console.log(`Table ${tableId} does not exist in dataset ${datasetName}. Nothing to delete.`);
      return true;
    }

    // Delete the table
    await dataset.table(tableId).delete({
      location: BIGQUERY_LOCATION  // Set location explicitly
    });

    console.log(`Table ${tableId} deleted from dataset ${datasetName}`);
    return true;
  } catch (error) {
    console.error(`Error deleting BigQuery table for dataset ${datasetId}:`, error);
    throw error;
  }
}

/**
 * Create a BigQuery view for dataset columns
 * These views can be useful for frontend visualization or AI querying
 * @param {string} datasetId - The dataset ID
 * @param {string} userId - The user ID
 * @param {string} viewName - The name for the view
 * @param {Array<string>} columnNames - The columns to include in the view
 * @returns {Promise<object>} - Information about the created view
 */
async function createBigQueryView(datasetId, userId, viewName, columnNames) {
  try {
    // Get the dataset
    const datasetName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const tableId = `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const viewId = `view_${viewName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Build the SQL query for the view - use backticks for column names
    const columnsSQL = columnNames.map(col => `\`${col}\``).join(', ');
    const viewQuery = `SELECT ${columnsSQL} FROM \`${process.env.GCP_PROJECT_ID}.${datasetName}.${tableId}\``;

    // Create the view
    const dataset = bigquery.dataset(datasetName);
    const [view] = await dataset.createTable(viewId, {
      view: {
        query: viewQuery,
        useLegacySql: false
      },
      location: BIGQUERY_LOCATION,  // Set location explicitly
      description: `View for dataset ${datasetId} - ${viewName}`
    });

    console.log(`View ${viewId} created in dataset ${datasetName}`);

    return {
      datasetId: datasetName,
      viewId,
      query: viewQuery
    };
  } catch (error) {
    console.error(`Error creating BigQuery view for dataset ${datasetId}:`, error);
    throw error;
  }
}

/**
 * Run a SQL query against a dataset in BigQuery
 * @param {string} userId - The user ID
 * @param {string} query - The SQL query to run
 * @returns {Promise<object>} - The query results
 */
async function runBigQueryQuery(userId, query) {
  try {
    // Debug the query to check for truncation
    console.log("Full SQL query before execution:", query);
    console.log("Query length:", query.length);

    // Verify the query isn't obviously invalid
    if (query.includes('EXTRACT(') && !query.includes(')')) {
      throw new Error('Invalid EXTRACT function syntax. The function appears to be truncated.');
    }

    // Handle potential column name formatting issues
    // Replace any double quotes around column names with backticks for BigQuery
    const queryWithBackticks = query.replace(/"([^"]+)"/g, "`$1`");

    // Extra validation for EXTRACT functions
    const extractRegex = /EXTRACT\s*\(\s*(\w+)\s+FROM/gi;
    if (extractRegex.test(queryWithBackticks)) {
      // Check for proper closing parenthesis
      const openParens = (queryWithBackticks.match(/EXTRACT\s*\(/gi) || []).length;
      const closeParens = (queryWithBackticks.match(/\)/g) || []).length;

      if (openParens > closeParens) {
        throw new Error('Syntax error: Missing closing parenthesis in EXTRACT function');
      }
    }

    // Use our safer direct request method to bypass potential truncation issues
    const response = await safeBigQueryRequest(queryWithBackticks);

    if (response && response.rows) {
      return {
        rows: response.rows,
        metadata: {
          totalRows: response.totalRows || response.rows.length
        }
      };
    }

    // If we didn't get a direct response, fallback to the standard method
    // but be extra careful about encoding
    const queryOptions = {
      query: Buffer.from(queryWithBackticks, 'utf8').toString('utf8'),
      location: BIGQUERY_LOCATION,
      useLegacySql: false,
      // Add parameter that might help with large query strings
      maximumBytesBilled: "10000000000" // 10GB
    };

    const [job] = await bigquery.createQueryJob(queryOptions);

    // Wait for the query to finish
    const [rows] = await job.getQueryResults({
      location: BIGQUERY_LOCATION  // Set location explicitly
    });

    return {
      rows,
      metadata: {
        totalRows: rows.length
      }
    };
  } catch (error) {
    console.error('Error running BigQuery query:', error);
    throw error;
  }
}

/**
 * Update a BigQuery table schema
 * @param {string} datasetId - The dataset ID
 * @param {string} userId - The user ID
 * @param {Array} columns - The updated column definitions
 * @returns {Promise<object>} - The updated table metadata
 */
async function updateTableSchema(datasetId, userId, columns) {
  try {
    // Get or create the user's BigQuery dataset
    const datasetName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const tableId = `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Check if dataset exists
    const [datasetExists] = await bigquery.dataset(datasetName).exists();
    if (!datasetExists) {
      throw new Error(`BigQuery dataset ${datasetName} does not exist`);
    }

    // Get dataset and table references
    const dataset = bigquery.dataset(datasetName);

    // Check if table exists
    const [tableExists] = await dataset.table(tableId).exists();
    if (!tableExists) {
      throw new Error(`BigQuery table ${tableId} does not exist in dataset ${datasetName}`);
    }

    // Get the current table metadata
    const table = dataset.table(tableId);
    const [metadata] = await table.getMetadata();

    console.log(`Updating schema for table ${tableId} in dataset ${datasetName}`);

    // Create new schema based on columns array
    const newSchema = {
      fields: columns.map(column => ({
        name: column.name,
        type: mapColumnTypeToBigQuery(column.type),
        mode: column.nullable ? 'NULLABLE' : 'REQUIRED',
        description: column.description || ''
      }))
    };

    // Log schema changes
    console.log('New schema:', JSON.stringify(newSchema, null, 2));

    // Update the table schema
    const [result] = await table.setMetadata({
      ...metadata,
      schema: newSchema
    });

    console.log(`Schema updated successfully for table ${tableId}`);

    return result;
  } catch (error) {
    console.error(`Error updating BigQuery table schema for dataset ${datasetId}:`, error);
    throw new Error(`Failed to update BigQuery schema: ${error.message}`);
  }
}

/**
 * Execute multiple SQL queries sequentially
 * @param {string} userId - The user ID
 * @param {Array<string>} queries - Array of SQL queries to execute
 * @returns {Promise<Array>} - Array of query results
 */
async function executeMultipleQueries(userId, queries) {
  const results = [];

  console.log(`Executing ${queries.length} queries sequentially`);

  for (let i = 0; i < queries.length; i++) {
    try {
      console.log(`Executing query ${i+1}/${queries.length}`);
      const result = await runBigQueryQuery(userId, queries[i]);
      results.push({
        queryIndex: i,
        query: queries[i],
        rows: result.rows,
        metadata: result.metadata
      });
    } catch (error) {
      console.error(`Error executing query ${i+1}:`, error);
      throw new Error(`Failed to execute query ${i+1}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Execute a complex query plan with multiple related queries
 * @param {string} userId - The user ID
 * @param {Object} queryPlan - Query plan with steps and dependencies
 * @returns {Promise<Object>} - Results from each query step
 */
async function executeQueryPlan(userId, queryPlan) {
  // Validate input
  if (!queryPlan || !queryPlan.steps || !Array.isArray(queryPlan.steps)) {
    throw new Error('Invalid query plan: missing steps array');
  }

  const results = {};
  const executedSteps = new Set();

  console.log(`Executing query plan with ${queryPlan.steps.length} steps`);

  // Helper function to check if all dependencies for a step are satisfied
  const areDependenciesMet = (step) => {
    if (!step.dependencies || !Array.isArray(step.dependencies) || step.dependencies.length === 0) {
      return true;
    }

    return step.dependencies.every(depId => executedSteps.has(depId));
  };

  // Process steps while respecting dependencies
  let progressMade = true;
  while (executedSteps.size < queryPlan.steps.length && progressMade) {
    progressMade = false;

    for (const step of queryPlan.steps) {
      // Skip already executed steps
      if (executedSteps.has(step.id)) continue;

      // Check if dependencies are met
      if (!areDependenciesMet(step)) continue;

      try {
        console.log(`Executing step ${step.id}: ${step.description || 'No description'}`);

        // If the query is provided directly
        if (step.query) {
          const queryResult = await runBigQueryQuery(userId, step.query);
          results[step.id] = {
            id: step.id,
            description: step.description,
            rows: queryResult.rows,
            metadata: queryResult.metadata
          };
        }
        // If only a natural language query is provided, we need to generate the SQL
        else if (step.naturalLanguageQuery) {
          // This would typically be handled by another module like queries/nlpService
          // For now, we'll just log a warning
          console.warn(`Step ${step.id} has naturalLanguageQuery but no direct SQL query`);
          results[step.id] = {
            id: step.id,
            description: step.description,
            error: 'Natural language queries must be converted to SQL before execution',
            rows: [],
            metadata: { totalRows: 0 }
          };
        }
        else {
          throw new Error(`Step ${step.id} has no query or naturalLanguageQuery`);
        }

        // Mark step as executed
        executedSteps.add(step.id);
        progressMade = true;
      } catch (error) {
        console.error(`Error executing step ${step.id}:`, error);
        throw new Error(`Failed to execute query plan at step ${step.id}: ${error.message}`);
      }
    }
  }

  // Check if all steps were executed
  if (executedSteps.size < queryPlan.steps.length) {
    // Find steps that weren't executed
    const unexecutedSteps = queryPlan.steps
      .filter(step => !executedSteps.has(step.id))
      .map(step => step.id);

    throw new Error(`Could not execute all steps in query plan. Unexecuted steps: ${unexecutedSteps.join(', ')}. This may be due to circular dependencies.`);
  }

  return {
    results,
    completedSteps: [...executedSteps],
    totalSteps: queryPlan.steps.length,
    queryType: queryPlan.queryType || 'unknown'
  };
}

/**
 * Create a temporary table for complex query operations
 * @param {string} userId - The user ID
 * @param {string} tempTableName - Temporary table name suffix
 * @param {Array} schema - Table schema definition
 * @param {Array} data - Data to load into the table (optional)
 * @returns {Promise<Object>} - Information about the created temporary table
 */
async function createTemporaryTable(userId, tempTableName, schema, data = []) {
  try {
    // Get or create the user's BigQuery dataset
    const dataset = await getBigQueryDataset(userId);

    // Generate a unique table ID with timestamp to avoid collisions
    const timestamp = Date.now();
    const tableId = `temp_${tempTableName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;

    console.log(`Creating temporary table: ${tableId} in dataset ${dataset.id}`);

    // Create the temporary table with schema
    const [table] = await dataset.createTable(tableId, {
      schema: schema,
      description: `Temporary table created for query operations`,
      expirationTime: Date.now() + (3600000 * 24) // 24 hour expiration
    });

    console.log(`Temporary table ${tableId} created with 24 hour expiration`);

    // If data is provided, insert it into the table
    if (data && data.length > 0) {
      // Process in batches of 500 rows to avoid insert limits
      const batchSize = 500;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, Math.min(i + batchSize, data.length));

        // Insert data batch
        await table.insert(batch, { raw: true });
        console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)} (${batch.length} rows)`);
      }

      console.log(`Successfully inserted ${data.length} rows into temporary table ${tableId}`);
    }

    return {
      datasetId: dataset.id,
      tableId: tableId,
      fullTableName: `${process.env.GCP_PROJECT_ID}.${dataset.id}.${tableId}`,
      rowCount: data.length
    };
  } catch (error) {
    console.error(`Error creating temporary table:`, error);
    throw new Error(`Failed to create temporary table: ${error.message}`);
  }
}

/**
 * Verify connectivity to BigQuery
 * @returns {Promise<boolean>} - Whether the connection is successful
 */
async function verifyConnectivity() {
  try {
    // Run a simple query to verify connection
    const [job] = await bigquery.createQueryJob({
      query: 'SELECT 1 as test',
      location: BIGQUERY_LOCATION
    });

    const [rows] = await job.getQueryResults();

    if (rows && rows.length > 0 && rows[0].test === 1) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error verifying BigQuery connectivity:', error);
    throw error;
  }
}

/**
 * Check if BigQuery configuration is complete
 * @returns {Object} Status of BigQuery configuration
 */
function checkConfig() {
  const requiredEnvVars = [
    'GCP_PROJECT_ID',
    'GCP_KEY_FILE',
    'GCS_BUCKET_NAME'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    return {
      isComplete: false,
      message: `Missing environment variables: ${missingVars.join(', ')}`
    };
  }

  return {
    isComplete: true,
    message: 'BigQuery configuration is complete'
  };
}

module.exports = {
  createBigQueryTable,
  deleteBigQueryTable,
  createBigQueryView,
  runBigQueryQuery,
  updateTableSchema,
  executeMultipleQueries,
  executeQueryPlan,
  createTemporaryTable,
  verifyConnectivity,
  checkConfig
};