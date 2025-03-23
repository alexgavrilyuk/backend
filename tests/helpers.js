// tests/helper.js

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models');

/**
 * Create a test user and return a JWT token
 * @returns {Object} Object containing user data and token
 */
async function createTestUserAndToken() {
  const userId = uuidv4();
  const userEmail = `test-${userId}@example.com`;

  // In a real application, you would create a user in the database
  // For tests, we just create a mock token

  const token = jwt.sign(
    {
      userId,
      email: userEmail
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '1h'
    }
  );

  return {
    user: {
      id: userId,
      email: userEmail
    },
    token
  };
}

/**
 * Create a test dataset in the database
 * @param {string} userId - User ID to associate with the dataset
 * @returns {Object} Created dataset
 */
async function createTestDataset(userId) {
  const datasetId = uuidv4();

  const dataset = await db.Dataset.create({
    id: datasetId,
    userId,
    name: `Test Dataset ${datasetId.substring(0, 8)}`,
    description: 'A test dataset created for testing',
    dataType: 'csv',
    filePath: `users/${userId}/datasets/${datasetId}/test.csv`,
    status: 'available',
    rowCount: 100,
    columnCount: 5,
    fileSizeBytes: 1024 * 10, // 10 KB
    previewAvailable: true
  });

  // Create some test columns
  const columns = [
    { name: 'id', type: 'integer', nullable: false, primaryKey: true, position: 0 },
    { name: 'name', type: 'string', nullable: false, primaryKey: false, position: 1 },
    { name: 'email', type: 'string', nullable: true, primaryKey: false, position: 2 },
    { name: 'age', type: 'integer', nullable: true, primaryKey: false, position: 3 },
    { name: 'created_at', type: 'date', nullable: false, primaryKey: false, position: 4 }
  ];

  // Create the columns in the database
  for (const column of columns) {
    await db.DatasetColumn.create({
      id: uuidv4(),
      datasetId,
      name: column.name,
      type: column.type,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
      description: `Test column ${column.name}`,
      position: column.position
    });
  }

  return dataset;
}

/**
 * Clean up test data
 * @param {string} datasetId - Dataset ID to clean up
 */
async function cleanupTestData(datasetId) {
  if (datasetId) {
    await db.Dataset.destroy({
      where: { id: datasetId },
      force: true // Hard delete
    });
  }
}

module.exports = {
  createTestUserAndToken,
  createTestDataset,
  cleanupTestData
};