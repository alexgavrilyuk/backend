// modules/queries/routes.js
const express = require('express');
const router = express.Router();
const queryController = require('./controller');
const { middleware: authMiddleware } = require('../auth');
const { apiLimiter } = require('../../core/middleware');

// Apply auth middleware to all routes
router.use(authMiddleware.firebaseAuth);

// Register the query endpoint
router.post('/', apiLimiter, queryController.generateAndExecuteQuery);

module.exports = router;