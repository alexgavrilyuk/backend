// modules/datasets/routes.js

const express = require('express');
const router = express.Router();
const datasetController = require('./controller');
const { middleware: authMiddleware } = require('../auth');
const { uploadLimiter, apiLimiter } = require('../../core/middleware');

// Apply auth middleware to all routes
router.use(authMiddleware.firebaseAuth);

// Dataset routes
router.post('/upload', uploadLimiter, datasetController.uploadDataset);
router.get('/', datasetController.getUserDatasets);
router.get('/:datasetId', datasetController.getDataset);
router.delete('/:datasetId', datasetController.deleteDataset);
router.get('/:datasetId/schema', datasetController.getDatasetSchema);
router.patch('/:datasetId', datasetController.updateDataset);

// New endpoints for schema enhancement features
router.patch('/:datasetId/schema', apiLimiter, datasetController.updateDatasetSchema);
router.patch('/:datasetId/context', apiLimiter, datasetController.updateDatasetContext);
router.get('/:datasetId/preview', apiLimiter, datasetController.getDatasetPreview);

module.exports = router;