# Backend to Frontend Integration Guide

This document provides comprehensive details on how the frontend should interact with the backend API for the dataset upload and management service.

## Table of Contents
- [System Overview](#system-overview)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Datasets](#datasets)
  - [Chunked Uploads](#chunked-uploads)
  - [Natural Language Querying](#natural-language-querying)
  - [Reports](#reports)
  - [Dataset Schema Management](#dataset-schema-management)
  - [Dataset Context Management](#dataset-context-management)
  - [Dataset Preview](#dataset-preview)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)
- [Data Models](#data-models)
- [Examples](#examples)
- [FAQ](#faq)

## System Overview

The backend system provides a complete suite of services for dataset management including:

- User authentication using Firebase
- File upload (CSV and Excel) with processing
- Schema extraction and storage
- BigQuery integration for efficient data querying
- Natural language to SQL conversion using OpenAI
- AI-driven report generation with visualizations and insights
- Chunked uploads for large files
- Comprehensive data management features
- Schema management and enhancement
- Dataset context management
- Dataset preview capabilities

### Architecture Overview

```
Frontend <-> Backend API <-> Database (PostgreSQL)
                         <-> Google Cloud Storage
                         <-> BigQuery
                         <-> OpenAI API
```

### Key Components

- **Authentication**: Firebase Authentication for secure user access
- **File Storage**: Google Cloud Storage for raw files
- **Database**: PostgreSQL for metadata and schema storage
- **Query Engine**: BigQuery for high-performance data queries
- **AI Integration**: OpenAI for natural language processing and insight generation
- **Reporting**: AI-driven report generation with visualizations and narrative explanations

## Authentication

The backend uses Firebase Authentication. All API requests (except public endpoints) require authentication.

### Authentication Headers

Include the Firebase ID token in your requests using one of these methods:

```javascript
// Method 1: Authorization header (recommended)
headers: {
  'Authorization': 'Bearer <firebase-id-token>'
}

// Method 2: Custom header
headers: {
  'firebase-id-token': '<firebase-id-token>'
}

// Method 3: Query parameter (not recommended for production)
fetch('/api/endpoint?token=<firebase-id-token>')

// Method 4: Cookie (if using cookie-based auth)
// The token should be stored in a cookie named 'firebaseToken'
```

### Obtaining Firebase ID Token

```javascript
// Example of getting a Firebase token in a React application
import { getAuth } from "firebase/auth";

const auth = getAuth();
const user = auth.currentUser;

if (user) {
  const token = await user.getIdToken();
  // Use this token in your API requests
}
```

### Auth Debugging

If authentication is failing, you can use the debug endpoint to troubleshoot:

- **URL**: `/api/auth-debug`
- **Method**: `GET`
- **Auth Required**: No
- **Response**: Returns detailed info about received headers and cookies

## API Endpoints

### Datasets

#### Upload a Dataset

- **URL**: `/api/datasets/upload`
- **Method**: `POST`
- **Auth Required**: Yes
- **Content-Type**: `multipart/form-data`
- **Rate Limit**: 10 requests per 15 minutes
- **Body**:
  - `file`: The CSV or Excel file to upload
  - `name`: Name of the dataset
  - `description`: (Optional) Description of the dataset
  - `dataType`: Type of data (`csv` or `excel`)

- **Success Response**:
  - **Code**: 201 Created
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Dataset uploaded and processed successfully",
    "datasetId": "uuid-string",
    "dataset": {
      "id": "uuid-string",
      "name": "Dataset Name",
      "description": "Dataset Description",
      "dataType": "csv",
      "status": "available",
      "rowCount": 100,
      "columnCount": 5,
      "createdAt": "2023-01-01T12:00:00Z",
      "updatedAt": "2023-01-01T12:05:00Z"
    }
  }
  ```

- **Error Response**:
  - **Code**: 400 Bad Request
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Error message describing the issue"
  }
  ```

- **Notes**:
  - File size limit is 100MB
  - Supported file types: CSV (.csv), Excel (.xls, .xlsx)
  - Processing happens synchronously, but may take time for large files
  - Status values: "processing", "available", "error"
  - Always check the "status" field to determine if the dataset is ready for use

#### Get All User Datasets

- **URL**: `/api/datasets`
- **Method**: `GET`
- **Auth Required**: Yes
- **Query Parameters**:
  - `page`: (Optional) Page number for pagination (default: 1)
  - `limit`: (Optional) Number of items per page (default: 20, max: 100)

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "datasets": [
      {
        "id": "uuid-string",
        "name": "Dataset Name",
        "description": "Dataset Description",
        "dataType": "csv",
        "status": "available",
        "rowCount": 100,
        "columnCount": 5,
        "fileSizeMB": "1.50",
        "createdAt": "2023-01-01T12:00:00Z",
        "updatedAt": "2023-01-01T12:05:00Z",
        "previewAvailable": true
      }
    ]
  }
  ```

- **Notes**:
  - Datasets are sorted by `updatedAt` in descending order (newest first)
  - All datasets belonging to the authenticated user are returned

#### Get Single Dataset

- **URL**: `/api/datasets/:datasetId`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**:
  - `datasetId`: ID of the dataset to retrieve

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "dataset": {
      "id": "uuid-string",
      "name": "Dataset Name",
      "description": "Dataset Description",
      "dataType": "csv",
      "status": "available",
      "rowCount": 100,
      "columnCount": 5,
      "fileSizeMB": "1.50",
      "createdAt": "2023-01-01T12:00:00Z",
      "updatedAt": "2023-01-01T12:05:00Z",
      "previewAvailable": true,
      "context": "This dataset contains sales data for our company's products.",
      "purpose": "Track sales performance across different regions and products.",
      "source": "CRM export, January 2023",
      "notes": "Missing data for February due to system outage."
    }
  }
  ```

- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Dataset not found"
  }
  ```

- **Notes**:
  - The response now includes context fields: `context`, `purpose`, `source`, and `notes`
  - These fields provide additional metadata about the dataset

#### Delete Dataset

- **URL**: `/api/datasets/:datasetId`
- **Method**: `DELETE`
- **Auth Required**: Yes
- **URL Parameters**:
  - `datasetId`: ID of the dataset to delete

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Dataset deleted successfully"
  }
  ```

- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Dataset not found"
  }
  ```

- **Notes**:
  - This operation deletes:
    - The dataset metadata from the database
    - All associated files from Google Cloud Storage
    - The corresponding BigQuery table
  - This operation is permanent and cannot be undone

#### Get Dataset Schema

- **URL**: `/api/datasets/:datasetId/schema`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**:
  - `datasetId`: ID of the dataset

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "schema": {
      "columns": [
        {
          "name": "column1",
          "type": "string",
          "nullable": true,
          "primaryKey": false,
          "description": "Description of column1"
        },
        {
          "name": "column2",
          "type": "integer",
          "nullable": false,
          "primaryKey": true,
          "description": "Description of column2"
        }
      ],
      "primaryKey": "column2",
      "indexes": [
        {
          "name": "idx_example",
          "columns": ["column1", "column2"],
          "unique": false
        }
      ]
    }
  }
  ```

- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Dataset not found"
  }
  ```

- **Notes**:
  - The schema contains all column information including types, constraints, and descriptions
  - Column types include: "string", "integer", "float", "date", "boolean"
  - This endpoint is useful for displaying metadata about the dataset structure

#### Update Dataset Details

- **URL**: `/api/datasets/:datasetId`
- **Method**: `PATCH`
- **Auth Required**: Yes
- **Content-Type**: `application/json`
- **URL Parameters**:
  - `datasetId`: ID of the dataset to update
- **Body**:
  - `name`: (Optional) New name for the dataset
  - `description`: (Optional) New description for the dataset

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Dataset updated successfully",
    "dataset": {
      "id": "uuid-string",
      "name": "Updated Dataset Name",
      "description": "Updated Dataset Description",
      "dataType": "csv",
      "status": "available",
      "rowCount": 100,
      "columnCount": 5,
      "fileSizeMB": "1.50",
      "createdAt": "2023-01-01T12:00:00Z",
      "updatedAt": "2023-01-01T12:10:00Z",
      "previewAvailable": true,
      "context": "",
      "purpose": "",
      "source": "",
      "notes": ""
    }
  }
  ```

- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Dataset not found"
  }
  ```

- **Notes**:
  - Only the name and description can be updated with this endpoint
  - Use the specific schema and context endpoints for updating those aspects
  - The file itself, dataType, and other properties cannot be changed after creation

### Dataset Schema Management

#### Update Dataset Schema

- **URL**: `/api/datasets/:datasetId/schema`
- **Method**: `PATCH`
- **Auth Required**: Yes
- **Content-Type**: `application/json`
- **URL Parameters**:
  - `datasetId`: ID of the dataset to update
- **Body**:
  ```json
  {
    "columns": [
      {
        "name": "column1",
        "type": "string",
        "description": "Updated description for column1"
      },
      {
        "name": "column2",
        "type": "integer",
        "description": "Updated description for column2"
      }
    ]
  }
  ```

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Schema updated successfully",
    "schema": {
      "columns": [
        {
          "name": "column1",
          "type": "string",
          "nullable": true,
          "primaryKey": false,
          "description": "Updated description for column1",
          "position": 0
        },
        {
          "name": "column2",
          "type": "integer",
          "nullable": false,
          "primaryKey": true,
          "description": "Updated description for column2",
          "position": 1
        }
      ],
      "primaryKey": ["column2"]
    }
  }
  ```

- **Error Response**:
  - **Code**: 400 Bad Request
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Invalid schema data: columns must be an array"
  }
  ```

- **Notes**:
  - Only column types and descriptions can be updated
  - You must reference existing column names
  - Valid column types are: "string", "integer", "float", "date", "boolean"
  - The BigQuery schema is automatically updated to match

### Dataset Context Management

#### Update Dataset Context

- **URL**: `/api/datasets/:datasetId/context`
- **Method**: `PATCH`
- **Auth Required**: Yes
- **Content-Type**: `application/json`
- **URL Parameters**:
  - `datasetId`: ID of the dataset to update
- **Body**:
  ```json
  {
    "context": "This dataset contains sales data for our company's products.",
    "purpose": "Track sales performance across different regions and products.",
    "source": "CRM export, January 2023",
    "notes": "Missing data for February due to system outage."
  }
  ```

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Dataset context updated successfully",
    "dataset": {
      "id": "uuid-string",
      "name": "Dataset Name",
      "description": "Dataset Description",
      "dataType": "csv",
      "status": "available",
      "createdAt": "2023-01-01T12:00:00Z",
      "updatedAt": "2023-01-01T12:10:00Z",
      "context": "This dataset contains sales data for our company's products.",
      "purpose": "Track sales performance across different regions and products.",
      "source": "CRM export, January 2023",
      "notes": "Missing data for February due to system outage."
    }
  }
  ```

- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Dataset not found"
  }
  ```

- **Notes**:
  - All context fields are optional, only the fields you provide will be updated
  - Context fields improve natural language query generation
  - Provide as much context as possible for best results
  - Context fields will never be returned as null (empty string is used instead)

### Dataset Preview

#### Get Dataset Preview

- **URL**: `/api/datasets/:datasetId/preview`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**:
  - `datasetId`: ID of the dataset
- **Query Parameters**:
  - `limit`: (Optional) Maximum number of rows to return (default: 100, max: 1000)

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "preview": [
      {
        "column1": "value1",
        "column2": 123,
        "column3": "2023-01-01"
      },
      {
        "column1": "value2",
        "column2": 456,
        "column3": "2023-01-02"
      }
    ]
  }
  ```

- **Error Response**:
  - **Code**: 400 Bad Request
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Dataset is not available for preview (current status: processing)"
  }
  ```

- **Notes**:
  - Preview data is retrieved directly from BigQuery
  - The dataset must be in "available" status
  - The response format matches query results for consistency

### Chunked Uploads

For files larger than the standard upload limit, you can use the chunked upload API to upload files in smaller pieces.

#### Initialize Chunked Upload

- **URL**: `/api/chunked-upload/init`
- **Method**: `POST`
- **Auth Required**: Yes
- **Content-Type**: `application/json`
- **Rate Limit**: 10 requests per 15 minutes
- **Body**:
  - `name`: Name of the dataset
  - `description`: (Optional) Description of the dataset
  - `dataType`: Type of data (`csv` or `excel`)
  - `totalChunks`: Total number of chunks to be uploaded
  - `totalSize`: Total file size in bytes

- **Success Response**:
  - **Code**: 201 Created
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Chunked upload initialized",
    "uploadId": "uuid-string",
    "datasetId": "uuid-string"
  }
  ```

- **Error Response**:
  - **Code**: 400 Bad Request
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Error message describing the issue"
  }
  ```

- **Notes**:
  - Maximum file size is 1GB
  - Save both the `uploadId` and `datasetId` for subsequent requests

#### Upload a Chunk

- **URL**: `/api/chunked-upload/:uploadId/chunk`
- **Method**: `POST`
- **Auth Required**: Yes
- **Content-Type**: `multipart/form-data`
- **URL Parameters**:
  - `uploadId`: ID returned from the init endpoint
- **Body**:
  - `chunk`: File chunk data
  - `chunkIndex`: Index of the chunk (0-based)

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Chunk 2 uploaded successfully",
    "uploadId": "uuid-string",
    "receivedChunks": 3,
    "totalChunks": 10
  }
  ```

