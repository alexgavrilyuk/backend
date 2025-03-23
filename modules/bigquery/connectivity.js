// modules/bigquery/connectivity.js

const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

/**
 * Verify BigQuery connectivity by performing a simple query
 * @returns {Promise<boolean>} - True if connectivity is successful
 */
async function verifyBigQueryConnectivity() {
  try {
    console.log('Starting BigQuery connectivity check');
    console.log('Project ID:', process.env.GCP_PROJECT_ID);

    // Initialize BigQuery client with hardcoded region
    const bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE,
      location: 'us-central1' // Hardcoded region to avoid parsing issues
    });

    console.log('BigQuery client initialized, running test query...');

    // Test connection with a simple query, explicitly specifying location
    const [rows] = await bigquery.query({
      query: 'SELECT 1 as test',
      location: 'us-central1', // Explicitly set location for the query
      useLegacySql: false
    });

    console.log('BigQuery connectivity verified successfully');
    return true;
  } catch (error) {
    console.error('Error verifying BigQuery connectivity:', error);

    // Enhanced error message with troubleshooting help
    let errorMsg = `Failed to connect to BigQuery: ${error.message}`;

    if (error.message.includes('not authorized')) {
      errorMsg += '\nPossible causes: \n- Service account lacks necessary permissions \n- Invalid service account key file';
    } else if (error.message.includes('not found')) {
      errorMsg += '\nPossible causes: \n- GCP_PROJECT_ID is incorrect \n- Project doesn\'t exist';
    } else if (error.message.includes('API has not been used')) {
      errorMsg += '\nPossible cause: BigQuery API is not enabled for this project. Enable it in the Google Cloud Console.';
    } else if (error.message.includes('Permission denied')) {
      errorMsg += '\nYour service account needs BigQuery permissions. Add the "BigQuery Admin" or "BigQuery User" role.';
    } else if (error.message.includes('CloudRegion')) {
      errorMsg += '\nRegion specification issue. Using hardcoded region "us-central1" to resolve.';
    }

    throw new Error(errorMsg);
  }
}

/**
 * Helper function to check if BigQuery configuration is complete
 * @returns {Object} - Object containing configuration status
 */
function checkBigQueryConfig() {
  const requiredVars = ['GCP_PROJECT_ID', 'GCP_KEY_FILE', 'GCS_BUCKET_NAME'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  return {
    isComplete: missingVars.length === 0,
    missingVars,
    message: missingVars.length === 0
      ? 'BigQuery configuration is complete'
      : `Missing required environment variables: ${missingVars.join(', ')}`
  };
}

module.exports = {
  verifyBigQueryConnectivity,
  checkBigQueryConfig
};