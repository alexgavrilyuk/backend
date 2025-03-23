// reloadBigQueryTable.js

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const db = require('./models');

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

// Get bucket
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

/**
 * Check and reload a specific dataset
 * @param {string} datasetId - The dataset ID to check and reload
 */
async function checkAndReloadTable(datasetId) {
  try {
    // Fetch dataset from database
    const dataset = await db.Dataset.findOne({
      where: { id: datasetId }
    });

    if (!dataset) {
      throw new Error(`Dataset with ID ${datasetId} not found in database`);
    }

    console.log(`Checking dataset: ${dataset.name} (${dataset.id})`);

    // Get user's BigQuery dataset
    const userId = dataset.userId;
    const bqDatasetName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const bqTableId = `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    console.log(`Checking BigQuery table: ${bqDatasetName}.${bqTableId}`);

    // Check if dataset exists
    const [datasetExists] = await bigquery.dataset(bqDatasetName).exists();
    if (!datasetExists) {
      throw new Error(`BigQuery dataset ${bqDatasetName} does not exist`);
    }

    // Check if table exists
    const bqDataset = bigquery.dataset(bqDatasetName);
    const [tableExists] = await bqDataset.table(bqTableId).exists();
    if (!tableExists) {
      throw new Error(`BigQuery table ${bqTableId} does not exist in dataset ${bqDatasetName}`);
    }

    // Check row count
    const countQuery = `SELECT COUNT(*) as count FROM \`${process.env.GCP_PROJECT_ID}.${bqDatasetName}.${bqTableId}\``;
    const [rows] = await bigquery.query({
      query: countQuery,
      location: BIGQUERY_LOCATION,
    });

    const rowCount = rows[0].count;
    console.log(`Current row count: ${rowCount}`);

    if (rowCount > 0) {
      console.log(`Table already has ${rowCount} rows. No need to reload.`);
      return;
    }

    // Table has 0 rows, let's reload it
    console.log(`Table has 0 rows. Starting reload process...`);

    // Get the GCS file path
    const gcsFilePath = dataset.filePath;
    console.log(`GCS file path: ${gcsFilePath}`);

    // Verify file exists
    const file = bucket.file(gcsFilePath);
    const [fileExists] = await file.exists();
    if (!fileExists) {
      throw new Error(`Source file does not exist in GCS: ${gcsFilePath}`);
    }
    console.log(`Source file verified in GCS: ${gcsFilePath}`);

    // Get dataset columns
    const columns = await db.DatasetColumn.findAll({
      where: { datasetId },
      order: [['position', 'ASC']]
    });

    if (!columns || columns.length === 0) {
      throw new Error(`No columns found for dataset ${datasetId}`);
    }

    // Convert columns to BigQuery schema
    const schema = columns.map(column => ({
      name: column.name,
      type: mapColumnTypeToBigQuery(column.type),
      mode: column.nullable ? 'NULLABLE' : 'REQUIRED'
    }));

    console.log(`Prepared schema with ${schema.length} columns.`);

    // Set up the load job
    const gcsUri = `gs://${bucket.name}/${gcsFilePath}`;
    console.log(`Loading data from GCS URI: ${gcsUri}`);

    const jobConfig = {
      sourceFormat: 'CSV',
      skipLeadingRows: 1,  // Skip the header row
      allowQuotedNewlines: true,
      allowJaggedRows: true,
      autodetect: false,   // Use our defined schema
      createDisposition: 'CREATE_IF_NEEDED',
      writeDisposition: 'WRITE_TRUNCATE',  // Replace any existing data
      location: BIGQUERY_LOCATION,  // Set location explicitly
      schema: schema // Explicitly set the schema
    };

    // Start the load job
    const table = bqDataset.table(bqTableId);
    const [job] = await table.load(gcsUri, jobConfig);
    console.log(`BigQuery load job ${job.id} started`);

    // Wait for the job to complete
    console.log('Waiting for BigQuery load job to complete...');
    const [metadata] = await job.getMetadata();

    // Check for job errors
    if (metadata.status.errors && metadata.status.errors.length > 0) {
      console.error('BigQuery load job failed with errors:', JSON.stringify(metadata.status.errors, null, 2));
      throw new Error(`BigQuery load job failed: ${JSON.stringify(metadata.status.errors)}`);
    }

    // Log job statistics
    if (metadata.statistics && metadata.statistics.load) {
      console.log(`BigQuery load job completed successfully. Loaded ${metadata.statistics.load.outputRows} rows.`);
    }

    // Verify the data was loaded
    const [verifyRows] = await bigquery.query({
      query: countQuery,
      location: BIGQUERY_LOCATION,
    });

    const newRowCount = verifyRows[0].count;
    console.log(`Verified ${newRowCount} rows in BigQuery table after reload.`);

    console.log(`Reload process completed successfully.`);
  } catch (error) {
    console.error(`Error checking/reloading dataset:`, error);
  }
}

/**
 * Map our column type to BigQuery type
 */
function mapColumnTypeToBigQuery(columnType) {
  const typeMapping = {
    'integer': 'INTEGER',
    'float': 'FLOAT',
    'date': 'DATE',
    'boolean': 'BOOLEAN',
    'string': 'STRING'
  };

  return typeMapping[columnType] || 'STRING';
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    // Check if dataset ID was provided as command line argument
    const datasetId = process.argv[2];

    if (datasetId) {
      // Reload a specific dataset
      await checkAndReloadTable(datasetId);
    } else {
      console.error('Error: Please provide a dataset ID as a command line argument.');
      console.log('Usage: node reloadBigQueryTable.js <datasetId>');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  } finally {
    // Exit gracefully
    process.exit(0);
  }
}

// Run the script
main();