- **Error Response**:
  - **Code**: 400 Bad Request/404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Error message describing the issue"
  }
  ```

- **Notes**:
  - Upload chunks in any order
  - When all chunks are received, processing begins automatically
  - Check the upload status to monitor progress

#### Get Chunked Upload Status

- **URL**: `/api/chunked-upload/:uploadId/status`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**:
  - `uploadId`: ID of the upload to check

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "uploadId": "uuid-string",
    "datasetId": "uuid-string",
    "receivedChunks": 7,
    "totalChunks": 10,
    "completed": false,
    "status": "processing",
    "progress": 70
  }
  ```

- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Upload not found"
  }
  ```

- **Notes**:
  - Status values include: "uploading", "processing", "available", "error"
  - Progress is a percentage (0-100) indicating overall completion
  - The `datasetId` can be used to retrieve the complete dataset once processing is complete

### Natural Language Querying

#### Generate and Execute SQL Query

- **URL**: `/api/query`
- **Method**: `POST`
- **Auth Required**: Yes
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "userQuery": "String - The natural language query from the user",
    "datasetId": "String - The ID of the dataset to query (required)",
    "conversationHistory": [
      {
        "role": "user" | "assistant",
        "content": "String - Previous message content"
      }
    ]
  }
  ```

- **Response Format**:
  ```json
  {
    "results": [
      {
        // Array of objects with query results
        // Structure varies based on the query
      }
    ],
    "prompt": "String - The original query",
    "sql": "String - Generated SQL without table reference",
    "fullSql": "String - Complete SQL with table references",
    "aiResponse": "String - Response message",
    "retries": 0, // Number of attempts needed to generate SQL
    "isDimensionalQuery": false, // Whether query contains GROUP BY
    "metadata": {
      "totalRows": 10,
      "datasetName": "My Dataset",
      "datasetId": "uuid-string"
    }
  }
  ```

