// simpleBQTest.js
require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

async function simpleBQTest() {
  try {
    console.log('Testing BigQuery with minimal config');
    console.log('Project ID:', process.env.GCP_PROJECT_ID);

    // Initialize BigQuery client with NO location
    const bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE
    });

    // Run a simple query
    console.log('Running simple query...');
    const query = 'SELECT 1 as test';

    const [rows] = await bigquery.query({
      query,
      useLegacySql: false
    });

    console.log('Query successful! Result:', rows);
    console.log('BigQuery is working without specifying a region');

  } catch (error) {
    console.error('Error in simple BigQuery test:', error);
  }
}

// Run test
simpleBQTest();