// modules/uploads/controller.js

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const db = require('../datasets/models');
const { uploadFile } = require('../storage');
const { processDataset } = require('../datasets/services/fileProcessingService');
const { ValidationError, NotFoundError, asyncHandler } = require('../../core/middleware');
require('dotenv').config();

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE
});

const bucketName = process.env.GCS_BUCKET_NAME || 'app-datasets';

// Temporary directory for storing chunks
const TEMP_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Initialize a chunked upload
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const initChunkedUpload = async (req, res) => {
  try {
    const { name, description, dataType, totalChunks, totalSize } = req.body;
    const userId = req.user.id;

    // Validate required parameters
    if (!name || !dataType || !totalChunks || !totalSize) {
      throw new ValidationError('Missing required fields: name, dataType, totalChunks, and totalSize are required');
    }

    // Validate supported data types
    if (!['csv', 'excel'].includes(dataType)) {
      throw new ValidationError('Unsupported data type. Supported types: csv, excel');
    }

    // Validate file size (optional, based on your requirements)
    const maxSizeBytes = 1024 * 1024 * 1024; // 1GB
    if (parseInt(totalSize) > maxSizeBytes) {
      throw new ValidationError(`File size exceeds the maximum limit of 1GB`);
    }

    // Generate IDs
    const uploadId = uuidv4();
    const datasetId = uuidv4();

    // Create temp directory for this upload
    const uploadDir = path.join(TEMP_DIR, uploadId);
    fs.mkdirSync(uploadDir, { recursive: true });

    // Create upload metadata file
    const metadataPath = path.join(uploadDir, 'metadata.json');
    const metadata = {
      uploadId,
      datasetId,
      userId,
      name,
      description,
      dataType,
      totalChunks: parseInt(totalChunks),
      receivedChunks: 0,
      completed: false,
      timestamp: new Date().toISOString(),
      fileName: `${name}.${dataType === 'csv' ? 'csv' : 'xlsx'}`
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Create a record in the database
    await db.Dataset.create({
      id: datasetId,
      userId,
      name,
      description,
      dataType,
      filePath: `users/${userId}/datasets/${datasetId}/${metadata.fileName}`,
      status: 'uploading'
    });

    return res.status(201).json({
      success: true,
      message: 'Chunked upload initialized',
      uploadId,
      datasetId
    });
  } catch (error) {
    console.error('Error initializing chunked upload:', error);

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to initialize upload: ' + error.message
    });
  }
};

/**
 * Upload a chunk of a file
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const uploadChunk = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { chunkIndex } = req.body;

    if (!req.files || !req.files.chunk) {
      throw new ValidationError('No chunk file provided');
    }

    const chunk = req.files.chunk;
    const chunkIndex_num = parseInt(chunkIndex);

    // Validate upload ID
    const uploadDir = path.join(TEMP_DIR, uploadId);
    const metadataPath = path.join(uploadDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      throw new NotFoundError('Upload not found. Please initialize the upload first.');
    }

    // Read metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // Validate chunk index
    if (chunkIndex_num < 0 || chunkIndex_num >= metadata.totalChunks) {
      throw new ValidationError(`Invalid chunk index. Expected 0-${metadata.totalChunks - 1}`);
    }

    // Save chunk to disk
    const chunkPath = path.join(uploadDir, `chunk-${chunkIndex_num}`);
    await chunk.mv(chunkPath);

    // Update metadata
    metadata.receivedChunks += 1;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Check if all chunks received
    if (metadata.receivedChunks === metadata.totalChunks) {
      // Start background processing to merge chunks
      setTimeout(() => mergeChunks(uploadId), 0);
    }

    return res.status(200).json({
      success: true,
      message: `Chunk ${chunkIndex} uploaded successfully`,
      uploadId,
      receivedChunks: metadata.receivedChunks,
      totalChunks: metadata.totalChunks
    });
  } catch (error) {
    console.error('Error uploading chunk:', error);

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to upload chunk: ' + error.message
    });
  }
};

/**
 * Merge chunks and start processing
 * @param {string} uploadId - The upload ID
 */
