This README is in backend/services

# Services Folder

The services folder contains application-wide utility services that provide core functionality used across multiple modules. These services offer centralized implementation of common features like caching, background job processing, and logging.

## Overview

Unlike modules that are focused on specific domain functionality, the services in this folder are infrastructure-level components that support the overall application architecture. They provide standardized interfaces for cross-cutting concerns.

## Files

### cacheService.js

**Purpose**: Provides in-memory caching capabilities to improve performance by reducing database queries and API calls.

**Functionality**:
- Implements a flexible key-value cache store using node-cache
- Provides methods to get, set, and delete cached data
- Supports configurable TTL (Time-To-Live) for cached items
- Includes utility functions for generating standardized cache keys
- Offers a convenient getOrSet pattern for fetch-and-cache operations

**Key Features**:
- Default 5-minute TTL for cache entries
- Automatic cache cleanup (every 60 seconds)
- Support for custom expiration times
- Helper functions for dataset-specific caching

**Usage**:
```javascript
const {
  get,
  set,
  del,
  flush,
  generateDatasetKey,
  getOrSet
} = require('../services/cacheService');

// Store data in cache with default TTL
set('user:123:datasets', userDatasets);

// Get data from cache
const cachedDatasets = get('user:123:datasets');

// Generate a standardized key for a dataset
const schemaKey = generateDatasetKey(userId, datasetId, 'schema');

// Get cached data or fetch it if not in cache
const data = await getOrSet(
  'expensive-operation-key',
  async () => {
    // This function only runs if data isn't in cache
    return await performExpensiveOperation();
  },
  300 // Custom TTL of 300 seconds
);

// Delete a specific cache entry
del('user:123:datasets');

// Clear entire cache
flush();
```

### jobQueue.js

**Purpose**: Manages background processing of long-running tasks using a queue system.

**Functionality**:
- Creates and manages job queues using Bull and Redis
- Handles dataset processing jobs asynchronously
- Provides job status tracking and updates
- Implements retry logic for failed jobs
- Processes files, extracts schema, and updates database

**Key Features**:
- Separation of job creation from processing
- Progress tracking for long-running jobs
- Exponential backoff for failed job retries
- Automatic cleanup of completed jobs
- Detailed job failure logging

**Usage**:
```javascript
const {
  dataProcessingQueue,
  addProcessingJob
} = require('../services/jobQueue');

// Add a new job to the queue
const job = await addProcessingJob({
  datasetId: 'abc123',
  userId: 'user456',
  filePath: 'path/to/file.csv',
  dataType: 'csv'
});

// The job is processed in the background, and progress can be tracked
console.log(`Job ${job.id} added to queue`);

// Additional listeners can be added to the queue
dataProcessingQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});
```

**Queue Processing Flow**:
1. Job is added to the queue with metadata
2. Processing worker picks up the job
3. File is downloaded from storage
4. File is processed based on type (CSV/Excel)
5. Schema information is extracted
6. Database is updated with column information
7. BigQuery table is created for querying
8. Dataset status is updated to 'available'
9. Job is marked as complete

### loggingService.js

**Purpose**: Provides a centralized logging system for application events, errors, and metrics.

**Functionality**:
- Configures Winston logger with appropriate log levels and formats
- Creates log files organized by severity level
- Formats logs as JSON for easier parsing and analysis
- Supports different log levels based on environment
- Includes contextual information in log entries

**Key Features**:
- Multiple log transports (console, file)
- Log rotation based on file size
- Separate files for error logs
- Structured logging with timestamps and metadata
- Context-enriched logging for HTTP requests and operations

**Usage**:
```javascript
const {
  logger,
  logHttpRequest,
  logDatasetOperation,
  logError
} = require('../services/loggingService');

// Standard logging at different levels
logger.error('Critical error occurred', { context: 'startup' });
logger.warn('Configuration issue detected', { setting: 'timeout' });
logger.info('Application started', { port: 3000 });
logger.debug('Processing request', { requestId: 'req123' });

// Log HTTP request with context
logHttpRequest(req, res, {
  userId: req.user.id,
  datasetId: req.params.datasetId,
  duration: 235 // milliseconds
});

// Log dataset operations
logDatasetOperation('create', userId, datasetId, {
  rows: 1500,
  columns: 10
});

// Log errors with context
try {
  // Operation that might fail
} catch (error) {
  logError(error, {
    userId,
    datasetId,
    operation: 'query'
  });
}
```

## Integration with Application

These services are designed to be used throughout the application:

1. **Cache Service**:
   - Used in controllers to cache frequently accessed data
   - Reduces database load for repetitive queries
   - Improves response times for common operations

2. **Job Queue**:
   - Used for processing uploaded files asynchronously
   - Prevents long-running tasks from blocking the request/response cycle
   - Provides resilience through retries and monitoring

3. **Logging Service**:
   - Used by middleware to log HTTP requests
   - Used by error handlers to log exceptions
   - Used by controllers to log business operations
   - Enables monitoring and debugging across the application

## Configuration

These services use environment variables for configuration:

### Cache Service
- No direct environment variables, but can be configured programmatically

### Job Queue
- `REDIS_HOST`: Redis host for queue backend (default: 'localhost')
- `REDIS_PORT`: Redis port (default: 6379)
- `REDIS_PASSWORD`: Redis password (optional)

### Logging Service
- `LOG_DIR`: Directory for log files (default: 'logs')
- `NODE_ENV`: Environment setting, determines default log levels

## Best Practices

1. **Cache Management**:
   - Use appropriate TTL values based on data volatility
   - Clear cache when data is updated
   - Use cache for read-heavy operations, not for frequently changing data

2. **Background Jobs**:
   - Keep job payloads small and serializable
   - Implement proper error handling in job processors
   - Monitor queue sizes and processing times
   - Use job events to trigger follow-up actions

3. **Logging**:
   - Log actionable information, not just data dumps
   - Include contextual information in log entries
   - Use appropriate log levels
   - Rotate logs to prevent disk space issues
   - Implement log aggregation for production environments