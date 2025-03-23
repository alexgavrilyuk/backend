// modules/queries/controller.js

const db = require('../datasets/models');
const { naturalLanguageToSql, isSafeQuery, extractVisualizationRecommendations, extractAnalyticalInsights } = require('./services/nlpService');
const { runBigQueryQuery } = require('../bigquery');
const { ValidationError, NotFoundError, asyncHandler } = require('../../core/middleware/errorHandler');
const { middleware: authMiddleware } = require('../auth');
require('dotenv').config();

/**
 * Generate and execute a natural language query against a user's dataset
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const generateAndExecuteQuery = async (req, res) => {
  try {
    const { userQuery, conversationHistory = [], datasetId } = req.body;

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;

    // Validate required parameters
    if (!userQuery) {
      return res.status(400).json({ error: 'User query is required' });
    }

    if (!datasetId) {
      return res.status(400).json({ error: 'Dataset ID is required' });
    }

    console.log("Received query:", userQuery);
    console.log("For dataset:", datasetId);
    console.log("With conversation history:", conversationHistory.length, "messages");

    // Check if dataset exists and belongs to user
    const dataset = await db.Dataset.findOne({
      where: { id: datasetId, userId }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found or access denied' });
    }

    // Check if dataset is available
    if (dataset.status !== 'available') {
      return res.status(400).json({
        error: `Dataset is not available for querying (current status: ${dataset.status})`
      });
    }

    // Get dataset columns
    const columns = await db.DatasetColumn.findAll({
      where: { datasetId },
      order: [['position', 'ASC']]
    });

    if (!columns.length) {
      return res.status(400).json({ error: 'Dataset schema information not available' });
    }

    // Generate SQL with conversation context (using the enhanced nlpService)
    const result = await naturalLanguageToSql(
      userQuery,
      columns,
      dataset.name,
      conversationHistory
    );

    if (result.error) {
      console.error("Error generating SQL:", result.error);

      // Return a clear error instead of falling back to incorrect queries
      return res.status(400).json({
        success: false,
        error: `Could not generate a valid SQL query for your request. Please try rephrasing your question.`,
        details: result.error,
        prompt: userQuery,
        aiResponse: result.aiResponse,
        retries: result.retries
      });
    }

    // Special handling for complex queries
    if (result.isComplex && result.queryPlan) {
      try {
        console.log("Handling complex query with query plan:", JSON.stringify(result.queryPlan));

        // Import the report generation service to handle visualization requests
        const reportGenerationService = require('../reports/services/reportGenerationService');

        // Generate a full report directly when we have a complex query with visualization intent
        const reportData = await reportGenerationService.generateComplexReport({
          query: userQuery,
          datasetId,
          userId,
          dataset,
          columns,
          queryPlan: result.queryPlan,
          executionSequence: result.executionSequence,
          conversationHistory
        });

        // Return complete response with visualizations
        return res.json({
          success: true,
          isComplex: true,
          prompt: userQuery,
          queryPlan: result.queryPlan,
          visualizations: reportData.visualizations,
          insights: reportData.insights,
          narrative: reportData.narrative,
          results: reportData.data,
          metadata: {
            totalRows: reportData.data ? reportData.data.length : 0,
            datasetName: dataset.name,
            datasetId,
            queryType: result.queryType || 'complex'
          }
        });
      } catch (complexError) {
        console.error("Error processing complex query:", complexError);
        return res.status(500).json({
          success: false,
          error: `Error processing complex query: ${complexError.message}`,
          prompt: userQuery,
          isComplex: true
        });
      }
    }

    // The original SQL returned by OpenAI - normalize newlines and extra spaces
    let originalSql = result.sqlQuery.replace(/\s+/g, ' ').trim();
    console.log("Original SQL from OpenAI (normalized):", originalSql);

    // First, check if the query is safe
    if (!isSafeQuery(originalSql)) {
      console.error("Unsafe SQL query generated:", originalSql);
      return res.status(400).json({
        error: 'Invalid or unsafe SQL query generated',
        prompt: result.prompt,
        aiResponse: result.aiResponse,
        retries: result.retries
      });
    }

    // We'll extract clauses using a new approach that focuses on identifying keywords
    let fullSql = '';

    // Check if the query starts with SELECT
    if (!originalSql.toUpperCase().startsWith('SELECT')) {
      console.error("Invalid SQL query - doesn't start with SELECT:", originalSql);
      return res.status(400).json({
        error: 'Invalid SQL query - must start with SELECT',
        prompt: result.prompt
      });
    }

    // First, remove any "FROM ..." placeholder from the original SQL
    // This is critical to prevent duplicate FROM clauses
    originalSql = originalSql.replace(/FROM\s+\.\.\.(\s|$)/i, ' ');

    // Now let's separate the clauses by looking for the key SQL keywords
    // We'll do this by identifying the positions of each keyword if present
    const clauseKeywords = ['WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING'];
    const keywordPositions = [];

    clauseKeywords.forEach(keyword => {
      // Create pattern that matches the keyword as a whole word
      const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
      const match = originalSql.match(pattern);
      if (match) {
        keywordPositions.push({
          keyword: keyword,
          position: match.index
        });
      }
    });

    // Sort positions by their location in the string
    keywordPositions.sort((a, b) => a.position - b.position);

    // Construct the BigQuery table reference
    const userDataset = `user_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const tableId = `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const tableReference = `\`${process.env.GCP_PROJECT_ID}.${userDataset}.${tableId}\``;

    // Extract the SELECT part - it goes from start to the first keyword (or end if no keywords)
    const firstKeywordPos = keywordPositions.length > 0 ? keywordPositions[0].position : originalSql.length;
    // Get the part after "SELECT " and before the first keyword
    let selectPart = originalSql.substring('SELECT '.length, firstKeywordPos).trim();

    // If the selectPart is empty or just has *, set it to "*"
    if (!selectPart || selectPart === "*") {
      selectPart = "*";
    }

    // Extract the clauses
    const clauses = [];
    if (keywordPositions.length > 0) {
      for (let i = 0; i < keywordPositions.length; i++) {
        const startPos = keywordPositions[i].position;
        const endPos = (i < keywordPositions.length - 1) ? keywordPositions[i+1].position : originalSql.length;
        const clause = originalSql.substring(startPos, endPos).trim();
        clauses.push(clause);
      }
    }

    // Now construct the full SQL
    fullSql = `SELECT ${selectPart} FROM ${tableReference}`;

    // Add all the clauses
    if (clauses.length > 0) {
      // Check if any clause is incomplete or empty
      const validClauses = clauses.filter(clause => {
        const parts = clause.split(/\s+/);
        // A valid clause should have at least a keyword and a condition
        return parts.length >= 2;
      });

      if (validClauses.length > 0) {
        fullSql += ' ' + validClauses.join(' ');
      } else {
        // If we didn't find any valid clauses, reconstruct from the original query
        // Especially useful for "show me" type queries with WHERE filters
        const originalSqlLower = originalSql.toLowerCase();

        if (originalSqlLower.includes('where')) {
          // Extract WHERE conditions from the AI-generated SQL
          const whereMatch = originalSql.match(/WHERE\s+(.*?)(?:$|\s+(?:GROUP BY|ORDER BY|LIMIT))/is);
          if (whereMatch && whereMatch[1] && whereMatch[1].trim().length > 0) {
            fullSql += ` WHERE ${whereMatch[1].trim()}`;
          }
        }

        // Add other clauses if present in the original SQL
        ['GROUP BY', 'ORDER BY', 'LIMIT'].forEach(clause => {
          const clauseLower = clause.toLowerCase();
          if (originalSqlLower.includes(clauseLower)) {
            const clauseMatch = originalSql.match(new RegExp(`${clause}\\s+(.*?)(?:$|\\s+(?:ORDER BY|LIMIT))`, 'is'));
            if (clauseMatch && clauseMatch[1]) {
              fullSql += ` ${clause} ${clauseMatch[1].trim()}`;
            }
          }
        });
      }
    } else if (originalSql.toLowerCase().includes('where')) {
      // Special handling for cases where our keyword detection might have missed the WHERE clause
      const whereMatch = originalSql.match(/WHERE\s+(.*?)(?:$|\s+(?:GROUP BY|ORDER BY|LIMIT))/is);
      if (whereMatch && whereMatch[1] && whereMatch[1].trim().length > 0) {
        fullSql += ` WHERE ${whereMatch[1].trim()}`;
      }
    }

    // Normalize whitespace in the full SQL
    fullSql = fullSql.replace(/\s+/g, ' ').trim();

    // Handle special case for EXTRACT functions in WHERE clause
    if (fullSql.includes('EXTRACT(YEAR FROM')) {
      const yearMatch = fullSql.match(/EXTRACT\s*\(\s*YEAR\s+FROM\s+["`']?([^"`'\)]+)["`']?\s*\)\s*=\s*(\d{4})/i);
      if (yearMatch) {
        const dateColumn = yearMatch[1].trim();
        const year = yearMatch[2];

        // Replace EXTRACT with BETWEEN
        fullSql = fullSql.replace(
          /EXTRACT\s*\(\s*YEAR\s+FROM\s+["`']?([^"`'\)]+)["`']?\s*\)\s*=\s*(\d{4})/i,
          `${dateColumn.includes(' ') ? `\`${dateColumn}\`` : dateColumn} BETWEEN '${year}-01-01' AND '${year}-12-31'`
        );
        console.log("Replaced EXTRACT with date range in WHERE clause:", fullSql);
      }
    }

    // Special debug logging
    console.log("Parsed clauses:", clauses);
    console.log("Full SQL query length:", fullSql.length);
    console.log("Full SQL query before execution:", fullSql);

    try {
      // Execute the query using BigQuery
      console.log("Executing SQL query:", fullSql);
      const queryResult = await runBigQueryQuery(userId, fullSql);
      console.log("Query results:", queryResult.rows.length, "rows");

      // Check if this is a dimensional query (has GROUP BY)
      const hasGroupBy = fullSql.toLowerCase().includes('group by');

      // Check if we have analytical insights or visualization recommendations from the enhanced NLP response
      const visualizationRecommendations = result.visualizationRecommendations || [];
      const analyticalInsights = result.analyticalInsights || [];

      // Check if this query is requesting a visualization/graph or if the NLP service detected visualization intent
      const visualizationKeywords = ['graph', 'chart', 'plot', 'visualization', 'visualize', 'visual'];
      const requestsVisualization = visualizationKeywords.some(keyword =>
        userQuery.toLowerCase().includes(keyword)
      ) || result.requestsVisualization || visualizationRecommendations.length > 0;

      // If visualization is requested or if we have analytical insights, generate a comprehensive report
      if (requestsVisualization || analyticalInsights.length > 0) {
        try {
          // Import the report generation service
          const reportGenerationService = require('../reports/services/reportGenerationService');
          const visualizationService = require('../reports/services/visualizationService');
          const insightService = require('../reports/services/insightService');
          const narrativeService = require('../reports/services/narrativeService');

          // Generate visualizations - automatically choose the best ones based on data
          const visualizations = await visualizationService.generateVisualizations(
            queryResult.rows,
            fullSql,
            columns,
            'standard'
          );

          // Extract insights - either use existing insights or generate new ones
          // Note: We're keeping any insights extracted from the AI response as they're direct analysis
          const insights = analyticalInsights.length > 0
            ? analyticalInsights.map(insight => ({
                type: 'insight',
                title: 'Data Insight',
                description: insight.content
              }))
            : await insightService.extractInsights(
                queryResult.rows,
                fullSql,
                columns,
                'standard'
              );

          // Generate a direct analytical narrative - we're removing the visualization recommendations
          // since we want the narrative to focus solely on data analysis
          const narrative = await narrativeService.generateNarrative(
            userQuery,
            queryResult.rows,
            insights,
            dataset,
            'standard'
          );

          // Return enhanced response with visualizations and insights
          return res.json({
            results: queryResult.rows,
            prompt: userQuery,
            sql: result.sqlQuery,
            fullSql: fullSql,
            aiResponse: result.aiResponse,
            retries: result.retries,
            isDimensionalQuery: hasGroupBy,
            visualizations: visualizations,
            insights: insights,
            narrative: narrative,
            metadata: {
              totalRows: queryResult.metadata.totalRows,
              datasetName: dataset.name,
              datasetId
            }
          });
        } catch (visualizationError) {
          console.error("Error generating visualizations:", visualizationError);
          // Continue with normal response if visualization generation fails
        }
      }

      // Standard response without visualizations
      res.json({
        results: queryResult.rows,
        prompt: userQuery,
        sql: result.sqlQuery, // Return the original SQL for reference
        fullSql: fullSql,
        aiResponse: result.aiResponse,
        retries: result.retries,
        isDimensionalQuery: hasGroupBy,
        metadata: {
          totalRows: queryResult.metadata.totalRows,
          datasetName: dataset.name,
          datasetId
        }
      });
    } catch (queryError) {
      console.error("Error executing BigQuery:", queryError);

      // Return the error without falling back to generic queries
      return res.status(500).json({
        success: false,
        error: `Error executing the generated SQL query. ${queryError.message}`,
        prompt: userQuery,
        sql: result.sqlQuery,
        fullSql: fullSql
      });
    }
  } catch (error) {
    console.error("Error processing query:", error);

    // Determine appropriate status code
    let statusCode = 500;
    if (error instanceof ValidationError) {
      statusCode = 400;
    } else if (error instanceof NotFoundError) {
      statusCode = 404;
    } else if (error.message.includes('authentication') || error.message.includes('Authorization')) {
      statusCode = 401;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message,
      prompt: req.body.userQuery
    });
  }
};

module.exports = {
  generateAndExecuteQuery
};