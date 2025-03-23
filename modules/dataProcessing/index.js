// modules/dataProcessing/index.js

/**
 * DataProcessing module for handling complex query operations
 * This module provides functionality for query planning, result aggregation,
 * and data analysis for multi-query operations.
 */

const queryPlanner = require('./queryPlanner');
const aggregator = require('./aggregator');
const dataAnalysis = require('./dataAnalysis');
const baseAnalysis = require('./baseAnalysis');
const comparisonAnalysis = require('./comparisonAnalysis');
const relationshipAnalysis = require('./relationshipAnalysis');

module.exports = {
  // Main module components
  queryPlanner,
  aggregator,
  dataAnalysis,

  // Specialized analysis modules for direct access if needed
  baseAnalysis,
  comparisonAnalysis,
  relationshipAnalysis,

  // Convenience export of frequently used functions
  analyzeData: dataAnalysis.analyzeData,
  generateTargetedAnalysis: dataAnalysis.generateTargetedAnalysis,
  combineQueryResults: aggregator.combineQueryResults,
  prepareForVisualization: aggregator.prepareForVisualization,
  analyzeQueryComplexity: queryPlanner.analyzeQueryComplexity,
  createQueryPlan: queryPlanner.createQueryPlan,
  generateExecutionSequence: queryPlanner.generateExecutionSequence,

  // Module metadata
  metadata: {
    name: 'dataProcessing',
    description: 'Handles complex query planning, aggregation, and analysis for multi-query operations',
    version: '1.0.0'
  }
};