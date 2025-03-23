// migrations/runMigrations.js

const { sequelize } = require('../core/config').database;
const db = require('../modules/datasets/models');

// Helper function to safely require migration files
function safeRequire(path) {
  try {
    return require(path);
  } catch (error) {
    console.warn(`Migration file ${path} not found, skipping this migration.`);
    return async () => {
      console.log(`Migration ${path} skipped.`);
    };
  }
}

// Safely require all migrations
const addContextFieldsToDataset = safeRequire('./add-context-fields-to-dataset');
const addReportsTable = safeRequire('./add-reports-table');
const addReportTables = safeRequire('./add-report-tables');

async function runMigrations() {
  try {
    console.log('Starting database migrations...');

    // Sync all models with the database
    // In production, you might want to use Sequelize migrations instead
    // This approach works well for development
    await sequelize.sync({ alter: true });

    // Run specific migrations
    await addContextFieldsToDataset();
    await addReportsTable();

    // Add new comprehensive report tables migration
    await addReportTables();

    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Error during migrations:', error);
    process.exit(1);
  }
}

// If this script is run directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed, exiting...');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration script failed:', err);
      process.exit(1);
    });
}

module.exports = runMigrations;