// modules/uploads/routes.js

const express = require('express');
const router = express.Router();
const uploadController = require('./controller');
const { middleware: authMiddleware } = require('../auth');
const { uploadLimiter } = require('../../core/middleware');

// Apply auth middleware to all routes
router.use(authMiddleware.firebaseAuth);

// Chunked upload routes
router.post('/init', uploadLimiter, uploadController.initChunkedUpload);
router.post('/:uploadId/chunk', uploadController.uploadChunk);
router.get('/:uploadId/status', uploadController.getUploadStatus);

module.exports = router;