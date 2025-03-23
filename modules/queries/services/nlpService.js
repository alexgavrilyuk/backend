// modules/queries/services/nlpService.js

const { OpenAI } = require('openai');
const db = require('../../datasets/models');
const dataProcessing = require('../../dataProcessing');
require('dotenv').config();

// Import the new modular services
const SchemaProcessor = require('./schemaProcessor');
const SqlGenerator = require('./sqlGenerator');
const SqlValidator = require('./sqlValidator');
const AnalyticsExtractor = require('./analyticsExtractor');

// Initialize OpenAI client (kept here for backwards compatibility)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Convert a natural language query to SQL
 * @param {string} naturalLanguageQuery - The natural language query
 * @param {Array} columns - The dataset columns
 * @param {string} datasetName - Name of the dataset
 * @param {Array} conversationHistory - Previous conversation messages (optional)
 * @param {number} retryCount - Number of retries attempted (optional)
 * @returns {Promise<object>} - The SQL query and related information
 */
async function naturalLanguageToSql(naturalLanguageQuery, columns, datasetName, conversationHistory = [], retryCount = 0) {
  console.log("Generating SQL query for:", naturalLanguageQuery);
  console.log("With conversation history:", conversationHistory.length, "messages");

  try {
    // First, analyze query complexity to determine if it needs multiple queries
    const dataset = await db.Dataset.findOne({
      where: { name: datasetName }
    });

    const datasetContext = dataset ? {
      context: dataset.context,
      purpose: dataset.purpose,
      source: dataset.source,
      notes: dataset.notes
    } : null;

    // Detect if this is a visualization/reporting request
    const requestsVisualization = AnalyticsExtractor.detectVisualizationRequest(naturalLanguageQuery);

    // Use the query planner to analyze complexity
    const complexityAnalysis = await dataProcessing.queryPlanner.analyzeQueryComplexity(
      naturalLanguageQuery,
      columns,
      { name: datasetName, ...datasetContext }
    );

    console.log("Query complexity analysis:", JSON.stringify(complexityAnalysis, null, 2));

    // If query is complex and requires multiple queries, use query planning approach
    if (complexityAnalysis.isComplex) {
      return await SqlGenerator.handleComplexQuery(
        naturalLanguageQuery,
        columns,
        datasetName,
        datasetContext,
        complexityAnalysis,
        conversationHistory
      );
    } else {
      // For simple queries, use the enhanced approach
      return await SqlGenerator.generateEnhancedSqlQuery(
        naturalLanguageQuery,
        columns,
        datasetName,
        datasetContext,
        conversationHistory,
        requestsVisualization,
        retryCount
      );
    }
  } catch (error) {
    console.error("Error in naturalLanguageToSql:", error);
    // Return error info or retry if appropriate
    if (retryCount < 2) {
      console.log(`Error: ${error.message}. Retrying (attempt ${retryCount + 2}/3)...`);
      return naturalLanguageToSql(naturalLanguageQuery, columns, datasetName, conversationHistory, retryCount + 1);
    }
    return {
      error: `Failed to generate SQL query: ${error.message}`,
      prompt: naturalLanguageQuery,
      retries: retryCount
    };
  }
}

/**
 * Generate a dataset-specific SQL query using OpenAI
 * @param {string} naturalLanguageQuery - The natural language query
 * @param {Array} columns - The dataset columns
 * @param {string} datasetName - The name of the dataset
 * @returns {Promise<string>} - The generated SQL query
 */
async function generateDatasetQuery(naturalLanguageQuery, columns, datasetName) {
  try {
    const result = await naturalLanguageToSql(naturalLanguageQuery, columns, datasetName);

    if (result.error) {
      throw new Error(result.error);
    }

    // For complex queries, just return a placeholder
    // The actual execution will be handled separately using the query plan
    if (result.isComplex) {
      return {
        isComplex: true,
        queryPlan: result.queryPlan,
        executionSequence: result.executionSequence,
        queryType: result.queryType
      };
    }

    // Clean up the SQL query - remove any FROM clauses if they exist
    let sqlQuery = result.sqlQuery;

    // Remove FROM clause and everything after it if it exists
    const fromIndex = sqlQuery.toLowerCase().indexOf(' from ');
    if (fromIndex > -1) {
      sqlQuery = sqlQuery.substring(0, fromIndex);
    }

    // Normalize quotes: Replace double quotes with backticks for column names
    sqlQuery = sqlQuery.replace(/"([^"]+)"/g, "`$1`");

    return sqlQuery;
  }
  catch (error) {
    console.error('Error generating SQL query:', error);
    throw new Error(`Failed to generate SQL query: ${error.message}`);
  }
}

/**
 * Generate a component query from a complex query plan
 * @param {Object} queryStep - A step from the query plan
 * @param {Array} columns - The dataset columns
 * @param {string} datasetName - The name of the dataset
 * @param {Object} datasetContext - Dataset context information
 * @returns {Promise<string>} - The generated SQL query for this component
 */
async function generateComponentQuery(queryStep, columns, datasetName, datasetContext) {
  try {
    // Generate SQL for this specific component query
    const result = await SqlGenerator.generateEnhancedSqlQuery(
      queryStep.query,
      columns,
      datasetName,
      datasetContext,
      [] // No conversation history for component queries
    );

    if (result.error) {
      throw new Error(`Failed to generate component query (${queryStep.id}): ${result.error}`);
    }

    // Clean up the SQL query
    let sqlQuery = result.sqlQuery;

    // Remove FROM clause if it exists
    const fromIndex = sqlQuery.toLowerCase().indexOf(' from ');
    if (fromIndex > -1) {
      sqlQuery = sqlQuery.substring(0, fromIndex);
    }

    // Normalize quotes
    sqlQuery = sqlQuery.replace(/"([^"]+)"/g, "`$1`");

    return {
      id: queryStep.id,
      sql: sqlQuery,
      description: queryStep.description,
      dependencies: queryStep.dependencies || []
    };
  } catch (error) {
    console.error(`Error generating component query for step ${queryStep.id}:`, error);
    throw new Error(`Failed to generate component query (${queryStep.id}): ${error.message}`);
  }
}

// Export the public API - all original functions to maintain compatibility
module.exports = {
  naturalLanguageToSql,
  generateDatasetQuery,
  generateComponentQuery,
  isSafeQuery: SqlValidator.isSafeQuery,
  detectContextReferences: AnalyticsExtractor.detectContextReferences,
  extractVisualizationRecommendations: AnalyticsExtractor.extractVisualizationRecommendations,
  extractAnalyticalInsights: AnalyticsExtractor.extractAnalyticalInsights
};