- **Error Codes**:
  - `400` - Bad request (invalid parameters)
  - `401` - Unauthorized
  - `404` - Dataset not found
  - `500` - Server error

- **Notes**:
  - The `datasetId` parameter is required
  - The `conversationHistory` parameter is optional and allows for context-aware follow-up queries
  - The service automatically uses dataset context information to improve query generation
  - The service automatically retries failed queries up to 3 times
  - Only SELECT statements are allowed for security
  - Query runs against the dynamically generated schema of the specified dataset
  - Conversation history should be maintained by the frontend for the current session only

### Reports

#### Generate a Report

- **URL**: `/api/reports`
- **Method**: `POST`
- **Auth Required**: Yes
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "query": "String - The natural language query to analyze",
    "datasetId": "String - The ID of the dataset to analyze",
    "reportType": "String - (Optional) Type of report to generate, defaults to 'standard'",
    "conversationHistory": [
      {
        "role": "user" | "assistant",
        "content": "String - Previous message content"
      }
    ]
  }
  ```

- **Success Response**:
  - **Code**: 201 Created
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Report generated successfully",
    "reportId": "uuid-string",
    "report": {
      "id": "uuid-string",
      "query": "Original natural language query",
      "status": "completed",
      "reportType": "standard",
      "createdAt": "2023-01-01T12:00:00Z",
      "updatedAt": "2023-01-01T12:05:00Z",
      "datasetId": "uuid-string",
      "generatedSql": "SQL query generated from natural language",
      "narrative": "Markdown-formatted narrative explaining the report findings",
      "visualizations": [
        {
          "type": "bar" | "line" | "pie" | "table" | "scatter" | "combo" | "kpi",
          "title": "Visualization title",
          "data": [...],
          "config": {...}
        }
      ],
      "insights": [
        {
          "type": "statistic" | "trend" | "top_performer" | "distribution" | "range",
          "title": "Insight title",
          "description": "Description of the insight"
        }
      ],
      "data": [...],
      "metadata": {...}
    }
  }
  ```

