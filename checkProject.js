// checkProject.js
require('dotenv').config();
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');

async function checkProject() {
  console.log('=== GOOGLE CLOUD PROJECT CHECK ===\n');

  try {
    // 1. Check service account key file
    const keyPath = process.env.GCP_KEY_FILE;
    console.log(`Service account key file path: ${keyPath}`);

    if (fs.existsSync(keyPath)) {
      console.log('✅ Service account key file exists');

      // Try to read the file to check basic JSON validity
      try {
        const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        console.log(`✅ Service account key file is valid JSON`);
        console.log(`✅ Service account email: ${keyFile.client_email}`);
        console.log(`✅ Service account project ID: ${keyFile.project_id}`);

        // Check if the project ID in the key file matches the one in .env
        if (keyFile.project_id !== process.env.GCP_PROJECT_ID) {
          console.log(`❌ WARNING: Project ID mismatch!`);
          console.log(`   .env GCP_PROJECT_ID: ${process.env.GCP_PROJECT_ID}`);
          console.log(`   Service account project_id: ${keyFile.project_id}`);
          console.log(`   You should update your .env to use: GCP_PROJECT_ID=${keyFile.project_id}`);
        } else {
          console.log(`✅ Project IDs match`);
        }
      } catch (e) {
        console.log(`❌ Error reading/parsing service account key file: ${e.message}`);
      }
    } else {
      console.log(`❌ Service account key file not found at: ${keyPath}`);
      return;
    }

    // 2. Check if we can access Storage API (as a sanity check for API access)
    console.log('\nTrying to access Storage API...');

    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE
    });

    // List buckets to see if we have any access
    const [buckets] = await storage.getBuckets();

    console.log(`✅ Successfully accessed Storage API!`);
    console.log(`✅ Found ${buckets.length} buckets in project`);

    // List the buckets
    if (buckets.length > 0) {
      console.log('\nBuckets in project:');
      buckets.forEach(bucket => {
        console.log(`- ${bucket.name}`);
      });
    }

  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);

    if (error.message.includes('The specified bucket does not exist')) {
      console.log(`\nThis suggests your service account can connect to Google Cloud but the bucket doesn't exist.`);
    } else if (error.message.includes('project not found')) {
      console.log(`\nThis suggests the project ID is incorrect or your service account doesn't have access.`);
    } else if (error.message.includes('invalid_grant')) {
      console.log(`\nThis suggests the service account key is invalid or has been revoked.`);
    }
  }

  console.log('\n=== CHECK COMPLETE ===');
}

// Run the check
checkProject();