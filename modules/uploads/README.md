This README is in backend/modules/uploads

# Uploads Module

This module is responsible for handling file uploads in the application, particularly large files using chunked uploads.

## Responsibilities

- Initializing chunked uploads
- Processing upload chunks
- Tracking upload status
- Merging chunks and processing the complete file
- Temporary file management

## API Endpoints

| Method | Endpoint                 | Description                       | Auth Required |
|--------|--------------------------|------------------------------------|---------------|
| POST   | /api/chunked-upload/init | Initialize a chunked upload        | Yes           |
| POST   | /api/chunked-upload/:uploadId/chunk | Upload a chunk of a file | Yes           |
| GET    | /api/chunked-upload/:uploadId/status | Check upload status     | Yes           |

## Dependencies

This module depends on:
- Storage service for file management
- Dataset processing for handling uploaded files
- Firebase authentication

## Configuration

The module requires the following environment variables:
- Google Cloud Storage credentials
- Temporary directory configuration