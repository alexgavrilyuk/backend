// modules/dataProcessing/queryPlanner.js

const { OpenAI } = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Analyzes complex queries to determine when multiple SQL queries are needed
 * Breaks down complex questions into simpler, executable queries
 * Creates execution plans with dependencies between queries
 */

/**
 * Analyze a natural language query to determine if it requires multiple queries
 * @param {string} query - Natural language query
 * @param {Array} columns - Dataset columns
 * @param {Object} dataset - Dataset metadata
 * @returns {Promise<Object>} Analysis result with complexity assessment
 */
async function analyzeQueryComplexity(query, columns, dataset) {
  try {
    console.log(`Analyzing complexity of query: "${query}"`);

    // Check for simple query patterns that don't need decomposition
    if (isSimpleQuery(query)) {
      return {
        isComplex: false,
        reason: 'Simple query pattern detected',
        recommendedApproach: 'single-query'
      };
    }

    // Check for known complex patterns
    const complexityCheck = checkForComplexPatterns(query);
    if (complexityCheck.isComplex) {
      return complexityCheck;
    }

    // Use AI to analyze query complexity for more nuanced cases
    return await analyzeComplexityWithAI(query, columns, dataset);
  } catch (error) {
    console.error('Error analyzing query complexity:', error);
    // Default to treating as simple query on error
    return {
      isComplex: false,
      reason: 'Error during analysis, defaulting to simple query',
      recommendedApproach: 'single-query'
    };
  }
}

/**
 * Check if a query follows simple patterns that don't need decomposition
 * @param {string} query - Natural language query
 * @returns {boolean} True if the query is simple
 */
function isSimpleQuery(query) {
  const simplePatterns = [
    /^show me all/i,
    /^list all/i,
    /^what are the/i,
    /^get all/i,
    /^display/i,
    /^find records where/i
  ];

  // Check if the query matches any simple patterns
  return simplePatterns.some(pattern => pattern.test(query));
}

/**
 * Check for known complex query patterns
 * @param {string} query - Natural language query
 * @returns {Object} Complexity assessment
 */
function checkForComplexPatterns(query) {
  // Common patterns that indicate complex queries requiring multiple SQL operations

  // Pattern 1: Comparison across time periods
  if (/compare .+ (between|with) .+ (and|vs) .+/i.test(query) ||
      /how does .+ (compare|differ) .+ (last|previous|before)/i.test(query)) {
    return {
      isComplex: true,
      reason: 'Query involves comparison across different time periods',
      recommendedApproach: 'multi-query-comparison',
      queryType: 'temporal-comparison'
    };
  }

  // Pattern 2: Queries with multiple aggregations across different dimensions
  if (/(breakdown|break down) .+ by .+ and .+ by .+/i.test(query) ||
      /show .+ by .+ and .+ by .+/i.test(query)) {
    return {
      isComplex: true,
      reason: 'Query requires multiple aggregations across different dimensions',
      recommendedApproach: 'multi-query-aggregation',
      queryType: 'multi-dimensional-aggregation'
    };
  }

  // Pattern 3: Queries asking for trending and summary stats together
  if (/(trend|trends|trending) .+ (and|with) .+ (summary|overview|totals)/i.test(query) ||
      /(summary|overview) .+ (and|with) .+ (trend|trends|changes)/i.test(query)) {
    return {
      isComplex: true,
      reason: 'Query requests both trending data and summary statistics',
      recommendedApproach: 'multi-query-mixed',
      queryType: 'trend-and-summary'
    };
  }

  // Pattern 4: Queries asking for top/bottom performers and their details
  if (/(top|bottom|best|worst) .+ (and|with) .+ details/i.test(query) ||
      /identify .+ (performers|performing) .+ (and|with) .+ (details|breakdown)/i.test(query)) {
    return {
      isComplex: true,
      reason: 'Query requests top/bottom performers along with detailed information',
      recommendedApproach: 'multi-query-detail',
      queryType: 'performers-with-details'
    };
  }

  // Pattern 5: Queries involving predictions or forecasts with historical data
  if (/(forecast|predict|projection) .+ based on .+ (history|historical|past)/i.test(query) ||
      /(analyze|study) .+ (history|historical|past) .+ (and|to) .+ (forecast|predict)/i.test(query)) {
    return {
      isComplex: true,
      reason: 'Query involves generating predictions based on historical data',
      recommendedApproach: 'multi-query-predictive',
      queryType: 'historical-prediction'
    };
  }

  // Not a known complex pattern
  return {
    isComplex: false,
    reason: 'No complex pattern detected',
    recommendedApproach: 'single-query'
  };
}