const mergeChunks = async (uploadId) => {
  try {
    const uploadDir = path.join(TEMP_DIR, uploadId);
    const metadataPath = path.join(uploadDir, 'metadata.json');

    // Read metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // Check if already completed to prevent duplicate processing
    if (metadata.completed) {
      return;
    }

    // Mark as completed to prevent duplicate processing
    metadata.completed = true;
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Create output file
    const outputPath = path.join(uploadDir, 'merged-file');
    const outputStream = fs.createWriteStream(outputPath);

    // Merge chunks
    for (let i = 0; i < metadata.totalChunks; i++) {
      const chunkPath = path.join(uploadDir, `chunk-${i}`);
      const chunkData = fs.readFileSync(chunkPath);
      outputStream.write(chunkData);
    }

    // Close output stream and wait for it to finish
    await new Promise((resolve, reject) => {
      outputStream.end();
      outputStream.on('finish', resolve);
      outputStream.on('error', reject);
    });

    // Upload merged file to Google Cloud Storage
    const fileData = fs.readFileSync(outputPath);
    const gcsFilePath = `users/${metadata.userId}/datasets/${metadata.datasetId}/${metadata.fileName}`;

    await uploadFile(fileData, gcsFilePath, {
      contentType: metadata.dataType === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      datasetId: metadata.datasetId,
      originalName: metadata.fileName,
      uploadedBy: metadata.userId
    });

    // Update dataset status
    await db.Dataset.update({
      status: 'processing'
    }, {
      where: { id: metadata.datasetId }
    });

    // Process dataset synchronously
    try {
      await processDataset({
        datasetId: metadata.datasetId,
        userId: metadata.userId,
        filePath: gcsFilePath,
        dataType: metadata.dataType
      });

      console.log(`Chunked upload ${uploadId} processed successfully`);
    } catch (error) {
      console.error(`Error processing dataset: ${error.message}`);

      // Update dataset with error status
      await db.Dataset.update({
        status: 'error',
        errorMessage: `Error processing dataset: ${error.message}`
      }, {
        where: { id: metadata.datasetId }
      });
    }

    // Clean up temporary directory (optional)
    // fs.rmSync(uploadDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error merging chunks for upload ${uploadId}:`, error);

    // Update dataset with error status
    try {
      const metadataPath = path.join(TEMP_DIR, uploadId, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

        await db.Dataset.update({
          status: 'error',
          errorMessage: `Error merging chunks: ${error.message}`
        }, {
          where: { id: metadata.datasetId }
        });
      }
    } catch (updateError) {
      console.error('Error updating dataset status:', updateError);
    }
  }
};

/**
 * Get the status of a chunked upload
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getUploadStatus = async (req, res) => {
  try {
    const { uploadId } = req.params;

    // Validate upload ID
    const uploadDir = path.join(TEMP_DIR, uploadId);
    const metadataPath = path.join(uploadDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      throw new NotFoundError('Upload not found');
    }

    // Read metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // Get dataset status from database
    const dataset = await db.Dataset.findOne({
      where: { id: metadata.datasetId }
    });

    return res.status(200).json({
      success: true,
      uploadId,
      datasetId: metadata.datasetId,
      receivedChunks: metadata.receivedChunks,
      totalChunks: metadata.totalChunks,
      completed: metadata.completed,
      status: dataset ? dataset.status : 'unknown',
      progress: Math.round((metadata.receivedChunks / metadata.totalChunks) * 100)
    });
  } catch (error) {
    console.error('Error getting upload status:', error);

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to get upload status: ' + error.message
    });
  }
};

module.exports = {
  initChunkedUpload,
  uploadChunk,
  getUploadStatus
};