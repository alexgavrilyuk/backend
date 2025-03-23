// migrations/add-reports-table.js

const { sequelize } = require('../core/config').database;

/**
 * Migration to add the reports table for the enhanced reporting system
 */
async function addReportsTable() {
  try {
    console.log('Running migration: Add Reports Table');

    // Check if the reports table already exists
    const tableExists = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'reports'
      );`,
      { type: sequelize.QueryTypes.SELECT }
    );

    if (tableExists[0].exists) {
      console.log('Reports table already exists, skipping creation');
      return;
    }

    // Create reports table
    await sequelize.query(`
      CREATE TABLE reports (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        generated_sql TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'processing',
        report_type VARCHAR(50) NOT NULL DEFAULT 'standard',
        visualizations TEXT,
        insights TEXT,
        narrative TEXT,
        report_data TEXT,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes
    await sequelize.query(`
      CREATE INDEX idx_reports_user ON reports(user_id);
      CREATE INDEX idx_reports_dataset ON reports(dataset_id);
      CREATE INDEX idx_reports_status ON reports(status);
    `);

    console.log('Reports table and indexes created successfully');

  } catch (error) {
    console.error('Error adding reports table:', error);
    throw error;
  }
}

// If this script is run directly
if (require.main === module) {
  addReportsTable()
    .then(() => {
      console.log('Reports table migration completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Reports table migration failed:', err);
      process.exit(1);
    });
}

module.exports = addReportsTable;