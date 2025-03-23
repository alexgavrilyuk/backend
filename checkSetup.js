// checkSetup.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const { OpenAI } = require('openai');


/**
 * Utility to verify the server setup and diagnose issues
 */
async function verifySetup() {
  console.log('\n===== SETUP VERIFICATION =====\n');

  // Check environment variables
  verifyEnvironmentVariables();

  // Check database connectivity
  await verifyDatabaseConnectivity();

  // Check Google Cloud Storage connectivity
  await verifyGCSConnectivity();

  // Check BigQuery connectivity
  await verifyBigQueryConnectivity();

  // Check OpenAI API connectivity
  await verifyOpenAIConnectivity();

  console.log('\n===== VERIFICATION COMPLETE =====\n');
}

/**
 * Verify all required environment variables are set
 */
function verifyEnvironmentVariables() {
  console.log('Checking environment variables...');

  const requiredVars = {
    // Database
    'DB_USER': 'Database username',
    'DB_PASS': 'Database password',
    'DB_HOST': 'Database host',
    'DB_PORT': 'Database port',
    'DB_NAME': 'Database name',

    // JWT
    'JWT_SECRET': 'JWT secret key',

    // Google Cloud
    'GCP_PROJECT_ID': 'Google Cloud project ID',
    'GCP_KEY_FILE': 'Path to Google Cloud service account key file',
    'GCS_BUCKET_NAME': 'Google Cloud Storage bucket name',

    // OpenAI
    'OPENAI_API_KEY': 'OpenAI API key'
  };

  const missingVars = [];
  const setVars = [];

  for (const [varName, description] of Object.entries(requiredVars)) {
    if (!process.env[varName]) {
      missingVars.push({ name: varName, description });
    } else {
      const value = varName.includes('KEY') || varName.includes('SECRET') || varName.includes('PASS')
        ? '******'
        : process.env[varName].length > 20
          ? process.env[varName].substring(0, 17) + '...'
          : process.env[varName];

      setVars.push({ name: varName, value });
    }
  }

  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:');
    missingVars.forEach(v => {
      console.log(`  - ${v.name}: ${v.description}`);
    });
  } else {
    console.log('✅ All required environment variables are set');
  }

  console.log('Current environment variables:');
  setVars.forEach(v => {
    console.log(`  - ${v.name}: ${v.value}`);
  });

  // Check if GCP key file exists
  if (process.env.GCP_KEY_FILE) {
    const keyFilePath = path.resolve(process.env.GCP_KEY_FILE);
    if (fs.existsSync(keyFilePath)) {
      console.log(`✅ GCP key file found at: ${keyFilePath}`);
    } else {
      console.log(`❌ GCP key file not found at: ${keyFilePath}`);
    }
  }

  console.log('');
}

/**
 * Verify database connectivity
 */
async function verifyDatabaseConnectivity() {
  console.log('Checking database connectivity...');

  // Create a new pool
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
    // Short timeout for connection test
    connectionTimeoutMillis: 5000
  });

  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Database connectivity successful: ${result.rows[0].now}`);

    // Check for required tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    const requiredTables = ['datasets', 'dataset_columns', 'dataset_indices', 'index_columns', 'dataset_processing_jobs'];
    const existingTables = tablesResult.rows.map(r => r.table_name);

    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.log(`❌ Missing database tables: ${missingTables.join(', ')}`);
      console.log('   Run migrations to create these tables: npm run migrate');
    } else {
      console.log('✅ All required database tables exist');
    }
  } catch (error) {
    console.log(`❌ Database connectivity failed: ${error.message}`);
    console.log('   Check your database credentials and make sure PostgreSQL is running');
  } finally {
    await pool.end();
  }

  console.log('');
}

/**
 * Verify Google Cloud Storage connectivity
 */
async function verifyGCSConnectivity() {
  console.log('Checking Google Cloud Storage connectivity...');

  if (!process.env.GCP_PROJECT_ID || !process.env.GCP_KEY_FILE || !process.env.GCS_BUCKET_NAME) {
    console.log('❌ Cannot check GCS connectivity: Missing required environment variables');
    return;
  }

  try {
    // Initialize storage client
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE
    });

    // Check if bucket exists
    const [bucketExists] = await storage.bucket(process.env.GCS_BUCKET_NAME).exists();

    if (bucketExists) {
      console.log(`✅ GCS bucket '${process.env.GCS_BUCKET_NAME}' exists and is accessible`);
    } else {
      console.log(`❌ GCS bucket '${process.env.GCS_BUCKET_NAME}' does not exist`);
      console.log('   You may need to create the bucket or check your permissions');
    }
  } catch (error) {
    console.log(`❌ GCS connectivity failed: ${error.message}`);
    console.log('   Check your Google Cloud credentials and permissions');
  }

  console.log('');
}

/**
 * Verify BigQuery connectivity
 */
async function verifyBigQueryConnectivity() {
  console.log('Checking BigQuery connectivity...');

  if (!process.env.GCP_PROJECT_ID || !process.env.GCP_KEY_FILE) {
    console.log('❌ Cannot check BigQuery connectivity: Missing required environment variables');
    return;
  }

  try {
    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_KEY_FILE
    });

    // Test query
    const [rows] = await bigquery.query({
      query: 'SELECT 1 as test',
      useLegacySql: false
    });

    if (rows && rows.length > 0) {
      console.log('✅ BigQuery connectivity successful');
    } else {
      console.log('❌ BigQuery connectivity failed: No results returned');
    }
  } catch (error) {
    console.log(`❌ BigQuery connectivity failed: ${error.message}`);
    console.log('   Check your Google Cloud credentials and make sure the BigQuery API is enabled');
  }

  console.log('');
}

/**
 * Verify OpenAI API connectivity
 */
async function verifyOpenAIConnectivity() {
  console.log('Checking OpenAI API connectivity...');

  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ Cannot check OpenAI connectivity: Missing API key');
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Minimal API call
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 5
    });

    if (response && response.choices && response.choices.length > 0) {
      console.log('✅ OpenAI API connectivity successful');
    } else {
      console.log('❌ OpenAI API connectivity failed: Invalid response');
    }
  } catch (error) {
    console.log(`❌ OpenAI API connectivity failed: ${error.message}`);
    console.log('   Check your API key and quota');
  }

  console.log('');
}

// Run the verification if this script is executed directly
if (require.main === module) {
  verifySetup().catch(err => {
    console.error('Verification failed with error:', err);
    process.exit(1);
  });
}

module.exports = { verifySetup };