- **Error Response**:
  - **Code**: 400 Bad Request
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Error message describing the issue"
  }
  ```

- **Notes**:
  - Reports can take longer to generate than regular queries due to additional processing
  - The `visualizations` array contains specifications that the frontend can render
  - The `narrative` field contains markdown-formatted text explaining the report
  - The `data` array contains the raw data used for analysis
  - The `conversationHistory` parameter is optional and allows for context-aware report generation

#### Get a Report

- **URL**: `/api/reports/:reportId`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**:
  - `reportId`: ID of the report to retrieve

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "report": {
      "id": "uuid-string",
      "query": "Original natural language query",
      "status": "completed",
      "reportType": "standard",
      "createdAt": "2023-01-01T12:00:00Z",
      "updatedAt": "2023-01-01T12:05:00Z",
      "datasetId": "uuid-string",
      "generatedSql": "SQL query generated from natural language",
      "narrative": "Markdown-formatted narrative explaining the report findings",
      "visualizations": [...],
      "insights": [...],
      "data": [...],
      "metadata": {...}
    },
    "dataset": {
      "id": "uuid-string",
      "name": "Dataset Name"
    }
  }
  ```

- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Report not found"
  }
  ```

#### Get All User Reports

- **URL**: `/api/reports`
- **Method**: `GET`
- **Auth Required**: Yes
- **Query Parameters**: None

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "reports": [
      {
        "id": "uuid-string",
        "query": "Original natural language query",
        "status": "completed",
        "reportType": "standard",
        "createdAt": "2023-01-01T12:00:00Z",
        "updatedAt": "2023-01-01T12:05:00Z",
        "dataset": {
          "id": "uuid-string",
          "name": "Dataset Name"
        }
      }
    ]
  }
  ```

#### Delete a Report

