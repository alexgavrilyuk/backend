// migrations/add-context-fields-to-dataset.js

const { sequelize } = require('../core/config').database;

/**
 * Migration script to add dataset context fields
 */
async function addContextFieldsToDataset() {
  const transaction = await sequelize.transaction();

  try {
    console.log('Starting migration: Adding context fields to datasets table');

    // Check if columns already exist
    const checkColumnQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'datasets'
      AND column_name IN ('context', 'purpose', 'source', 'notes');
    `;

    const [existingColumns] = await sequelize.query(checkColumnQuery, { transaction });
    const existingColumnNames = existingColumns.map(col => col.column_name);

    // Add 'context' column if it doesn't exist
    if (!existingColumnNames.includes('context')) {
      console.log('Adding context column');
      await sequelize.query(`
        ALTER TABLE datasets
        ADD COLUMN context TEXT;
      `, { transaction });
    }

    // Add 'purpose' column if it doesn't exist
    if (!existingColumnNames.includes('purpose')) {
      console.log('Adding purpose column');
      await sequelize.query(`
        ALTER TABLE datasets
        ADD COLUMN purpose TEXT;
      `, { transaction });
    }

    // Add 'source' column if it doesn't exist
    if (!existingColumnNames.includes('source')) {
      console.log('Adding source column');
      await sequelize.query(`
        ALTER TABLE datasets
        ADD COLUMN source VARCHAR(512);
      `, { transaction });
    }

    // Add 'notes' column if it doesn't exist
    if (!existingColumnNames.includes('notes')) {
      console.log('Adding notes column');
      await sequelize.query(`
        ALTER TABLE datasets
        ADD COLUMN notes TEXT;
      `, { transaction });
    }

    await transaction.commit();
    console.log('Migration completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  addContextFieldsToDataset()
    .then(() => {
      console.log('Migration complete, exiting...');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = addContextFieldsToDataset;