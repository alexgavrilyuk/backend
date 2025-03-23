This README is in backend/tests

# Tests Folder

This folder contains the application's test suite, providing comprehensive test coverage for various components. The test suite uses Jest as the testing framework and follows a structured approach to ensure all critical parts of the application are properly tested.

## Overview

The tests are organized into a hierarchical structure that mirrors the application's organization, with dedicated subfolders for middleware, routes, and utilities. The folder also includes helper utilities and setup files to support the testing process.

## Folder Structure

```
/tests
  setup.js                  # Global test setup and configuration
  dbHandler.js              # Database connection and cleanup utilities
  helpers.js                # Test helper functions
  /middleware/              # Tests for middleware components
    auth.test.js            # Tests for authentication middleware
    errorHandler.test.js    # Tests for error handling middleware
  /routes/                  # Tests for API routes
    datasetRoutes.test.js   # Tests for dataset API endpoints
  /utils/                   # Tests for utility functions
    fileProcessing.test.js  # Tests for file processing utilities
```

## Files

### setup.js

**Purpose**: Configures the global test environment and sets up necessary mocks and environment variables.

**Functionality**:
- Sets `NODE_ENV` to 'test'
- Configures environment variables specifically for testing
- Establishes global beforeAll and afterAll hooks
- Sets up test timeouts

**Key Features**:
- Environment isolation for tests
- Standardized test configuration
- Global hooks for setup and teardown

**Usage**:
```javascript
// Jest automatically loads this file based on configuration in jest.config.js
// setupFilesAfterEnv: ['./tests/setup.js']

// In setup.js:
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'test_db';
// Other test-specific environment variables...

beforeAll(async () => {
  // Global setup before all tests run
});

afterAll(async () => {
  // Global cleanup after all tests finish
});

// Increase timeout for all tests
jest.setTimeout(30000);
```

### dbHandler.js

**Purpose**: Provides utilities for managing the test database connection and state.

**Functionality**:
- Connects to the test database
- Clears database tables between tests
- Disconnects from the database when tests complete
- Provides isolated database state for tests

**Key Functions**:
- `connectDatabase()`: Establishes a connection to the test database
- `clearDatabase()`: Truncates all tables to ensure a clean state
- `disconnectDatabase()`: Closes the database connection

**Usage**:
```javascript
const { connectDatabase, clearDatabase, disconnectDatabase } = require('../dbHandler');

// In test file
beforeAll(async () => {
  await connectDatabase();
});

afterEach(async () => {
  await clearDatabase(); // Reset DB state between tests
});

afterAll(async () => {
  await disconnectDatabase();
});

// Tests can now run with isolated database state
```

### helpers.js

**Purpose**: Provides helper functions and test data creation utilities to support tests.

**Functionality**:
- Creates test users and authentication tokens
- Generates test datasets and schema data
- Provides cleanup utilities for test data
- Simplifies repetitive test setup operations

**Key Functions**:
- `createTestUserAndToken()`: Creates a test user and generates a JWT token
- `createTestDataset()`: Creates a test dataset with mock data
- `cleanupTestData()`: Removes test data after tests complete

**Usage**:
```javascript
const { createTestUserAndToken, createTestDataset } = require('../helpers');

describe('Dataset API', () => {
  let token, userId, testDataset;

  beforeAll(async () => {
    // Create a test user and authentication token
    const testUser = await createTestUserAndToken();
    token = testUser.token;
    userId = testUser.user.id;

    // Create a test dataset for this user
    testDataset = await createTestDataset(userId);
  });

  test('should get dataset by ID', async () => {
    // Use the test data in your tests
    // ...
  });
});
```

## Middleware Tests

### auth.test.js

**Purpose**: Tests the authentication middleware functionality.

**Test Coverage**:
- Valid token authentication
- Missing token handling
- Invalid token format handling
- Expired token handling
- User information extraction from tokens

**Key Test Cases**:
- Should call next() for valid tokens
- Should return 401 if no token is provided
- Should return 401 if token format is invalid
- Should return 401 if token is expired

**Usage**:
```javascript
// Example test from auth.test.js
test('should call next() for valid token', () => {
  const userId = 'test-user-id';
  const email = 'test@example.com';

  const token = jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  req.headers.authorization = `Bearer ${token}`;

  authMiddleware(req, res, next);

  expect(next).toHaveBeenCalled();
  expect(req.user).toBeDefined();
  expect(req.user.id).toBe(userId);
  expect(req.user.email).toBe(email);
});
```

