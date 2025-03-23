// checkAllDatasets.js

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

/**
 * Check all datasets for a user and report their status
 * @param {string} userId - The user ID to check datasets for (optional)
 */
async function checkAllDatasets(userId = null) {
  try {
    console.log('Checking dataset statuses...');

    // Build query to get datasets
    const whereClause = userId ? { userId } : {};

    // Get all datasets
    const datasets = await db.Dataset.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    console.log(`Found ${datasets.length} datasets to check.`);

    // Results array
    const results = [];

    // Check each dataset
    for (const dataset of datasets) {
      try {
        // Prepare BigQuery identifiers
        const bqDatasetName = `user_${dataset.userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const bqTableId = `dataset_${dataset.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

        console.log(`\nChecking dataset: ${dataset.name} (${dataset.id})`);
        console.log(`BigQuery table: ${bqDatasetName}.${bqTableId}`);

        // Check dataset status
        const status = {
          id: dataset.id,
          name: dataset.name,
          userId: dataset.userId,
          createdAt: dataset.createdAt,
          status: dataset.status,
          databaseRowCount: dataset.rowCount,
          bigQueryDatasetExists: false,
          bigQueryTableExists: false,
          bigQueryRowCount: 0,
          issues: []
        };

        // Check if BigQuery dataset exists
        const [datasetExists] = await bigquery.dataset(bqDatasetName).exists();
        status.bigQueryDatasetExists = datasetExists;

        if (!datasetExists) {
          status.issues.push('BigQuery dataset does not exist');
        } else {
          // Check if BigQuery table exists
          const [tableExists] = await bigquery.dataset(bqDatasetName).table(bqTableId).exists();
          status.bigQueryTableExists = tableExists;

          if (!tableExists) {
            status.issues.push('BigQuery table does not exist');
          } else {
            // Check row count
            try {
              const countQuery = `SELECT COUNT(*) as count FROM \`${process.env.GCP_PROJECT_ID}.${bqDatasetName}.${bqTableId}\``;
              const [rows] = await bigquery.query({
                query: countQuery,
                location: BIGQUERY_LOCATION,
              });

              status.bigQueryRowCount = rows[0].count;

              if (status.bigQueryRowCount === 0) {
                status.issues.push('BigQuery table has 0 rows');
              }

              // Compare with database row count
              if (status.databaseRowCount > 0 && status.bigQueryRowCount === 0) {
                status.issues.push('Database shows rows but BigQuery table is empty');
              }
            } catch (error) {
              status.issues.push(`Error querying row count: ${error.message}`);
            }
          }
        }

        // Add to results
        results.push(status);

        // Print summary
        console.log(`Status: ${status.status}`);
        console.log(`Database row count: ${status.databaseRowCount}`);
        console.log(`BigQuery dataset exists: ${status.bigQueryDatasetExists}`);
        console.log(`BigQuery table exists: ${status.bigQueryTableExists}`);
        console.log(`BigQuery row count: ${status.bigQueryRowCount}`);

        if (status.issues.length > 0) {
          console.log('Issues:');
          status.issues.forEach(issue => console.log(`- ${issue}`));
        } else {
          console.log('No issues detected.');
        }
      } catch (error) {
        console.error(`Error checking dataset ${dataset.id}:`, error);
        results.push({
          id: dataset.id,
          name: dataset.name,
          userId: dataset.userId,
          error: error.message
        });
      }
    }

    // Print summary
    console.log('\n===== SUMMARY =====');
    console.log(`Total datasets: ${datasets.length}`);

    const datasetsWithIssues = results.filter(r => r.issues && r.issues.length > 0);
    console.log(`Datasets with issues: ${datasetsWithIssues.length}`);

    if (datasetsWithIssues.length > 0) {
      console.log('\nDatasets that need attention:');
      datasetsWithIssues.forEach(dataset => {
        console.log(`- ${dataset.name} (${dataset.id}): ${dataset.issues.join(', ')}`);
      });

      console.log('\nTo fix datasets with 0 rows, run:');
      datasetsWithIssues
        .filter(d => d.issues.includes('BigQuery table has 0 rows'))
        .forEach(dataset => {
          console.log(`node reloadBigQueryTable.js ${dataset.id}`);
        });
    }

    return results;
  } catch (error) {
    console.error('Error checking datasets:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check if user ID was provided
    const userId = process.argv[2];

    if (userId) {
      console.log(`Checking datasets for user: ${userId}`);
      await checkAllDatasets(userId);
    } else {
      console.log('Checking datasets for all users');
      await checkAllDatasets();
    }

    process.exit(0);
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run the script
main();