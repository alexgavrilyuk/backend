This README is in backend/core

# Core Folder

The `core` folder contains fundamental components that are shared across the entire application. These components provide essential infrastructure, utilities, and middleware that support the application's modules.

## Overview

The core components are organized into three main categories:
1. **Configuration** - Database and system settings
2. **Middleware** - Request/response handling and security
3. **Utilities** - Helper functions and validation tools

## Folder Structure

```
/core
  /config/
    database.js
    index.js
  /middleware/
    errorHandler.js
    index.js
    rateLimit.js
    requestLogger.js
    security.js
  /utils/
    index.js
    pagination.js
    setupVerify.js
    verifyFirebaseSetup.js
```

## Config Folder

The configuration folder centralizes application settings, particularly for database connections.

### database.js

**Purpose**: Establishes and exports the database connection used throughout the application.

**Functionality**:
- Creates a Sequelize instance configured for PostgreSQL
- Uses environment variables for connection details
- Provides a connection pool for performance
- Includes a `testConnection()` function to verify connectivity

**Usage**:
```javascript
const { sequelize, testConnection } = require('../core/config').database;

// Test database connectivity
async function checkDatabase() {
  try {
    await testConnection();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}
```

### index.js

**Purpose**: Centralizes and exports all configuration components.

**Usage**:
```javascript
const { database } = require('../core/config');
```

## Middleware Folder

Contains Express middleware used across multiple routes and modules.

### errorHandler.js

**Purpose**: Provides centralized error handling and standardized error responses.

**Functionality**:
- Defines custom error types:
  - `ValidationError` (400): For input validation failures
  - `AuthenticationError` (401): For authentication issues
  - `ForbiddenError` (403): For authorization failures
  - `NotFoundError` (404): For resources not found
- Provides an `asyncHandler` wrapper to catch errors in async route handlers
- Implements a central error handler middleware for consistent error responses

**Usage**:
```javascript
const {
  ValidationError,
  asyncHandler,
  errorHandler
} = require('../core/middleware/errorHandler');

// Using custom error types
app.get('/resource/:id', (req, res) => {
  if (!req.params.id) {
    throw new ValidationError('ID is required');
  }
  // ...
});

// Using asyncHandler
app.get('/async-route', asyncHandler(async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
}));

// Apply global error handler (at end of middleware chain)
app.use(errorHandler);
```

### rateLimit.js

**Purpose**: Implements rate limiting to prevent API abuse.

**Functionality**:
- Creates two rate limiters:
  - `apiLimiter`: General API rate limiting (100 requests per 15 minutes)
  - `uploadLimiter`: More restrictive limits for file uploads (10 requests per 15 minutes)
- Configures standardized response formats for rate limit errors

**Usage**:
```javascript
const { apiLimiter, uploadLimiter } = require('../core/middleware/rateLimit');

// Apply to all API routes
app.use('/api', apiLimiter);

// Apply to specific resource-intensive routes
app.use('/api/upload', uploadLimiter);
```

### requestLogger.js

**Purpose**: Logs HTTP requests and responses for debugging and monitoring.

**Functionality**:
- Records detailed information about each request:
  - Timestamp
  - HTTP method
  - URL path
  - Response status code
  - Response time (duration)
  - User ID (if authenticated)
- Attaches to the response's 'finish' event for accurate timing

**Usage**:
```javascript
const requestLoggerMiddleware = require('../core/middleware/requestLogger');

// Apply to all routes
app.use(requestLoggerMiddleware);
```

### security.js

**Purpose**: Implements security measures to protect the application.

**Functionality**:
- Configures security headers using Helmet
- Prevents XSS attacks
- Prevents HTTP parameter pollution
- Sanitizes user input
- Implements global rate limiting
- Configures CORS based on environment
- Provides file type validation

**Usage**:
```javascript
const { setupSecurity, validateFileType } = require('../core/middleware/security');

// Apply general security middleware
setupSecurity(app);

// Validate file uploads
app.post('/upload', validateFileType(['text/csv', 'application/vnd.ms-excel']),
  (req, res) => {
    // Handle file upload
  }
);
```

### index.js

**Purpose**: Centralizes and exports all middleware components for easy access.

**Usage**:
```javascript
const {
  errorHandler,
  ValidationError,
  requestLogger,
  apiLimiter
} = require('../core/middleware');
```

## Utils Folder

Contains utility functions and helpers used throughout the application.

### pagination.js

**Purpose**: Provides utilities for handling pagination in API responses.

**Functionality**:
- Parses pagination parameters from request queries
- Validates and normalizes pagination values
- Generates pagination metadata for responses
- Creates Sequelize options for pagination

**Usage**:
```javascript
const {
  parsePaginationParams,
  generatePaginationMetadata,
  getPaginationOptions
} = require('../core/utils/pagination');

app.get('/items', async (req, res) => {
  // Parse pagination params
  const paginationParams = parsePaginationParams(req.query);

  // Get data with pagination
  const { count, rows } = await Item.findAndCountAll({
    ...getPaginationOptions(paginationParams)
  });

  // Generate pagination metadata
  const pagination = generatePaginationMetadata(paginationParams, count);

  res.json({
    items: rows,
    pagination
  });
});
```

### setupVerify.js

**Purpose**: Verifies the server's setup and configuration.

**Functionality**:
- Checks required environment variables
- Tests database connectivity
- Verifies Google Cloud Storage access
- Checks BigQuery connectivity
- Tests OpenAI API connectivity
- Provides detailed diagnostics for issues

**Usage**:
```javascript
const { verifySetup } = require('../core/utils/setupVerify');

// Run verification during startup
async function checkServerSetup() {
  try {
    await verifySetup();
    console.log('Server setup verified successfully');
  } catch (error) {
    console.error('Server setup verification failed:', error);
    process.exit(1);
  }
}
```

### verifyFirebaseSetup.js

**Purpose**: Verifies Firebase configuration and connectivity.

**Functionality**:
- Checks Firebase environment variables
- Validates service account file
- Tests Firebase Admin SDK initialization
- Verifies Firebase Auth functionality
- Provides detailed diagnostics for issues

**Usage**:
```javascript
const { verifyFirebaseSetup } = require('../core/utils/verifyFirebaseSetup');

// Verify Firebase setup during initialization
verifyFirebaseSetup()
  .then(() => {
    console.log('Firebase setup verified successfully');
  })
  .catch(error => {
    console.error('Firebase setup verification failed:', error);
    process.exit(1);
  });
```

### index.js

**Purpose**: Centralizes and exports all utility functions.

**Usage**:
```javascript
const {
  pagination,
  setupVerify,
  verifyFirebaseSetup
} = require('../core/utils');
```

## Best Practices

- **Independence**: Core components should be module-independent and not rely on specific business logic
- **Reusability**: Components should be designed for reuse across multiple parts of the application
- **Configuration**: Use environment variables for configuration rather than hardcoded values
- **Documentation**: Keep inline documentation updated for all utility functions
- **Error Handling**: Ensure error messages are clear and include troubleshooting guidance
- **Security**: Regularly review security middleware for vulnerabilities
- **Testing**: Create unit tests for all core components to ensure reliability