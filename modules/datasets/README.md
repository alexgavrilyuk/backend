backend/modules/datasets

# Datasets Module

This module is responsible for all dataset-related functionality in the application.

## Responsibilities

- Dataset creation and upload
- Dataset retrieval and listing
- Dataset updating and deletion
- Schema management and retrieval
- Dataset metadata operations
- Dataset context management
- Schema enhancement and modifications
- Dataset preview generation

## API Endpoints

| Method | Endpoint                          | Description                       | Auth Required |
|--------|-----------------------------------|-----------------------------------|---------------|
| POST   | /api/datasets/upload              | Upload a new dataset              | Yes           |
| GET    | /api/datasets                     | List all user datasets            | Yes           |
| GET    | /api/datasets/:datasetId          | Get a specific dataset            | Yes           |
| DELETE | /api/datasets/:datasetId          | Delete a dataset                  | Yes           |
| GET    | /api/datasets/:datasetId/schema   | Get dataset schema                | Yes           |
| PATCH  | /api/datasets/:datasetId          | Update dataset details            | Yes           |
| PATCH  | /api/datasets/:datasetId/schema   | Update dataset schema             | Yes           |
| PATCH  | /api/datasets/:datasetId/context  | Update dataset context information| Yes           |
| GET    | /api/datasets/:datasetId/preview  | Get dataset preview data          | Yes           |

## Dataset Context Fields

The dataset model includes the following context fields to enhance AI-driven querying and provide additional metadata:

- `context`: General context about the dataset content and purpose
- `purpose`: Specific purpose or use case for the dataset
- `source`: Origin or source of the dataset
- `notes`: Additional notes or information about the dataset

These fields provide contextual information to the natural language query engine, improving query generation and results interpretation.

## Schema Management

The module supports updating and enhancing schema information:

- Column type updates (string, integer, float, date, boolean)
- Column description updates
- Column metadata management
- Primary key and nullability indicators
- BigQuery schema synchronization

When schema modifications are made, the changes are synchronized with the BigQuery table to ensure consistent querying.

## Dependencies

This module depends on:
- Database models for dataset storage
- Storage service for file management
- BigQuery service for data processing
- File processing utilities for data validation

## Configuration

The module requires the following environment variables to be set:
- Database connection parameters
- Google Cloud Storage credentials
- BigQuery configuration

## Usage

```javascript
// Import the datasets module
const datasetsModule = require('./modules/datasets');

// Register routes with Express
app.use('/api/datasets', datasetsModule.routes);

// Using the controller directly (if needed from another module)
const { controller } = require('./modules/datasets');
const result = await controller.getDatasetSchema(datasetId, userId);
```

## Data Flow

### Dataset Creation Flow
1. User uploads a file via `POST /api/datasets/upload`
2. File is stored in Google Cloud Storage
3. File is processed to extract schema information
4. Schema is stored in PostgreSQL database
5. Data is loaded into BigQuery for querying
6. Dataset metadata is updated with processing status

### Schema Update Flow
1. User updates schema information via `PATCH /api/datasets/:datasetId/schema`
2. Database is updated with new column information
3. BigQuery table schema is updated to match
4. Updated schema is returned to client

### Context Update Flow
1. User updates context information via `PATCH /api/datasets/:datasetId/context`
2. Database is updated with new context fields
3. Updated dataset with context is returned to client

## Dataset Previews

The module provides dataset preview capabilities with:
- Limited row sampling (configurable, default 100 rows)
- Direct querying of BigQuery for performance
- Consistent formatting with query results

## Development Guidelines

When working on this module:

1. Maintain backward compatibility with existing API endpoints
2. Follow the error handling patterns established in the controller
3. Ensure proper validation of all inputs
4. Use transactions for operations that affect multiple database records
5. Maintain comprehensive test coverage for all endpoints
6. Ensure context fields are properly sanitized and never returned as null
7. Synchronize schema changes between database and BigQuery

## Testing

Run module-specific tests:
```
npm run test:datasets
```