- **URL**: `/api/reports/:reportId`
- **Method**: `DELETE`
- **Auth Required**: Yes
- **URL Parameters**:
  - `reportId`: ID of the report to delete

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
  ```json
  {
    "success": true,
    "message": "Report deleted successfully"
  }
  ```

- **Error Response**:
  - **Code**: 404 Not Found
  - **Content**:
  ```json
  {
    "success": false,
    "error": "Report not found"
  }
  ```

## Error Handling

### Standard Error Format

All API errors follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Resource created successfully
- `400` - Bad request (invalid parameters, validation error)
- `401` - Unauthorized (authentication required or invalid token)
- `403` - Forbidden (authenticated but not authorized)
- `404` - Resource not found
- `429` - Too many requests (rate limit exceeded)
- `500` - Server error

### Validation Errors

For validation errors, the response will include a clear message about what went wrong:

```json
{
  "success": false,
  "error": "Missing required fields: name and dataType are required"
}
```

### Error Types

The backend uses these error types internally:
- `ValidationError` (400): Input validation failed
- `AuthenticationError` (401): Authentication issues
- `ForbiddenError` (403): Permission issues
- `NotFoundError` (404): Resource not found

### Handling 429 Errors (Rate Limiting)

When rate limits are exceeded, backends returns:

