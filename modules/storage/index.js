// modules/storage/index.js
const storageService = require('./service');

module.exports = {
  // Export main storage functions
  uploadFile: storageService.uploadFile,
  deleteFile: storageService.deleteFile,
  downloadFile: storageService.downloadFile,
  storage: storageService.storage,
  bucketName: storageService.bucketName,

  // Module metadata
  metadata: {
    name: 'storage',
    description: 'Handles cloud storage operations for file management'
  }
};