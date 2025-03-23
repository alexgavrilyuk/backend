// modules/queries/services/sqlGenerator.js

/**
 * Handles SQL generation from natural language using OpenAI
 * Manages both simple and complex query generation
 */

const { OpenAI } = require('openai');
const SchemaProcessor = require('./schemaProcessor');
const SqlValidator = require('./sqlValidator');
const AnalyticsExtractor = require('./analyticsExtractor');
const dataProcessing = require('../../dataProcessing');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Handle a complex query requiring multiple SQL operations
 * @param {string} query - Natural language query
 * @param {Array} columns - Dataset columns
 * @param {string} datasetName - Name of the dataset
 * @param {Object} datasetContext - Dataset context information
 * @param {Object} complexityAnalysis - Result of complexity analysis
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Promise<Object>} Complex query result
 */
async function handleComplexQuery(query, columns, datasetName, datasetContext, complexityAnalysis, conversationHistory) {
  console.log("Handling complex query with multi-query approach");

  // Create query plan with component queries
  const queryPlan = await dataProcessing.queryPlanner.createQueryPlan(
    query,
    columns,
    { name: datasetName, ...datasetContext },
    complexityAnalysis
  );

  console.log("Generated query plan:", JSON.stringify(queryPlan, null, 2));

  // Create execution sequence
  const executionSequence = dataProcessing.queryPlanner.generateExecutionSequence(queryPlan);

  console.log("Execution sequence determined with", executionSequence.length, "steps");

  // Return the complex query info
  return {
    isComplex: true,
    sqlQuery: null, // No single SQL query for complex queries
    queryPlan: queryPlan,
    executionSequence: executionSequence,
    prompt: query,
    queryType: complexityAnalysis.queryType || 'complex',
    retries: 0
  };
}

/**
 * Generate a single enhanced SQL query using OpenAI
 * @param {string} naturalLanguageQuery - Natural language query
 * @param {Array} columns - Dataset columns
 * @param {string} datasetName - Name of the dataset
 * @param {Object} datasetContext - Dataset context information
 * @param {Array} conversationHistory - Previous conversation messages
 * @param {boolean} requestsVisualization - Whether the query requests visualization
 * @param {number} retryCount - Number of retries attempted
 * @returns {Promise<Object>} SQL query result
 */
