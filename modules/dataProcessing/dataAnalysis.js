// modules/dataProcessing/dataAnalysis.js

/**
 * Main data analysis module that coordinates all analysis operations
 * This module integrates the various specialized analysis modules
 */

const baseAnalysis = require('./baseAnalysis');
const comparisonAnalysis = require('./comparisonAnalysis');
const relationshipAnalysis = require('./relationshipAnalysis');

/**
 * Generate comprehensive analysis of query results
 * @param {Array|Object} data - Query results, either simple array or complex object
 * @param {Object} queryPlan - The query execution plan
 * @param {string} queryType - Type of query (if known)
 * @returns {Object} Analysis results with statistics, patterns, and insights
 */
async function analyzeData(data, queryPlan, queryType = null) {
  try {
    console.log('Performing data analysis on query results');

    // Determine data type and structure
    const dataStructure = baseAnalysis.determineDataStructure(data);

    // Use appropriate analysis method based on structure
    let analysisResult;

    switch (dataStructure.type) {
      case 'simple-array':
        analysisResult = baseAnalysis.analyzeSimpleData(data);
        break;

      case 'comparison':
        analysisResult = comparisonAnalysis.analyzeComparisonData(data, queryPlan, queryType);
        break;

      case 'multi-dataset':
        analysisResult = relationshipAnalysis.analyzeMultiDatasetData(data, queryPlan, queryType);
        break;

      default:
        // Fallback to simple analysis
        analysisResult = baseAnalysis.analyzeSimpleData(
          Array.isArray(data) ? data : [],
          queryPlan
        );
    }

    return {
      dataStructure,
      ...analysisResult,
      metadata: {
        queryType: queryType || dataStructure.type,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error analyzing data:', error);
    // Return minimal analysis on error
    return {
      error: 'Error analyzing data: ' + error.message,
      basicStats: baseAnalysis.generateBasicStats(Array.isArray(data) ? data : []),
      metadata: {
        queryType: queryType || 'unknown',
        timestamp: new Date().toISOString(),
        error: true
      }
    };
  }
}

/**
 * Generate targeted analysis for specific data aspects
 * This allows for more focused analysis without running the complete analysis
 * @param {Array|Object} data - Query results data
 * @param {string} aspectType - Type of analysis to perform
 *                             ('statistical', 'pattern', 'relationship', 'comparison')
 * @param {Object} options - Additional options for the analysis
 * @returns {Object} Targeted analysis results
 */
async function generateTargetedAnalysis(data, aspectType, options = {}) {
  try {
    // Determine data structure
    const dataStructure = baseAnalysis.determineDataStructure(data);

    // Perform targeted analysis based on aspect type
    switch (aspectType) {
      case 'statistical':
        return {
          type: 'statistical',
          stats: baseAnalysis.generateBasicStats(
            Array.isArray(data) ? data : (data.data || [])
          )
        };

      case 'pattern':
        return {
          type: 'pattern',
          patterns: baseAnalysis.identifyPatterns(
            Array.isArray(data) ? data : (data.data || [])
          )
        };

      case 'relationship':
        if (dataStructure.type === 'multi-dataset') {
          return {
            type: 'relationship',
            relationships: relationshipAnalysis.analyzeDatasetRelationships(
              data, options.queryType
            )
          };
        }
        return {
          type: 'relationship',
          error: 'Relationship analysis requires multi-dataset data',
          relationships: []
        };

      case 'comparison':
        if (dataStructure.type === 'comparison' || options.forceComparison) {
          return {
            type: 'comparison',
            comparisons: comparisonAnalysis.analyzeComparisons(
              Array.isArray(data) ? data : (data.data || [])
            )
          };
        }
        return {
          type: 'comparison',
          error: 'Comparison analysis requires comparison data',
          comparisons: []
        };

      default:
        return {
          type: 'unknown',
          error: `Unknown analysis type: ${aspectType}`
        };
    }
  } catch (error) {
    console.error(`Error generating targeted ${aspectType} analysis:`, error);
    return {
      type: aspectType,
      error: `Error in ${aspectType} analysis: ${error.message}`
    };
  }
}

/**
 * Combine multiple analyses into a comprehensive report
 * @param {Array} analyses - Multiple analysis results to combine
 * @returns {Object} Combined analysis report
 */
function combineAnalyses(analyses) {
  if (!analyses || !Array.isArray(analyses) || analyses.length === 0) {
    return {
      error: 'No analyses to combine',
      combined: false
    };
  }

  try {
    // Initialize combined result
    const combinedResult = {
      combined: true,
      stats: {},
      patterns: [],
      insights: [],
      relationships: [],
      comparisons: [],
      metadata: {
        timestamp: new Date().toISOString(),
        analysesCount: analyses.length
      }
    };

    // Add data from each analysis
    analyses.forEach((analysis, index) => {
      // Add stats if present
      if (analysis.basicStats) {
        combinedResult.stats[`dataset_${index}`] = analysis.basicStats;
      }

      // Add patterns if present
      if (analysis.patterns && Array.isArray(analysis.patterns)) {
        analysis.patterns.forEach(pattern => {
          combinedResult.patterns.push({
            ...pattern,
            source: `dataset_${index}`
          });
        });
      }

      // Add insights if present
      if (analysis.insights && Array.isArray(analysis.insights)) {
        analysis.insights.forEach(insight => {
          combinedResult.insights.push({
            ...insight,
            source: `dataset_${index}`
          });
        });
      }

      // Add relationships if present
      if (analysis.relationships && Array.isArray(analysis.relationships)) {
        analysis.relationships.forEach(relationship => {
          combinedResult.relationships.push({
            ...relationship,
            source: `dataset_${index}`
          });
        });
      }

      // Add comparisons if present
      if (analysis.comparisons && Array.isArray(analysis.comparisons)) {
        analysis.comparisons.forEach(comparison => {
          combinedResult.comparisons.push({
            ...comparison,
            source: `dataset_${index}`
          });
        });
      }
    });

    return combinedResult;
  } catch (error) {
    console.error('Error combining analyses:', error);
    return {
      error: 'Error combining analyses: ' + error.message,
      combined: false
    };
  }
}

module.exports = {
  analyzeData,
  generateTargetedAnalysis,
  combineAnalyses,
  // Re-export key functions from specialized modules for convenience
  generateBasicStats: baseAnalysis.generateBasicStats,
  identifyPatterns: baseAnalysis.identifyPatterns,
  analyzeComparisons: comparisonAnalysis.analyzeComparisons
};