/**
 * Use OpenAI to analyze query complexity for nuanced cases
 * @param {string} query - Natural language query
 * @param {Array} columns - Dataset columns
 * @param {Object} dataset - Dataset metadata
 * @returns {Promise<Object>} AI-generated complexity assessment
 */
async function analyzeComplexityWithAI(query, columns, dataset) {
  try {
    // Prepare dataset schema information
    const schemaInfo = columns.map(col => `${col.name} (${col.type})`).join(', ');

    // Prepare the system prompt
    const systemPrompt = `
      You are an expert SQL query planner. Your job is to analyze a natural language query
      and determine if it requires decomposition into multiple SQL queries or if it can be
      handled by a single SQL query. Focus on query complexity and data requirements.

      A query should be classified as complex (requiring multiple SQL queries) if it:
      1. Requires comparisons across different time periods
      2. Requests aggregations across different dimensions simultaneously
      3. Needs both detailed and summarized views of the same data
      4. Combines trends and point-in-time analyses
      5. Requires complex calculations that cannot be done in a single SQL statement

      Respond with a JSON object with these fields:
      - isComplex: boolean (true if multiple queries are needed)
      - reason: string (brief explanation of the decision)
      - recommendedApproach: string (one of: 'single-query', 'multi-query-comparison', 'multi-query-aggregation', 'multi-query-mixed', 'multi-query-detail')
      - queryComponents: array of strings (if complex, the different query components needed)
    `.trim();

    // Prepare context about the dataset
    const datasetContext = `
      Dataset: ${dataset.name}
      Schema: ${schemaInfo}
      ${dataset.context ? `Context: ${dataset.context}` : ''}
      ${dataset.purpose ? `Purpose: ${dataset.purpose}` : ''}
    `.trim();

    // Call OpenAI for complexity analysis
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `
          Natural language query: "${query}"

          Dataset information:
          ${datasetContext}

          Analyze this query and determine if it requires multiple SQL queries or can be handled by a single query.
          Remember to respond with only a JSON object as described.
        `}
      ],
      temperature: 0.1, // Low temperature for more predictable, analytical results
      response_format: { type: "json_object" }
    });

    // Parse and return the response
    const result = JSON.parse(response.choices[0].message.content);
    console.log('AI complexity analysis result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error analyzing complexity with AI:', error);
    // Default to simple query on error
    return {
      isComplex: false,
      reason: 'Error during AI analysis, defaulting to simple query',
      recommendedApproach: 'single-query'
    };
  }
}

/**
 * Create a query execution plan for a complex query
 * @param {string} query - Natural language query
 * @param {Array} columns - Dataset columns
 * @param {Object} dataset - Dataset metadata
 * @param {Object} complexityAnalysis - Result of complexity analysis
 * @returns {Promise<Object>} Query execution plan
 */
async function createQueryPlan(query, columns, dataset, complexityAnalysis) {
  try {
    console.log(`Creating query plan for: "${query}"`);

    // If not complex, return a simple plan
    if (!complexityAnalysis.isComplex) {
      return {
        type: 'simple',
        steps: [{
          id: 'main-query',
          description: 'Execute single query',
          query: query
        }]
      };
    }

    // Use AI to create a detailed query plan
    return await createQueryPlanWithAI(query, columns, dataset, complexityAnalysis);
  } catch (error) {
    console.error('Error creating query plan:', error);
    // Return a simple plan as fallback
    return {
      type: 'simple',
      error: 'Error creating detailed query plan',
      steps: [{
        id: 'fallback-query',
        description: 'Execute single query (fallback due to planning error)',
        query: query
      }]
    };
  }
}