async function generateEnhancedSqlQuery(naturalLanguageQuery, columns, datasetName, datasetContext, conversationHistory = [], requestsVisualization = false, retryCount = 0) {
  console.log("Generating enhanced SQL query");

  // Format previous conversation for context
  const previousConversation = conversationHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  // Detect query patterns
  const queryPatterns = SchemaProcessor.detectQueryPatterns(naturalLanguageQuery);

  // Generate system prompt with all required context
  const systemContent = SchemaProcessor.generateSystemPrompt(
    columns,
    datasetName,
    datasetContext,
    {
      ...queryPatterns,
      requestsVisualization
    }
  );

  // Create the system message
  const systemMessage = {
    role: 'system',
    content: systemContent
  };

  try {
    // Create messages array with system message, conversation history, and current query
    const messages = [
      systemMessage,
      ...previousConversation,
      { role: 'user', content: naturalLanguageQuery }
    ];

    console.log("Sending request to OpenAI with", messages.length, "messages");

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
    });

    const aiResponse = response.choices[0].message.content;
    console.log("Received AI response:", aiResponse.substring(0, 100) + "...");

    // Process the AI response
    const processedResponse = AnalyticsExtractor.processAiResponse(aiResponse);

    if (!processedResponse.sqlQuery) {
      // Check if we should retry
      if (retryCount < 2) {  // Allow up to 3 total attempts (0, 1, 2)
        console.log(`No SQL query found in AI response. Retrying (attempt ${retryCount + 2}/3)...`);
        return generateEnhancedSqlQuery(naturalLanguageQuery, columns, datasetName, datasetContext, conversationHistory, requestsVisualization, retryCount + 1);
      }

      return {
        error: 'Could not generate a valid SQL query. ' + aiResponse,
        prompt: naturalLanguageQuery,
        aiResponse,
        retries: retryCount
      };
    }

    const sqlQuery = processedResponse.sqlQuery;
    console.log("Generated SQL query:", sqlQuery);

    // Special case for "show me all data" or similar queries
    if (naturalLanguageQuery.toLowerCase().match(/show\s+(?:me\s+)?(?:all|everything|data)/i) &&
        !sqlQuery.trim().toLowerCase().startsWith('select *')) {
      console.log('Adjusting query to use SELECT * for "show all" type query');
      return {
        sqlQuery: 'SELECT *',
        prompt: naturalLanguageQuery,
        aiResponse,
        retries: retryCount,
        visualizationRecommendations: AnalyticsExtractor.extractVisualizationRecommendations(aiResponse),
        analyticalInsights: AnalyticsExtractor.extractAnalyticalInsights(aiResponse)
      };
    }

    // Special case for "show me X in year Y" type queries
    if (naturalLanguageQuery.toLowerCase().includes('show me') &&
        /\b(in|for)\b\s+(\d{4})\b/i.test(naturalLanguageQuery) &&
        !sqlQuery.trim().toLowerCase().startsWith('select *')) {
      console.log('Adjusting to ensure SELECT * for show-type query');
      // If query doesn't start with SELECT *, modify it to include all columns
      if (sqlQuery.trim().toLowerCase().startsWith('select') && !sqlQuery.trim().toLowerCase().startsWith('select *')) {
        // Extract WHERE clause if it exists
        const whereMatch = sqlQuery.match(/\bWHERE\b.+/i);
        const whereClause = whereMatch ? whereMatch[0] : '';

        // Extract ORDER BY clause if it exists
        const orderByMatch = sqlQuery.match(/\bORDER BY\b.+/i);
        const orderByClause = orderByMatch ? orderByMatch[0] : '';

        // Create new query with SELECT * plus any WHERE and ORDER BY clauses
        const modifiedQuery = `SELECT * ${whereClause} ${orderByClause}`.trim();
        return {
          sqlQuery: modifiedQuery,
          prompt: naturalLanguageQuery,
          aiResponse,
          retries: retryCount,
          visualizationRecommendations: AnalyticsExtractor.extractVisualizationRecommendations(aiResponse),
          analyticalInsights: AnalyticsExtractor.extractAnalyticalInsights(aiResponse)
        };
      }
    }

    // Validate the SQL query against column names
    const isValid = SqlValidator.validateSqlQuery(sqlQuery, columns);

    if (!isValid.valid) {
      // Retry with more explicit instructions if there are validation errors
      if (retryCount < 2) {
        console.log(`SQL validation failed: ${isValid.error}. Retrying (attempt ${retryCount + 2}/3)...`);

        // Add validation error to conversation history for context
        const validationMessage = {
          role: 'system',
          content: `The SQL query you generated has the following issue: ${isValid.error}.

IMPORTANT:
1. If you are referencing columns that contain spaces like "RETAIL SALES" or "WAREHOUSE SALES", you MUST enclose them in backticks like \`RETAIL SALES\` or \`WAREHOUSE SALES\`.
2. DO NOT include a FROM clause or table name in your SQL query.
3. ALWAYS use single quotes for string literals in WHERE clauses (e.g., WHERE Client = 'Pfizer')
4. SQL functions like EXTRACT(YEAR FROM \`Date\`) are perfectly valid - the FROM keyword is allowed when it's part of a function.
5. Column aliases (after AS) don't need to be existing columns or use backticks.
6. For NON-dimensional queries (without GROUP BY), use "SELECT *" to include all columns in the result.

Examples:
- INCORRECT: SELECT RETAIL SALES, WAREHOUSE SALES FROM table
- INCORRECT: SELECT "RETAIL SALES", "WAREHOUSE SALES" FROM any_table_name
- INCORRECT: WHERE Client = Pfizer
- CORRECT: SELECT \`RETAIL SALES\`, \`WAREHOUSE SALES\`
- CORRECT: SELECT * WHERE YEAR = 2020
- CORRECT: WHERE Client = 'Pfizer'
- CORRECT: WHERE EXTRACT(YEAR FROM \`Date\`) = 2023
- CORRECT: SELECT SUM(CAST(\`RETAIL SALES\` AS FLOAT64)) AS total_sales
- CORRECT: SELECT YEAR, SUM(CAST(\`RETAIL SALES\` AS FLOAT64)) AS total_retail_sales, SUM(CAST(\`WAREHOUSE SALES\` AS FLOAT64)) AS total_warehouse_sales GROUP BY YEAR

The system will automatically add the appropriate FROM clause when executing the query.
Please correct your query and ensure you only use columns that exist in the dataset schema.`
        };

        return generateEnhancedSqlQuery(
          naturalLanguageQuery,
          columns,
          datasetName,
          datasetContext,
          [...previousConversation, validationMessage],
          requestsVisualization,
          retryCount + 1
        );
      }

      return {
        error: `Invalid SQL query: ${isValid.error}`,
        prompt: naturalLanguageQuery,
        aiResponse,
        retries: retryCount
      };
    }

    // Extract visualization recommendations and analytical insights
    const visualizationRecommendations = AnalyticsExtractor.extractVisualizationRecommendations(aiResponse);
    const analyticalInsights = AnalyticsExtractor.extractAnalyticalInsights(aiResponse);

    return {
      sqlQuery,
      prompt: naturalLanguageQuery,
      aiResponse,
      retries: retryCount,
      isComplex: false,
      hasContextRefs: AnalyticsExtractor.detectContextReferences(naturalLanguageQuery, conversationHistory),
      visualizationRecommendations,
      analyticalInsights,
      requestsVisualization
    };
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    if (retryCount < 2) {
      console.log(`Error: ${error.message}. Retrying (attempt ${retryCount + 2}/3)...`);
      return generateEnhancedSqlQuery(naturalLanguageQuery, columns, datasetName, datasetContext, conversationHistory, requestsVisualization, retryCount + 1);
    }
    return { error: error.message, prompt: naturalLanguageQuery, retries: retryCount };
  }
}

module.exports = {
  handleComplexQuery,
  generateEnhancedSqlQuery
};