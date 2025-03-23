// testBigQuery.js
require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

async function testBigQuery() {
  console.log('Testing BigQuery connectivity...');
  console.log('Project ID:', process.env.GCP_PROJECT_ID);
  console.log('Key file exists:', process.env.GCP_KEY_FILE ? 'Yes' : 'No');

  try {
    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
      location: 'us-central1' // Hardcoded region
    });

    console.log('BigQuery client initialized');

    // Test query
    console.log('Executing test query...');
    const query = 'SELECT 1 as test';

    const [rows] = await bigquery.query({
      query,
      location: 'us-central1',
      useLegacySql: false
    });

    console.log('Query successful, result:', rows);
    console.log('BigQuery is properly configured!');
  } catch (error) {
    console.error('Error testing BigQuery:', error);

    if (error.message.includes('Permission denied')) {
      console.log('\nPossible solution: The service account needs BigQuery permissions.');
      console.log('Go to Google Cloud Console -> IAM -> Find your service account');
      console.log('Add the "BigQuery Admin" role to your service account.');
    }

    if (error.message.includes('API not enabled')) {
      console.log('\nPossible solution: The BigQuery API is not enabled.');
      console.log('Go to Google Cloud Console -> APIs & Services -> Library');
      console.log('Search for "BigQuery API" and enable it.');
    }
  }
}

// Run the test
testBigQuery();