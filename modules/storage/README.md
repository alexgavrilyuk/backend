This README is in backend/modules/storage

# Storage Module

This module is responsible for handling all Google Cloud Storage operations within the application.

## Responsibilities

- File uploads to Google Cloud Storage
- File downloads from Google Cloud Storage
- File deletions from Google Cloud Storage
- Directory management in Google Cloud Storage

## API

The module exports the following functions:

- `uploadFile(fileBuffer, filePath, metadata)`: Uploads a file to Google Cloud Storage
- `deleteFile(path, isDirectory)`: Deletes a file or directory from Google Cloud Storage
- `downloadFile(filePath)`: Downloads a file from Google Cloud Storage

## Dependencies

This module depends on:
- `@google-cloud/storage`: Google Cloud Storage client library

## Configuration

The module requires the following environment variables:
- `GCP_PROJECT_ID`: Google Cloud Project ID
- `GCP_KEY_FILE`: Path to Google Cloud service account key file
- `GCS_BUCKET_NAME`: Google Cloud Storage bucket name