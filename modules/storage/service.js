// modules/storage/service.js

const { Storage } = require('@google-cloud/storage');
const { Readable } = require('stream');
require('dotenv').config();

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE  // Path to your service account key file
});

const bucketName = process.env.GCS_BUCKET_NAME || 'app-datasets';

/**
 * Uploads a file to Google Cloud Storage
 * @param {Buffer} fileBuffer - The file data as a buffer
 * @param {string} filePath - The path in GCS where the file should be stored
 * @param {Object} metadata - Additional metadata for the file
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
async function uploadFile(fileBuffer, filePath, metadata = {}) {
  try {
    // Create bucket if it doesn't exist
    const [bucketExists] = await storage.bucket(bucketName).exists();
    if (!bucketExists) {
      await storage.createBucket(bucketName, {
        location: process.env.GCS_BUCKET_LOCATION || 'us-central1',
      });
      console.log(`Bucket ${bucketName} created.`);
    }

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    // Create a readable stream from the buffer
    const stream = new Readable();
    stream.push(fileBuffer);
    stream.push(null); // Signal the end of the stream

    // Create a write stream to GCS
    const writeStream = file.createWriteStream({
      metadata: {
        contentType: metadata.contentType || 'application/octet-stream',
        metadata: metadata
      }
    });

    // Upload the file
    await new Promise((resolve, reject) => {
      stream
        .pipe(writeStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    // Make the file publicly accessible (optional, based on your requirements)
    // await file.makePublic();

    // Return the file's GCS URI
    return `gs://${bucketName}/${filePath}`;
  } catch (error) {
    console.error('Error uploading file to Google Cloud Storage:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Deletes a file or directory from Google Cloud Storage
 * @param {string} path - The path to delete (can be a file or a directory prefix)
 * @param {boolean} isDirectory - Whether the path is a directory (prefix)
 * @returns {Promise<boolean>} - True if deletion was successful
 */
async function deleteFile(path, isDirectory = false) {
  try {
    const bucket = storage.bucket(bucketName);

    if (isDirectory) {
      // Delete all files with this prefix
      await bucket.deleteFiles({
        prefix: path
      });
    } else {
      // Delete a single file
      await bucket.file(path).delete();
    }

    return true;
  } catch (error) {
    console.error('Error deleting from Google Cloud Storage:', error);
    throw new Error(`Failed to delete: ${error.message}`);
  }
}

/**
 * Downloads a file from Google Cloud Storage
 * @param {string} filePath - The path of the file in GCS
 * @returns {Promise<Buffer>} - The file contents as a buffer
 */
async function downloadFile(filePath) {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    const [fileContents] = await file.download();
    return fileContents;
  } catch (error) {
    console.error('Error downloading from Google Cloud Storage:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

module.exports = {
  storage,
  bucketName,
  uploadFile,
  deleteFile,
  downloadFile
};