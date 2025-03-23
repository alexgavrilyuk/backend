// modules/reports/index.js

/**
 * Reports module for generating comprehensive AI-driven reports
 * This module provides functionality to generate, retrieve, and manage reports
 * based on dataset analysis.
 */

const controller = require('./controller');
const routes = require('./routes');

module.exports = {
  controller,
  routes,
  metadata: {
    name: 'reports',
    description: 'Comprehensive AI-driven report generation and management'
  }
};