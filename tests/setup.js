// tests/setup.js
// Set up test environment
process.env.NODE_ENV = 'test';

// Setup environment variables for testing
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'postgres';
process.env.DB_PASS = 'postgres';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.JWT_SECRET = 'test_secret';
process.env.GCS_BUCKET_NAME = 'test-bucket';
process.env.GCP_PROJECT_ID = 'test-project';
process.env.OPENAI_API_KEY = 'test-api-key';

// Global beforeAll and afterAll
beforeAll(async () => {
  // Any setup before all tests run
  console.log('Starting tests...');
});

afterAll(async () => {
  // Any cleanup after all tests finish
  console.log('Tests completed');
});

// Increase timeout for all tests
jest.setTimeout(30000);