// multiRegionTest.js
require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

async function testMultiRegion() {
  const regions = ['US', 'EU', null];

  for (const region of regions) {
    try {
      console.log(`Testing BigQuery with region: ${region || 'NONE'}`);

      // Initialize BigQuery with test region
      const bigquery = new BigQuery({
        projectId: process.env.GCP_PROJECT_ID,
        keyFilename: process.env.GCP_KEY_FILE,
        ...(region && { location: region })
      });

      // Run a simple query
      const queryOptions = {
        query: 'SELECT 1 as test',
        useLegacySql: false
      };

      // Add location to query if it exists
      if (region) {
        queryOptions.location = region;
      }

      console.log(`Running query with options:`, queryOptions);
      const [rows] = await bigquery.query(queryOptions);

      console.log(`✅ SUCCESS with region ${region || 'NONE'}! Result:`, rows);
    } catch (error) {
      console.error(`❌ ERROR with region ${region || 'NONE'}:`, error.message);
    }

    console.log('-'.repeat(50));
  }
}

// Run test
testMultiRegion();