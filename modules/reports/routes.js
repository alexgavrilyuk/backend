// modules/reports/routes.js

const express = require('express');
const router = express.Router();
const reportController = require('./controller');
const { middleware: authMiddleware } = require('../auth');
const { apiLimiter } = require('../../core/middleware');

// Apply auth middleware to all routes
router.use(authMiddleware.firebaseAuth);

// Apply rate limiting to all routes
router.use(apiLimiter);

/**
 * @route   POST /api/reports
 * @desc    Generate a new report
 * @access  Private
 */
router.post('/', reportController.generateReport);

/**
 * @route   GET /api/reports
 * @desc    Get all user reports
 * @access  Private
 */
router.get('/', reportController.getUserReports);

/**
 * @route   GET /api/reports/:reportId
 * @desc    Get a specific report
 * @access  Private
 */
router.get('/:reportId', reportController.getReport);

/**
 * @route   DELETE /api/reports/:reportId
 * @desc    Delete a report
 * @access  Private
 */
router.delete('/:reportId', reportController.deleteReport);

module.exports = router;