```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

The frontend should implement exponential backoff or inform users to try again later.

## Rate Limiting

The API has rate limits to prevent abuse:

| Endpoint | Rate Limit |
|----------|------------|
| General API | 100 requests per 15 minutes |
| File Upload | 10 requests per 15 minutes |

When a rate limit is exceeded, the API returns a 429 status code.

## Best Practices

### Uploading Files

1. **Validate files client-side**: Check file size and type before uploading
2. **Use chunked uploads for large files**: Files over 50MB should use chunked upload
3. **Track upload status**: Poll the API to check processing status
4. **Handle errors gracefully**: Display clear messages to users

### Authentication

1. **Refresh tokens**: Implement token refresh logic when tokens expire
2. **Secure storage**: Store tokens securely (HTTP-only cookies or secure storage)
3. **Error handling**: Handle 401 errors by redirecting to login
4. **Always include token**: Ensure all authenticated requests include the Firebase token

### Schema and Context Management

1. **Update schema information**: Provide clear descriptions for all columns
2. **Maintain data types**: Ensure column types accurately reflect the data
3. **Provide dataset context**: Fill in all context fields for better query results
4. **Document data sources**: Include information about where the data came from
5. **Note any limitations**: Document any known issues or limitations in the data

### Querying Data

1. **Provide examples**: Show users example queries they can use
2. **Validate status**: Check dataset status before allowing queries
3. **Handle large results**: Implement pagination for displaying large result sets
4. **Cache results**: Cache query results when appropriate
5. **Always specify dataset**: Every query must include the dataset ID
6. **Maintain conversation history**: Store conversation history on the client for the current session to enable context-aware follow-up queries
7. **Use dataset preview**: Show users sample data before they start querying

### Working with Reports

1. **Progressive loading**: Show report components as they become available
2. **Responsive visualizations**: Ensure visualizations scale appropriately on different devices
3. **Narrative parsing**: Render markdown in narratives with appropriate formatting
4. **Error fallbacks**: Handle missing visualization data gracefully
5. **Saving reports**: Provide functionality to save or bookmark important reports
6. **Print formatting**: Ensure reports can be printed or exported with proper formatting

## Visualization Types

The reports API returns visualization specifications that the frontend should render. Here are the supported visualization types and their configurations:

### Table Visualization
```json
{
  "type": "table",
  "title": "Data Table Title",
  "data": [...],
  "config": {
    "columns": [
      { "key": "column1", "label": "Column 1" },
      { "key": "column2", "label": "Column 2" }
    ]
  }
}
```

### Bar Chart
```json
{
  "type": "bar",
  "title": "Bar Chart Title",
  "data": [...],
  "config": {
    "xAxis": "column1",
    "yAxis": "column2",
    "sortBy": "column2",
    "sortDirection": "desc"
  }
}
```

### Line Chart
```json
{
  "type": "line",
  "title": "Line Chart Title",
  "data": [...],
  "config": {
    "xAxis": "date",
    "yAxis": "value",
    "sortBy": "date"
  }
}
```

### Pie Chart
```json
{
  "type": "pie",
  "title": "Pie Chart Title",
  "data": [...],
  "config": {
    "valueField": "value",
    "labelField": "category"
  }
}
```

### Scatter Plot
```json
{
  "type": "scatter",
  "title": "Scatter Plot Title",
  "data": [...],
  "config": {
    "xAxis": "column1",
    "yAxis": "column2"
  }
}
```

### Combo Chart
```json
{
  "type": "combo",
  "title": "Combo Chart Title",
  "data": [...],
  "config": {
    "xAxis": "date",
    "series": [
      { "name": "Series 1", "key": "value1" },
      { "name": "Series 2", "key": "value2" }
    ],
    "sortBy": "date"
  }
}
```

### KPI Cards
```json
{
  "type": "kpi",
  "title": "Key Metrics",
  "data": [
    { "label": "Total Sales", "value": 12345, "key": "sales" },
    { "label": "Average Order", "value": 58.2, "key": "average" }
  ]
}
```

## Insight Types

The reports API returns various types of insights extracted from the data:

### Statistic Insight
```json
{
  "type": "statistic",
  "title": "Total Revenue",
  "description": "The total revenue is $1,234,567.",
  "value": 1234567,
  "metric": "revenue"
}
```

### Trend Insight
```json
{
  "type": "trend",
  "title": "Increasing Revenue Trend",
  "description": "Revenue has increased by 15.2% from January to December.",
  "percentChange": 15.2,
  "startDate": "2023-01-01",
  "endDate": "2023-12-31",
  "dimension": "date",
  "measure": "revenue"
}
```

### Top Performer Insight
```json
{
  "type": "top_performer",
  "title": "Top Product",
  "description": "Product X has the highest sales with $123,456.",
  "value": 123456,
  "dimension": "product",
  "measure": "sales",
  "category": "Product X"
}
```

### Distribution Insight
```json
{
  "type": "distribution",
  "title": "Sales Distribution",
  "description": "80% of sales come from 20% of products, showing a strong Pareto effect."
}
```

### Range Insight
```json
{
  "type": "range",
  "title": "Price Range",
  "description": "Product prices range from $9.99 to $99.99 with an average of $45.50.",
  "min": 9.99,
  "max": 99.99,
  "average": 45.50,
  "metric": "price"
}
```

## Report Narratives

Each report includes a narrative field containing a markdown-formatted explanation of the report findings. The narrative typically includes:

- An introduction explaining what was analyzed
- Sections covering key statistics, trends, and insights
- Explanations of visualizations
- A summary of the most important findings

The frontend should render this markdown appropriately, preserving formatting, headers, and paragraph structure.

## Data Models

### Message Structure

```json
{
  "role": "user" | "assistant",
  "content": "String - The message text",
  "timestamp": "ISO Date String"
}
```

### Dataset Object

```json
{
  "id": "uuid-string",
  "name": "Dataset Name",
  "description": "Dataset Description",
  "dataType": "csv" | "excel",
  "status": "available" | "processing" | "error",
  "rowCount": 5000,
  "columnCount": 10,
  "fileSizeMB": "2.50",
  "createdAt": "ISO Date String",
  "updatedAt": "ISO Date String",
  "previewAvailable": true,
  "errorMessage": "Error message if status is error",
  "context": "General context about the dataset",
  "purpose": "Purpose of the dataset",
  "source": "Where the data came from",
  "notes": "Additional notes about the dataset"
}
```

### Column Structure

```json
{
  "name": "String", // Column name
  "type": "string" | "integer" | "float" | "date" | "boolean", // Data type
  "nullable": Boolean, // Whether column accepts null values
  "primaryKey": Boolean, // Whether column is a primary key
  "description": "String", // Optional description
  "position": Number // Position in the dataset
}
```

### Report Object

```json
{
  "id": "uuid-string",
  "query": "Original natural language query",
  "status": "processing" | "completed" | "error",
  "reportType": "standard" | "executive" | "detailed",
  "createdAt": "ISO Date String",
  "updatedAt": "ISO Date String",
  "datasetId": "uuid-string",
  "generatedSql": "SQL query generated from natural language",
  "narrative": "Markdown-formatted explanation of findings",
  "visualizations": [
    // Array of visualization specifications
  ],
  "insights": [
    // Array of insight objects
  ],
  "data": [
    // Array of data objects used in analysis
  ],
  "metadata": {
    // Additional report metadata
  }
}
```

### Query Results Structure

The structure of query results depends on the query, but generally follows this pattern:

```json
[
  {
    "column1": "value1",
    "column2": "value2",
    "column3": 123,
    "column4": true
  },
  {
    "column1": "value1a",
    "column2": "value2a",
    "column3": 456,
    "column4": false
  }
]
```

## Examples

### Example: Update Dataset Schema and Context

```javascript
// 1. Authenticate with Firebase
import { getAuth } from "firebase/auth";
const auth = getAuth();
const user = auth.currentUser;
const token = await user.getIdToken();

// 2. First, update the schema to add descriptions and fix types
const schemaUpdateResponse = await fetch(`/api/datasets/${datasetId}/schema`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    columns: [
      {
        name: 'date',
        type: 'date',
        description: 'Transaction date in ISO format'
      },
      {
        name: 'amount',
        type: 'float',
        description: 'Transaction amount in USD'
      },
      {
        name: 'category',
        type: 'string',
        description: 'Transaction category'
      }
    ]
  })
});

