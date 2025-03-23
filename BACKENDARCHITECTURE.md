# Backend Architecture Documentation

## Table of Contents
- [System Overview](#system-overview)
- [Core Architecture](#core-architecture)
- [Directory Structure](#directory-structure)
- [Module System](#module-system)
- [Core Components](#core-components)
- [Modules](#modules)
- [External Services Integration](#external-services-integration)
- [Authentication & Authorization](#authentication--authorization)
- [Data Flow](#data-flow)
- [Error Handling](#error-handling)
- [Testing Strategy](#testing-strategy)
- [Deployment Strategy](#deployment-strategy)
- [Monitoring & Logging](#monitoring--logging)
- [Performance Considerations](#performance-considerations)
- [Security Measures](#security-measures)
- [Future Development](#future-development)

## System Overview

The backend system is built as a highly modular, feature-focused Node.js application using Express. It's designed to handle data upload, processing, storage, and retrieval with particular emphasis on data analysis through BigQuery integration and natural language querying capabilities.

### Key Technologies
- **Runtime**: Node.js
- **Web Framework**: Express.js
- **Database**: PostgreSQL (for metadata) + Google BigQuery (for data storage/querying)
- **File Storage**: Google Cloud Storage
- **Authentication**: Firebase Authentication
- **NLP/AI**: OpenAI API integration for natural language to SQL conversion
- **Queue System**: Bull with Redis (for background processing)
- **ORM**: Sequelize

### Primary Functions
1. User authentication via Firebase
2. File upload and processing (CSV/Excel)
3. Dataset metadata management
4. Schema extraction and storage
5. BigQuery integration for high-performance data querying
6. Natural language to SQL conversion
7. AI-driven reporting with visualizations and insights
8. Secured API endpoints for frontend interaction

## Core Architecture

The application follows a fully modular architecture with clear separation of concerns. It's organized into independent modules, each responsible for a specific domain of functionality. The modules communicate through well-defined interfaces and are composed together in the app layer.

### Design Principles
- **Modularity**: Each feature is contained in its own module
- **Separation of Concerns**: Clear boundaries between different parts of the system
- **Single Responsibility**: Each module handles one specific domain of functionality
- **Dependency Injection**: Dependencies are explicitly injected rather than imported directly
- **Error Centralization**: Centralized error handling for consistent responses
- **Security First**: Authentication required for most endpoints, with strict validation

## Directory Structure

```
/backend
  /app/                        # Application composition
    index.js                   # Express app creation and configuration
    routes.js                  # Central route registry
    server.js                  # Server startup and error handling

  /core/                       # Shared core components
    /config/                   # Configuration
      database.js              # Database configuration
      index.js                 # Config exports
    /middleware/               # Shared middleware
      errorHandler.js          # Error handling middleware
      index.js                 # Middleware exports
      rateLimit.js             # API rate limiting
      requestLogger.js         # HTTP request logging
      security.js              # Security middleware
    /utils/                    # Shared utilities
      index.js                 # Utils exports
      pagination.js            # Pagination utilities
      setupVerify.js           # Server setup verification
      verifyFirebaseSetup.js   # Firebase configuration verification

  /migrations/                 # Database migration scripts
    runMigrations.js           # Migration execution

  /modules/                    # Feature modules
    /auth/                     # Authentication module
      index.js                 # Module entry point
      middleware.js            # Firebase auth middleware
      README.md                # Module documentation
    /bigquery/                 # BigQuery module
      connectivity.js          # Connection verification
      index.js                 # Module entry point
      README.md                # Module documentation
      service.js               # BigQuery operations
    /dataProcessing/           # Data processing utilities
      index.js                 # Module entry point
      queryPlanner.js          # Complex query planning
      aggregator.js            # Result aggregation
      dataAnalysis.js          # Statistical analysis
    /datasets/                 # Dataset management
      controller.js            # Business logic
      database.js              # Database connection
      index.js                 # Module entry point
      README.md                # Module documentation
      routes.js                # Route definitions
      /models/                 # Data models
        dataset.js             # Dataset model
        datasetColumn.js       # Column model
        datasetIndex.js        # Index model
        datasetProcessingJob.js # Processing job model
        index.js               # Models export
        indexColumn.js         # Index column model
      /services/               # Domain services
        fileProcessingService.js # File processing
    /fileProcessing/          # File processing utilities
      index.js                # Module entry point
      README.md               # Module documentation
      service.js              # Service entry point
      /services/              # Specific services
        csvProcessor.js       # CSV file processor
        excelProcessor.js     # Excel file processor
      /utils/                 # Utilities
        fileProcessing.js     # File processing utils
    /queries/                 # Query generation and execution
      controller.js           # Business logic
      index.js                # Module entry point
      routes.js               # Route definitions
      /services/              # Domain services
        nlpService.js         # Natural language processing
    /reports/                 # AI-driven reporting
      controller.js           # Business logic
      index.js                # Module entry point
      README.md               # Module documentation
      routes.js               # Route definitions
      /models/                # Data models
        reportModel.js        # Report model
      /services/              # Domain services
        reportGenerationService.js # Report generation
        visualizationService.js    # Visualization selection
        insightService.js          # Insight extraction
        narrativeService.js        # Narrative generation
      /utils/                 # Utilities
        reportUtils.js        # Report helpers
    /storage/                 # Cloud storage operations
      index.js                # Module entry point
      README.md               # Module documentation
      service.js              # Storage operations
    /uploads/                 # File upload processing
      controller.js           # Business logic
      index.js                # Module entry point
      README.md               # Module documentation
      routes.js               # Route definitions

  /services/                  # Global services
    cacheService.js           # Caching service
    jobQueue.js               # Job queue processing
    loggingService.js         # Logging service

  /tests/                     # Test suite
    dbHandler.js              # Test database handler
    helpers.js                # Test helpers
    setup.js                  # Test setup
    /middleware/              # Middleware tests
      auth.test.js            # Auth tests
      errorHandler.test.js    # Error handler tests
    /routes/                  # API route tests
      datasetRoutes.test.js   # Dataset routes tests
    /utils/                   # Utility tests
      fileProcessing.test.js  # File processing tests

  *.js                        # Various utility scripts
  index.js                    # Application entry point
  package.json                # Package configuration
  ARCHITECTURE.md             # Architecture documentation (this file)
  BACKENDTOFRONTEND.md        # Backend to frontend integration docs
```

## Module System

### Module Structure

Each module follows a consistent structure:

```
/modules/[module-name]/
  index.js                     # Public API - only exports what's needed
  controller.js                # Business logic
  routes.js                    # Route definitions
  service.js                   # Core functionality
  models/                      # Module-specific models
  services/                    # Additional service components
  utils/                       # Module-specific utilities
  README.md                    # Module documentation
```

### Module Communication

Modules communicate with each other through well-defined interfaces:

1. **Direct Imports**: Modules can import functionality from other modules via their public APIs (index.js)
2. **Core Components**: Shared functionality is made available through core components
3. **Application Integration**: The app layer connects modules together

## Core Components

### Core/Config

Configuration related to the database, environment, etc.

#### database.js
- Creates and exports a Sequelize instance with PostgreSQL configuration
- Provides a testConnection() function to verify database connectivity
- Uses environment variables for database credentials

#### index.js
- Centralizes the export of all configuration components

### Core/Middleware

Shared middleware for all routes.

#### errorHandler.js
- Defines custom error types: ValidationError, AuthenticationError, ForbiddenError, NotFoundError
- Provides asyncHandler to catch errors in async route handlers
- Central error handling middleware that formats error responses
- Includes stack traces in development mode

#### rateLimit.js
- Implements API rate limiting with express-rate-limit
- Defines two limiters:
  - apiLimiter: 100 requests per 15 minutes
  - uploadLimiter: 10 requests per 15 minutes (more restrictive for file uploads)

#### requestLogger.js
- Middleware to log HTTP requests and responses
- Records request method, URL, status code, duration, and user ID
- Attaches to the 'finish' event of the response object

#### security.js
- Sets up security middleware with helmet, xss-clean, hpp, etc.
- Configures CORS with allowlists
- Provides file type validation middleware

#### index.js
- Centralizes the export of all middleware components

### Core/Utils

Shared utility functions.

#### pagination.js
- Parses pagination parameters from request queries
- Generates pagination metadata
- Provides Sequelize options for pagination

#### setupVerify.js
- Verifies the server setup and diagnoses issues
- Checks environment variables
- Tests database, BigQuery, GCS, and OpenAI connectivity

#### verifyFirebaseSetup.js
- Verifies Firebase Admin SDK setup
- Tests service account configuration
- Validates Firebase connectivity

#### index.js
- Centralizes the export of all utility functions

## Modules

### Auth Module

Responsible for authentication and authorization.

#### middleware.js
- Firebase authentication middleware
- Token verification and user identification
- Supports multiple token sources (headers, query params, cookies)

#### index.js
- Exports firebaseAuth middleware and initializeFirebaseAdmin function

### BigQuery Module

Handles BigQuery integration for data processing and querying.

#### connectivity.js
- Verifies BigQuery connectivity
- Checks BigQuery configuration completeness
- Provides enhanced error messages for BigQuery connection issues

#### service.js
- Creates BigQuery tables for datasets
- Maps column types from application to BigQuery types
- Handles data loading from Cloud Storage to BigQuery
- Executes SQL queries against BigQuery
- Manages BigQuery datasets and tables

#### index.js
- Exports createBigQueryTable, deleteBigQueryTable, createBigQueryView, and runBigQueryQuery functions

### DataProcessing Module

Handles advanced data processing, query planning, and aggregation for complex reports.

#### queryPlanner.js
- Analyzes complex queries to determine when multiple SQL queries are needed
- Breaks down complex questions into simpler, executable queries
- Determines query complexity and decomposition strategies
- Creates execution plans with dependencies between queries

#### aggregator.js
- Combines results from multiple SQL queries
- Performs data transformations and joins
- Prepares combined datasets for analysis and visualization

#### dataAnalysis.js
- Performs statistical analysis on query results
- Calculates summary statistics (mean, median, percentiles)
- Identifies outliers and patterns
- Provides trend analysis and forecasting capabilities

#### index.js
- Exports data processing functionality
- Centralizes data transformation utilities

### Datasets Module

Manages datasets and their metadata.

#### controller.js
- Implements dataset CRUD operations
- Handles file uploads
- Processes datasets
- Manages dataset schemas

#### database.js
- Creates Sequelize connection for dataset models
- Provides connection testing functionality

#### models/dataset.js
- Defines the Dataset model
- Includes fields for userId, name, description, dataType, filePath, etc.
- Sets up indexes and relationships

#### models/datasetColumn.js
- Defines the DatasetColumn model
- Includes fields for name, type, nullable, primaryKey, etc.
- Associates with Dataset model

#### models/datasetIndex.js
- Defines the DatasetIndex model
- Includes fields for name, uniqueness
- Associates with Dataset model

#### models/datasetProcessingJob.js
- Defines the DatasetProcessingJob model
- Tracks processing jobs for datasets
- Includes status, jobType, error tracking

#### models/indexColumn.js
- Defines the IndexColumn model
- Links columns to indices
- Includes position information

#### models/index.js
- Centralizes the export of all models
- Provides database connection through models

#### services/fileProcessingService.js
- Processes datasets synchronously
- Extracts schema information
- Creates BigQuery tables
- Updates dataset status

#### routes.js
- Defines dataset API routes
- Applies authentication middleware
- Links routes to controller methods

#### index.js
- Exports controller, routes, and metadata

### File Processing Module

Handles file parsing and schema extraction.

#### services/csvProcessor.js
- Processes CSV files
- Extracts schema information
- Detects column types
- Samples data for preview

#### services/excelProcessor.js
- Processes Excel files
- Extracts schema information
- Converts Excel to CSV for BigQuery
- Samples data for preview

#### utils/fileProcessing.js
- Detects column types from samples
- Validates files based on type, size, and extension

#### service.js
- Provides unified interface for file processing
- Delegates to specific processors based on file type

#### index.js
- Exports processCSV, processExcel, and fileProcessing utilities

### Queries Module

Handles natural language query processing and execution.

#### controller.js
- Implements query generation and execution
- Validates queries
- Executes BigQuery queries
- Formats query results

#### services/nlpService.js
- Converts natural language to SQL
- Uses OpenAI API for NLP
- Validates generated SQL
- Includes conversation history for context
- Handles retry logic for failed SQL generation

#### routes.js
- Defines query API routes
- Applies authentication middleware
- Links routes to controller methods

#### index.js
- Exports controller, routes, and metadata

### Reports Module

Manages comprehensive AI-driven reporting capabilities.

#### controller.js
- Implements report generation, retrieval, and management
- Handles the report lifecycle
- Coordinates complex report creation
- Formats report responses for the frontend

#### models/reportModel.js
- Defines the Report model
- Includes fields for userId, datasetId, query, status, reportType, etc.
- Stores report components as JSON (visualizations, insights)
- Includes narrative text and generated SQL

#### services/reportGenerationService.js
- Orchestrates report generation process
- Coordinates between SQL generation, data retrieval, and report assembly
- Handles BigQuery query execution
- Assembles complete reports

#### services/visualizationService.js
- Determines appropriate visualizations for data
- Generates visualization specifications
- Supports multiple chart types (tables, bars, lines, etc.)
- Adapts to different data characteristics

#### services/insightService.js
- Extracts insights from query results
- Identifies trends, patterns, and anomalies
- Calculates statistical summaries
- Highlights significant findings

#### services/narrativeService.js
- Generates natural language descriptions of data
- Uses OpenAI for contextual narratives
- Creates explanatory text for different sections
- Provides template-based fallbacks

#### utils/reportUtils.js
- Helper functions for report processing
- Validation utilities for report components
- Size management functions
- Response formatting

#### routes.js
- Defines report API routes
- Applies authentication middleware
- Links routes to controller methods

#### index.js
- Exports controller, routes, and metadata

### Storage Module

Handles Google Cloud Storage operations.

#### service.js
- Uploads files to Google Cloud Storage
- Downloads files from Google Cloud Storage
- Deletes files from Google Cloud Storage
- Manages directories in Cloud Storage

#### index.js
- Exports uploadFile, downloadFile, deleteFile functions

### Uploads Module

Handles chunked file uploads for large files.

#### controller.js
- Initializes chunked uploads
- Processes individual chunks
- Merges chunks and starts processing
- Tracks upload status

#### routes.js
- Defines chunked upload API routes
- Applies authentication middleware
- Links routes to controller methods

#### index.js
- Exports controller, routes, and metadata

## External Services Integration

### Firebase Authentication
- Used for user authentication
- Integrated via Firebase Admin SDK
- Custom middleware for token verification
- Support for various token sources

### Google Cloud Storage
- Used for file storage
- Files organized by user/dataset
- Automatic bucket creation if needed
- Handles large file uploads efficiently

### Google BigQuery
- Used for data storage and querying
- Tables created per dataset
- Schema mapping from application to BigQuery
- Handles data loading from GCS
- Executes SQL queries with results formatting

### OpenAI API
- Used for natural language to SQL conversion
- Used for narrative generation in reports
- Processes conversation history for context
- Retry logic for failed conversions
- Validates generated SQL before execution

## Authentication & Authorization

Authentication is handled through Firebase Auth with a custom middleware:

1. **Token Extraction**: From Authorization header, custom header, query param, or cookie
2. **Token Verification**: Using Firebase Admin SDK
3. **User Assignment**: User info attached to req.user object
4. **Access Control**: Routes protected by auth middleware

The auth workflow is as follows:
1. Client obtains Firebase ID token
2. Token is included in requests to the backend
3. Auth middleware verifies token authenticity
4. If valid, the request proceeds with user context
5. If invalid, a 401 Unauthorized response is returned

## Data Flow

### Dataset Creation Flow
1. User uploads a file via `/api/datasets/upload` or chunked upload for large files
2. File is stored in Google Cloud Storage
3. File is processed to extract schema information
4. Schema is stored in PostgreSQL database
5. Data is loaded into BigQuery for querying
6. Dataset metadata is updated with status

### Query Flow
1. User sends natural language query to `/api/query`
2. Query is converted to SQL using OpenAI
3. SQL is validated and corrected if needed
4. SQL is executed against BigQuery
5. Results are formatted and returned

### Chunked Upload Flow
1. Upload is initialized with metadata
2. File chunks are uploaded individually
3. Chunks are stored in temporary directory
4. When all chunks are received, they are merged
5. Merged file is processed like regular uploads

### Report Generation Flow
1. User submits a natural language query for report generation
2. Query is analyzed to determine if multiple queries are needed
3. SQL queries are generated and executed against BigQuery
4. Results are analyzed to extract insights
5. Appropriate visualizations are selected based on data characteristics
6. Narrative text is generated to explain findings
7. Complete report is assembled and stored in the database
8. Report metadata is returned to the user with initial results

## Error Handling

The application implements a comprehensive error handling strategy:

1. **Custom Error Types**:
   - ValidationError: Input validation issues (400)
   - AuthenticationError: Authentication failures (401)
   - ForbiddenError: Authorization failures (403)
   - NotFoundError: Resource not found (404)

2. **asyncHandler Wrapper**:
   - Catches errors in async route handlers
   - Forwards to central error handler

3. **Central Error Handler**:
   - Formats error responses consistently
   - Includes appropriate HTTP status codes
   - Adds stack traces in development mode
   - Supports error details for more information

4. **Service-Specific Error Handling**:
   - BigQuery service includes detailed error diagnostics
   - File processing has validation and type detection error handling
   - NLP service includes retry logic for failures
   - Report generation includes fallback mechanisms

## Testing Strategy

The application includes a comprehensive test suite:

1. **Unit Tests**:
   - Middleware tests
   - Utility function tests
   - Model tests

2. **Integration Tests**:
   - API route tests
   - Service integration tests

3. **Test Helpers**:
   - Database handlers for test setup/teardown
   - Test user creation
   - Test dataset creation

4. **Environment**:
   - Testing in isolated test database
   - Environment variables for test configuration
   - Jest as test runner

## Deployment Strategy

The application is designed for flexible deployment:

1. **Environment Variables**:
   - Database configuration
   - Google Cloud credentials
   - Firebase configuration
   - OpenAI API keys

2. **Service Dependencies**:
   - PostgreSQL database
   - Google Cloud Storage
   - Google BigQuery
   - Redis (for job queue)

3. **Deployment Options**:
   - Docker containerization
   - Cloud Run or App Engine deployment
   - Kubernetes orchestration

## Monitoring & Logging

Logging and monitoring are implemented through:

1. **Request Logging**:
   - HTTP request/response logging
   - Performance metrics
   - User context

2. **Error Logging**:
   - Detailed error information
   - Stack traces
   - Context data

3. **Service Logging**:
   - BigQuery operation logging
   - File processing status
   - Authentication events
   - Report generation status

4. **Structured Logging**:
   - JSON format for machine parsing
   - Severity levels
   - Timestamps

## Performance Considerations

The application includes several performance optimizations:

1. **Connection Pooling**:
   - PostgreSQL connection pooling
   - Sequelize pooling configuration

2. **Caching**:
   - In-memory caching service
   - Result caching for queries

3. **Rate Limiting**:
   - API rate limiting
   - More restrictive limits for resource-intensive operations

4. **Chunked Uploads**:
   - Support for large file uploads
   - Streaming processing where possible

5. **BigQuery Optimization**:
   - Efficient schema mapping
   - Query optimization
   - Result limiting

6. **Report Size Management**:
   - Automatic truncation of large reports
   - Efficient JSON storage
   - Data sampling for very large datasets

## Security Measures

Security is a primary concern with several layers:

1. **Authentication**:
   - Firebase token verification
   - Short-lived tokens
   - Multiple token sources

2. **Input Validation**:
   - File validation
   - Request validation
   - SQL validation

3. **Rate Limiting**:
   - Protection against abuse
   - Different limits for different operations

4. **Web Security**:
   - Helmet for HTTP security headers
   - XSS protection
   - CSRF protection
   - Parameter pollution prevention

5. **SQL Injection Prevention**:
   - Strict validation of generated SQL
   - Parameterized queries
   - BigQuery security features

## Future Development

Planned enhancements for the system include:

1. **Enhanced Report Generation**:
   - Cross-dataset analysis
   - More advanced visualizations
   - Scheduled reports
   - Interactive report components

2. **Advanced Query Capabilities**:
   - Multi-query planning and execution
   - Context-aware follow-up queries
   - Query suggestions and refinements

3. **Data Processing Enhancements**:
   - More file format support
   - Automatic data cleaning
   - Improved schema detection

4. **Performance Optimizations**:
   - Distributed processing for large datasets
   - Enhanced caching strategies
   - Query optimization improvements

5. **User Experience Improvements**:
   - Report templates
   - Saved queries and reports
   - Custom visualization preferences