/**
 * Use OpenAI to create a detailed query plan
 * @param {string} query - Natural language query
 * @param {Array} columns - Dataset columns
 * @param {Object} dataset - Dataset metadata
 * @param {Object} complexityAnalysis - Result of complexity analysis
 * @returns {Promise<Object>} Detailed query execution plan
 */
async function createQueryPlanWithAI(query, columns, dataset, complexityAnalysis) {
  try {
    // Prepare dataset schema information
    const schemaInfo = columns.map(col => `${col.name} (${col.type})`).join(', ');

    // Prepare the system prompt
    const systemPrompt = `
      You are an expert SQL query planner. Your job is to create a detailed execution plan
      for a complex natural language query that requires multiple SQL queries.

      For each query component, provide:
      1. A unique ID
      2. A clear description of what this query component does
      3. The natural language representation of this query component
      4. Any dependencies on other query components

      Respond with a JSON object with these fields:
      - type: string (always set to 'complex')
      - queryType: string (the type of complex query as identified in analysis)
      - steps: array of objects, each with:
        - id: string (unique identifier for this step)
        - description: string (what this query does)
        - query: string (natural language query for this component)
        - dependencies: array of strings (ids of steps this depends on, can be empty)
        - outputType: string (one of: 'raw-data', 'aggregated', 'comparison', 'summary')
    `.trim();

    // Prepare context about the dataset and complexity analysis
    const datasetContext = `
      Dataset: ${dataset.name}
      Schema: ${schemaInfo}
      ${dataset.context ? `Context: ${dataset.context}` : ''}
      ${dataset.purpose ? `Purpose: ${dataset.purpose}` : ''}

      Complexity analysis:
      ${JSON.stringify(complexityAnalysis, null, 2)}
    `.trim();

    // Call OpenAI for query plan creation
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `
          Natural language query: "${query}"

          Dataset information:
          ${datasetContext}

          Create a detailed execution plan for this complex query, breaking it down into
          multiple query components that can be executed separately and then combined.
          Remember to respond with only a JSON object as described.
        `}
      ],
      temperature: 0.2, // Low temperature for more consistent results
      response_format: { type: "json_object" }
    });

    // Parse and return the response
    const result = JSON.parse(response.choices[0].message.content);
    console.log('AI query plan result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Error creating query plan with AI:', error);
    // Return a simplified plan as fallback
    return {
      type: 'complex',
      error: 'Error creating detailed AI query plan',
      queryType: complexityAnalysis.queryType || 'unknown',
      steps: [
        {
          id: 'fallback-main-query',
          description: 'Execute main query component (fallback plan)',
          query: query,
          dependencies: [],
          outputType: 'raw-data'
        }
      ]
    };
  }
}

/**
 * Generate a sequence of execution steps from a query plan
 * @param {Object} queryPlan - The query execution plan
 * @returns {Array} Ordered sequence of execution steps
 */
function generateExecutionSequence(queryPlan) {
  // For simple plans, return the single step
  if (queryPlan.type === 'simple') {
    return queryPlan.steps;
  }

  // For complex plans, create a proper execution sequence considering dependencies
  const steps = [...queryPlan.steps];
  const executionSequence = [];
  const processed = new Set();

  // Helper function to check if all dependencies are satisfied
  const areDependenciesMet = (step) => {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }
    return step.dependencies.every(dep => processed.has(dep));
  };

  // Keep processing until all steps are in the sequence
  while (executionSequence.length < steps.length) {
    let progressMade = false;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Skip if already processed
      if (processed.has(step.id)) {
        continue;
      }

      // Add to sequence if dependencies are met
      if (areDependenciesMet(step)) {
        executionSequence.push(step);
        processed.add(step.id);
        progressMade = true;
      }
    }

    // If no progress was made in this iteration, there might be a dependency cycle
    if (!progressMade) {
      console.error('Dependency cycle detected in query plan');
      // Add remaining steps in arbitrary order to avoid endless loop
      for (const step of steps) {
        if (!processed.has(step.id)) {
          executionSequence.push({
            ...step,
            dependencyWarning: 'Added out of order due to possible dependency cycle'
          });
          processed.add(step.id);
        }
      }
    }
  }

  return executionSequence;
}

module.exports = {
  analyzeQueryComplexity,
  createQueryPlan,
  generateExecutionSequence
};