const schemaResult = await schemaUpdateResponse.json();
console.log('Schema updated:', schemaResult);

// 3. Then, add context information to help with queries
const contextUpdateResponse = await fetch(`/api/datasets/${datasetId}/context`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    context: 'This dataset contains financial transactions from our accounting system.',
    purpose: 'Track spending patterns and identify budget categories.',
    source: 'Exported from QuickBooks, Q1 2023',
    notes: 'Some transactions are missing category information.'
  })
});

const contextResult = await contextUpdateResponse.json();
console.log('Context updated:', contextResult);
```

### Example: Using Dataset Preview before Querying

```javascript
// 1. Get Firebase auth token
const token = await user.getIdToken(true);

// 2. First, get a preview of the dataset to understand the data
const previewResponse = await fetch(`/api/datasets/${datasetId}/preview?limit=10`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const preview = await previewResponse.json();
console.log('Dataset preview:', preview.preview);

// 3. Show the preview to the user in a table
renderPreviewTable(preview.preview);

// 4. Once the user understands the data, they can create a query
const queryResponse = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userQuery: 'What were the total transactions by category?',
    datasetId: datasetId,
    conversationHistory: []
  })
});

const queryResults = await queryResponse.json();
console.log('Query results:', queryResults);
```

### Example: Natural Language Query with Dataset Context

```javascript
// 1. Initialize conversation history
let conversationHistory = [];

// 2. Get Firebase auth token
const token = await user.getIdToken(true);

// 3. Make the first query request
const firstQueryResponse = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userQuery: 'What were the total sales in 2023?',
    datasetId: 'your-dataset-id',
    conversationHistory: []
  })
});

const firstResults = await firstQueryResponse.json();

// 4. Update conversation history with the query and response
conversationHistory.push(
  { role: 'user', content: 'What were the total sales in 2023?' },
  { role: 'assistant', content: firstResults.aiResponse }
);

// 5. Make a follow-up query that references the first query
const followUpResponse = await fetch('/api/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userQuery: 'How does that compare to 2022?',
    datasetId: 'your-dataset-id',
    conversationHistory: conversationHistory
  })
});

const followUpResults = await followUpResponse.json();
console.log(followUpResults);

// 6. Update conversation history again
conversationHistory.push(
  { role: 'user', content: 'How does that compare to 2022?' },
  { role: 'assistant', content: followUpResults.aiResponse }
);
```

### Example: Generating and Displaying a Report

```javascript
// 1. Generate a report
const reportResponse = await fetch('/api/reports', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "Analyze sales by region for 2023, highlighting growth areas",
    datasetId: "dataset-123",
    reportType: "standard"
  })
});

const reportResult = await reportResponse.json();
const reportId = reportResult.reportId;

// 2. Display the report
// Narrative section
renderMarkdown(reportResult.report.narrative);

// Visualizations
reportResult.report.visualizations.forEach(viz => {
  switch(viz.type) {
    case 'bar':
      renderBarChart(viz.data, viz.config, viz.title);
      break;
    case 'line':
      renderLineChart(viz.data, viz.config, viz.title);
      break;
    case 'table':
      renderDataTable(viz.data, viz.config, viz.title);
      break;
    case 'pie':
      renderPieChart(viz.data, viz.config, viz.title);
      break;
    case 'scatter':
      renderScatterPlot(viz.data, viz.config, viz.title);
      break;
    case 'combo':
      renderComboChart(viz.data, viz.config, viz.title);
      break;
    case 'kpi':
      renderKPICards(viz.data, viz.title);
      break;
  }
});

// Insights
const categorizedInsights = groupBy(reportResult.report.insights, 'type');
renderInsights(categorizedInsights);
```

### Example: Chunked Upload for Large Files

```javascript
// 1. Split file into chunks
const chunkSize = 5 * 1024 * 1024; // 5MB chunks
const totalChunks = Math.ceil(file.size / chunkSize);
const chunks = [];

for (let i = 0; i < totalChunks; i++) {
  const start = i * chunkSize;
  const end = Math.min(file.size, start + chunkSize);
  chunks.push(file.slice(start, end));
}

// 2. Initialize chunked upload
const initResponse = await fetch('/api/chunked-upload/init', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Large Dataset',
    description: 'Very large dataset requiring chunked upload',
    dataType: 'csv',
    totalChunks,
    totalSize: file.size
  })
});

const { uploadId, datasetId } = await initResponse.json();

// 3. Upload each chunk
for (let i = 0; i < chunks.length; i++) {
  const chunkFormData = new FormData();
  chunkFormData.append('chunk', chunks[i]);
  chunkFormData.append('chunkIndex', i);

  await fetch(`/api/chunked-upload/${uploadId}/chunk`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: chunkFormData
  });

  // Update progress indication
  const progress = ((i + 1) / totalChunks) * 100;
  updateProgressUI(progress);
}

