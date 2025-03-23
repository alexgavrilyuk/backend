// fixDatasetContext.js

require('dotenv').config();
const { Pool } = require('pg');

/**
 * Script to fix dataset context fields by ensuring they're never NULL
 */
async function fixDatasetContext() {
  // Create a direct database connection
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
  });

  try {
    console.log('Starting to fix dataset context fields...');

    // Convert NULL values to empty strings for all context fields
    const result = await pool.query(`
      UPDATE datasets
      SET context = COALESCE(context, ''),
          purpose = COALESCE(purpose, ''),
          source = COALESCE(source, ''),
          notes = COALESCE(notes, '')
      WHERE context IS NULL OR purpose IS NULL OR source IS NULL OR notes IS NULL;
    `);

    console.log(`Updated ${result.rowCount} dataset(s)`);

    // Verify a specific dataset if ID is provided
    const datasetId = process.argv[2];
    if (datasetId) {
      console.log(`Verifying dataset ${datasetId}...`);

      const { rows } = await pool.query(`
        SELECT id, context, purpose, source, notes
        FROM datasets
        WHERE id = $1
      `, [datasetId]);

      if (rows.length > 0) {
        console.log('Dataset values:');
        console.log(JSON.stringify(rows[0], null, 2));
      } else {
        console.log(`Dataset ${datasetId} not found`);
      }
    }

    console.log('Fix completed successfully');
  } catch (error) {
    console.error('Error fixing dataset context:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixDatasetContext()
    .then(() => {
      console.log('Script complete, exiting...');
      process.exit(0);
    })
    .catch(err => {
      console.error('Script failed:', err);
      process.exit(1);
    });
}

module.exports = fixDatasetContext;