### errorHandler.test.js

**Purpose**: Tests the error handling middleware functionality.

**Test Coverage**:
- Custom error types (ValidationError, AuthenticationError, etc.)
- AsyncHandler error catching
- Error response formatting
- HTTP status code mapping

**Key Test Cases**:
- Custom error types should have correct status codes
- AsyncHandler should handle successful async functions
- AsyncHandler should catch errors in async functions
- Error handler should format errors with appropriate status codes

**Usage**:
```javascript
// Example test from errorHandler.test.js
test('ValidationError should have correct statusCode', () => {
  const error = new ValidationError('Invalid input');
  expect(error.statusCode).toBe(400);
  expect(error.message).toBe('Invalid input');
  expect(error.name).toBe('ValidationError');
});

test('should handle errors in async functions', async () => {
  const error = new Error('Async error');
  const mockHandler = jest.fn().mockRejectedValue(error);
  const wrappedHandler = asyncHandler(mockHandler);

  await wrappedHandler(req, res, next);

  expect(mockHandler).toHaveBeenCalledWith(req, res, next);
  expect(next).toHaveBeenCalledWith(error);
});
```

## Route Tests

### datasetRoutes.test.js

**Purpose**: Tests the dataset API endpoints functionality.

**Test Coverage**:
- GET /datasets - List datasets
- GET /datasets/:datasetId - Get single dataset
- GET /datasets/:datasetId/schema - Get dataset schema
- PATCH /datasets/:datasetId - Update dataset
- DELETE /datasets/:datasetId - Delete dataset
- POST /datasets/upload - Upload dataset

**Key Test Cases**:
- Should return user datasets
- Should return a single dataset by ID
- Should return 404 for non-existent datasets
- Should return dataset schema
- Should update dataset details

**Usage**:
```javascript
// Example test from datasetRoutes.test.js
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
```

## Utility Tests

### fileProcessing.test.js

**Purpose**: Tests the file processing utilities.

**Test Coverage**:
- Column type detection
- File validation
- CSV parsing
- Excel file handling

**Key Test Cases**:
- Should detect integer columns
- Should detect float columns
- Should detect date columns
- Should detect boolean columns
- Should validate CSV files
- Should validate Excel files
- Should reject files that are too large
- Should reject invalid file types

**Usage**:
```javascript
// Example test from fileProcessing.test.js
test('should detect integer columns', () => {
  const samples = ['1', '2', '3', '-5', '0'];
  expect(detectColumnType(samples)).toBe('integer');
});

test('should validate CSV files', () => {
  const file = {
    name: 'test.csv',
    mimetype: 'text/csv',
    size: 1024 * 10 // 10 KB
  };

  const result = validateFile(file);
  expect(result.valid).toBe(true);
});
```

## Testing Approach

The testing strategy follows these principles:

1. **Isolation**: Tests run in isolation with their own clean database state
2. **Mocking**: External dependencies are mocked to focus on the code being tested
3. **Coverage**: Tests aim to cover critical paths and edge cases
4. **Integration**: Both unit and integration tests are included to verify individual components and their interactions

## Test Execution

Tests can be run using the following npm scripts:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test file
npm test -- tests/middleware/auth.test.js
```

## Adding New Tests

When adding new tests, follow these guidelines:

1. **Structure**: Place tests in the appropriate subfolder that matches the application structure
2. **Naming**: Use the `.test.js` suffix for test files
3. **Isolation**: Ensure tests clean up after themselves
4. **Mocking**: Use Jest's mocking capabilities for external dependencies
5. **Coverage**: Aim for comprehensive coverage of functionality and edge cases

## Best Practices

1. **Test Independence**: Each test should run independently without relying on other tests
2. **Clear Assertions**: Use descriptive assertions that clarify what's being tested
3. **Setup and Teardown**: Use beforeEach/afterEach for test setup and cleanup
4. **Test Data**: Use helper functions to create consistent test data
5. **Error Testing**: Include tests for error conditions and edge cases
6. **Mocking**: Mock external dependencies but test integration points
7. **Readability**: Keep tests simple and focused on what they're validating