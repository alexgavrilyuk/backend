// tests/routes/datasetRoutes.test.js

const request = require('supertest');
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sinon = require('sinon');

// Import the necessary modules
const datasetRoutes = require('../../routes/datasetRoutes');
const { uploadFile } = require('../../services/storage');
const { addProcessingJob } = require('../../services/jobQueue');
const { createTestUserAndToken, createTestDataset, cleanupTestData } = require('../helpers');
const { connectDatabase, clearDatabase, disconnectDatabase } = require('../dbHandler');

// Mock services
jest.mock('../../services/storage');
jest.mock('../../services/jobQueue');

describe('Dataset API Integration Tests', () => {
  let app;
  let authToken;
  let userId;
  let testDatasetId;

  beforeAll(async () => {
    await connectDatabase();

    // Create a test user and token
    const testUser = await createTestUserAndToken();
    authToken = testUser.token;
    userId = testUser.user.id;

    // Set up a mock Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Mock Express-fileupload middleware
    app.use((req, res, next) => {
      req.files = req.files || {};
      next();
    });

    // Mock auth middleware to set req.user
    app.use((req, res, next) => {
      req.user = {
        id: userId,
        email: 'test@example.com'
      };
      next();
    });

    // Apply dataset routes
    app.use('/', datasetRoutes);
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(testDatasetId);
    await clearDatabase();
    await disconnectDatabase();
  });

  beforeEach(() => {
    // Reset mocks before each test
    uploadFile.mockReset();
    addProcessingJob.mockReset();

    // Setup default mock implementations
    uploadFile.mockImplementation(() => Promise.resolve('gs://test-bucket/test-file'));
    addProcessingJob.mockImplementation(() => Promise.resolve({ id: 'job-123' }));
  });

  describe('GET /datasets', () => {
    test('should return user datasets', async () => {
      // Create a test dataset
      const dataset = await createTestDataset(userId);
      testDatasetId = dataset.id;

      const response = await request(app)
        .get('/')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.datasets).toBeInstanceOf(Array);
      expect(response.body.datasets.length).toBeGreaterThan(0);

      // Check if the test dataset is in the response
      const foundDataset = response.body.datasets.find(d => d.id === dataset.id);
      expect(foundDataset).toBeDefined();
      expect(foundDataset.name).toBe(dataset.name);
    });
  });

  describe('GET /datasets/:datasetId', () => {
    test('should return a single dataset', async () => {
      // Create a test dataset if needed
      if (!testDatasetId) {
        const dataset = await createTestDataset(userId);
        testDatasetId = dataset.id;
      }

      const response = await request(app)
        .get(`/${testDatasetId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dataset).toBeDefined();
      expect(response.body.dataset.id).toBe(testDatasetId);
    });

    test('should return 404 for non-existent dataset', async () => {
      const nonExistentId = uuidv4();

      const response = await request(app)
        .get(`/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /datasets/:datasetId/schema', () => {
    test('should return dataset schema', async () => {
      // Create a test dataset if needed
      if (!testDatasetId) {
        const dataset = await createTestDataset(userId);
        testDatasetId = dataset.id;
      }

      const response = await request(app)
        .get(`/${testDatasetId}/schema`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.schema).toBeDefined();
      expect(response.body.schema.columns).toBeInstanceOf(Array);
      expect(response.body.schema.columns.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /datasets/:datasetId', () => {
    test('should update dataset details', async () => {
      // Create a test dataset if needed
      if (!testDatasetId) {
        const dataset = await createTestDataset(userId);
        testDatasetId = dataset.id;
      }

      const updateData = {
        name: 'Updated Test Dataset',
        description: 'This dataset has been updated for testing'
      };

      const response = await request(app)
        .patch(`/${testDatasetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.dataset).toBeDefined();
      expect(response.body.dataset.name).toBe(updateData.name);
      expect(response.body.dataset.description).toBe(updateData.description);
    });
  });

  // Note: We're not testing actual file uploads here as they would require
  // more complex mocking of the file upload middleware. Those should be
  // covered in separate, more focused tests.
});