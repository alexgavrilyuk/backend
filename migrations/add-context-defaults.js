// migrations/add-context-defaults.js

const { sequelize } = require('../core/config').database;

/**
 * Migration script to add default values to dataset context fields
 */
async function addContextDefaults() {
  const transaction = await sequelize.transaction();

  try {
    console.log('Starting migration: Adding default values to context fields');

    // Add default values to context fields
    // This depends on the database type - PostgreSQL uses different syntax than MySQL
    // For PostgreSQL:
    await sequelize.query(`
      ALTER TABLE datasets
      ALTER COLUMN context SET DEFAULT '',
      ALTER COLUMN purpose SET DEFAULT '',
      ALTER COLUMN source SET DEFAULT '',
      ALTER COLUMN notes SET DEFAULT '';
    `, { transaction });

    // Also ensure existing NULL values are converted to empty strings
    await sequelize.query(`
      UPDATE datasets
      SET context = COALESCE(context, ''),
          purpose = COALESCE(purpose, ''),
          source = COALESCE(source, ''),
          notes = COALESCE(notes, '')
      WHERE context IS NULL OR purpose IS NULL OR source IS NULL OR notes IS NULL;
    `, { transaction });

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
  addContextDefaults()
    .then(() => {
      console.log('Migration complete, exiting...');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = addContextDefaults;