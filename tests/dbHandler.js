// tests/dbHandler.js
const { sequelize } = require('../core/config');

/**
 * Connect to the test database
 */
async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Test database connection established');
  } catch (error) {
    console.error('Unable to connect to the test database:', error);
    process.exit(1);
  }
}

/**
 * Clear all tables in the test database
 */
async function clearDatabase() {
  try {
    // Disable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });

    // Truncate all tables
    await sequelize.sync({ force: true });

    // Re-enable foreign key checks
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });

    console.log('Test database cleared');
  } catch (error) {
    console.error('Error clearing test database:', error);
  }
}

/**
 * Disconnect from the test database
 */
async function disconnectDatabase() {
  try {
    await sequelize.close();
    console.log('Test database connection closed');
  } catch (error) {
    console.error('Error disconnecting from test database:', error);
  }
}

module.exports = {
  connectDatabase,
  clearDatabase,
  disconnectDatabase
};