// 4. Check status until complete
let uploadStatus;
do {
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

  const statusResponse = await fetch(`/api/chunked-upload/${uploadId}/status`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  uploadStatus = await statusResponse.json();
  updateProgressUI(uploadStatus.progress);
} while (uploadStatus.status === 'processing');

console.log('Upload and processing complete!');
```

## FAQ

### General Questions

#### Q: How do I know when a dataset is ready to be queried?
A: Check the dataset's `status` field. It should be "available" before querying.

#### Q: What's the maximum file size for uploads?
A: Standard uploads are limited to 100MB. For larger files (up to 1GB), use the chunked upload API.

#### Q: How are files processed?
A: Files are uploaded to Google Cloud Storage, then processed to extract schema information. Data is loaded into BigQuery for efficient querying.

#### Q: What file types are supported?
A: CSV (.csv) and Excel (.xlsx, .xls) files are supported.

### Authentication Issues

#### Q: My authentication is failing. What should I check?
A: Verify your Firebase token is valid and not expired. Check the format of your Authorization header. Use the `/api/auth-debug` endpoint to see what headers are being received.

#### Q: How often do I need to refresh tokens?
A: Firebase ID tokens typically expire after 1 hour. Your frontend should refresh them before expiration.

#### Q: My query endpoint returns 401 Unauthorized. What's wrong?
A: Ensure you're including the Firebase authentication token in the request header as `Authorization: Bearer <token>`. The token must be valid and not expired.

### Data Processing

#### Q: Why is my dataset status showing "error"?
A: Check the `errorMessage` field on the dataset for details. Common issues include invalid file formats, parsing errors, or service limits.

#### Q: How long does processing take?
A: Processing time depends on file size and complexity. Small files (under 10MB) typically process in seconds. Larger files may take several minutes.

#### Q: Can I update a dataset's data after upload?
A: No, data cannot be modified after upload. Delete the dataset and upload a new version instead.

### Report Generation

#### Q: How long does report generation take?
A: Report generation typically takes a few seconds, but can take longer for complex analyses or very large datasets.

#### Q: Can I customize report visualizations?
A: The current version automatically selects visualizations based on data characteristics. Future versions will support customization options.

#### Q: What's the difference between reports and regular queries?
A: Reports include comprehensive analysis with visualizations, insights, and narrative explanations, while regular queries return only tabular data.

#### Q: Can reports be shared with other users?
A: Currently, reports are private to each user. Sharing functionality will be added in a future update.

### Schema and Context Management

#### Q: How do I update column descriptions?
A: Use the `/api/datasets/:datasetId/schema` endpoint with a PATCH request containing the column names, types, and descriptions you want to update.

#### Q: Why should I add context information to my dataset?
A: Context information improves natural language query results by giving the AI model more understanding about your data, its purpose, and any limitations.

#### Q: Can I change column types after upload?
A: Yes, you can update column types using the schema management endpoint. The backend will update both the database metadata and the BigQuery table schema.

### Query Issues

#### Q: Why isn't my natural language query working?
A: Natural language queries are interpreted by AI. Try rephrasing your query to be more specific. Check the response for any hints on how to improve the query.

#### Q: Do I need to specify a dataset for every query?
A: Yes, the `/api/query` endpoint requires a `datasetId` parameter to know which dataset to query against. Each query is tailored to the specific schema of that dataset.

#### Q: Are there limits on query complexity?
A: Yes, there are limits to ensure performance. Complex queries may time out or be rejected. Break complex queries into simpler parts if needed.

#### Q: Can I join datasets in queries?
A: Dataset-specific queries operate on a single dataset. Cross-dataset joining is not currently supported.

#### Q: How do I know what columns are available in my dataset?
A: Use the `/api/datasets/:datasetId/schema` endpoint to get a complete list of columns and their types before querying.

### Natural Language Query Improvements

#### Q: How can I improve my natural language queries?
A:
- Be specific about what columns you want to see
- Use the actual column names from your dataset when possible
- Specify sorting, filtering, and grouping clearly
- For date operations, clearly state the time period (e.g., "last 3 months")
- For numeric data, clearly state what aggregation you want (sum, average, etc.)
- Provide comprehensive dataset context information
- Add detailed column descriptions

#### Q: Can I use complex SQL features in my natural language queries?
A: The system supports many SQL features through natural language, including:
- Filtering with multiple conditions
- Grouping and aggregation
- Sorting and limiting results
- Date-based operations
- Basic statistical functions

Try to express your needs in plain language, and the system will generate the appropriate SQL.

#### Q: How does the conversation history work?
A: The `conversationHistory` parameter lets you provide context from previous queries. It helps the AI understand follow-up questions and maintain context. The array should contain objects with `role` ("user" or "assistant") and `content` properties.