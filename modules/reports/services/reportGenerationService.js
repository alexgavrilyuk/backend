// modules/reports/services/reportGenerationService.js

const { runBigQueryQuery } = require('../../bigquery');
const { naturalLanguageToSql } = require('../../queries/services/nlpService');
const visualizationService = require('./visualizationService');
const insightService = require('./insightService');
const narrativeService = require('./narrativeService');
const db = require('../../datasets/models');

/**
 * Orchestrates the full report generation process
 * Coordinates between SQL generation, data retrieval, and report assembly
 */
class ReportGenerationService {
  /**
   * Generate a complete report based on a natural language query
   * @param {Object} params - Report generation parameters
   * @param {string} params.query - The natural language query
   * @param {string} params.datasetId - Dataset ID
   * @param {string} params.userId - User ID
   * @param {Object} params.dataset - Dataset object
   * @param {Array} params.columns - Dataset columns
   * @param {string} params.reportId - Report ID
   * @param {string} params.reportType - Type of report to generate
   * @param {Array} params.conversationHistory - Previous conversation messages
   * @returns {Promise<Object>} Generated report data
   */
  async generateReport({
    query,
    datasetId,
    userId,
    dataset,
    columns,
    reportId,
    reportType = 'standard',
    conversationHistory = []
  }) {
    try {
      console.log(`Starting report generation for query: "${query}"`);

      // 1. Generate SQL from natural language query
      const sqlResult = await this.generateSqlQuery(query, columns, dataset, conversationHistory);

      // 2. Execute the SQL query against BigQuery
      const queryResult = await this.executeQuery(userId, sqlResult.sqlQuery, datasetId);

      // 3. Generate visualizations based on data
      const visualizations = await visualizationService.generateVisualizations(
        queryResult.rows,
        sqlResult.sqlQuery,
        columns,
        reportType
      );

      // 4. Extract insights from data
      const insights = await insightService.extractInsights(
        queryResult.rows,
        sqlResult.sqlQuery,
        columns,
        reportType
      );

      // 5. Generate narrative explanation
      const narrative = await narrativeService.generateNarrative(
        query,
        queryResult.rows,
        insights,
        dataset,
        reportType
      );

      // 6. Assemble complete report
      const reportData = {
        generatedSql: sqlResult.sqlQuery,
        fullSql: sqlResult.fullSql || sqlResult.sqlQuery,
        data: queryResult.rows,
        visualizations,
        insights,
        narrative,
        metadata: {
          totalRows: queryResult.metadata.totalRows,
          reportType,
          datasetName: dataset.name,
          datasetId,
          reportId,
          query
        }
      };

      console.log(`Report generation completed for reportId: ${reportId}`);
      return reportData;
    } catch (error) {
      console.error(`Report generation failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Generate a report for a complex query with multiple steps
   * @param {Object} params - Report generation parameters
   * @param {string} params.query - The natural language query
   * @param {string} params.datasetId - Dataset ID
   * @param {string} params.userId - User ID
   * @param {Object} params.dataset - Dataset object
   * @param {Array} params.columns - Dataset columns
   * @param {Object} params.queryPlan - Query plan for complex query
   * @param {Array} params.executionSequence - Execution sequence for query steps
   * @param {Array} params.conversationHistory - Previous conversation
   * @returns {Promise<Object>} Generated report data
   */
  async generateComplexReport({
    query,
    datasetId,
    userId,
    dataset,
    columns,
    queryPlan,
    executionSequence,
    conversationHistory = []
  }) {
    try {
      console.log(`Starting complex report generation for query: "${query}"`);
      console.log("Columns available:", columns.map(c => c.name).join(", "));
      console.log("Execution sequence:", JSON.stringify(executionSequence));
      console.log("Query plan steps:", JSON.stringify(queryPlan.steps.map(s => s.id)));

      // Execute each step in the query plan
      const stepResults = {};

      // Process each step in the execution sequence
      for (let i = 0; i < executionSequence.length; i++) {
        // Extract the step ID from the object or use the value directly if it's a string
        const stepItem = executionSequence[i];
        const stepId = typeof stepItem === 'object' && stepItem.id ? stepItem.id : stepItem;

        console.log(`Looking for step ${stepId} in query plan`);

        const step = queryPlan.steps.find(s => s.id === stepId);
        if (!step) {
          console.log(`Step ${stepId} not found in query plan, skipping`);
          continue;
        }

        console.log(`Executing step ${stepId}: ${step.description}`);

        try {
          // Generate SQL for this specific step
          const result = await this.generateSqlForQueryStep(step.query, columns, dataset, conversationHistory);
          console.log(`Generated SQL for step ${stepId}: ${result.sqlQuery}`);

          // Execute the SQL query
          const queryResult = await this.executeQuery(userId, result.sqlQuery, datasetId);
          console.log(`Step ${stepId} executed, returned ${queryResult.rows.length} rows`);

          if (queryResult.rows.length > 0) {
            console.log(`Sample data for step ${stepId}:`, queryResult.rows.slice(0, 1));
          } else {
            console.log(`No data returned for step ${stepId}`);
          }

          // Store the results for this step
          stepResults[stepId] = queryResult.rows;
        } catch (error) {
          console.error(`Error executing step ${stepId}:`, error);
          // Continue with other steps even if this one failed
        }
      }

      console.log("All steps executed. Results available for steps:", Object.keys(stepResults).join(", "));

      // Log row counts for debugging
      for (const [stepId, rows] of Object.entries(stepResults)) {
        console.log(`Step ${stepId} has ${rows.length} rows`);
      }

      // Generate separate visualizations for client data (step2) and therapy area data (step4)
      console.log("Generating visualizations for step results");

      let allVisualizations = [];

      // Client visualizations
      if (stepResults.step2 && stepResults.step2.length > 0) {
        console.log(`Generating visualizations for client data (${stepResults.step2.length} rows)`);
        const clientVisualizations = await visualizationService.generateVisualizations(
          stepResults.step2,
          '',
          columns,
          'standard',
          { title: "Top Clients by Sales" }
        );

        console.log(`Generated ${clientVisualizations.length} client visualizations`);
        allVisualizations = allVisualizations.concat(clientVisualizations);
      } else {
        console.log("No client data available for visualizations");
      }

      // Therapy area visualizations
      if (stepResults.step4 && stepResults.step4.length > 0) {
        console.log(`Generating visualizations for therapy area data (${stepResults.step4.length} rows)`);
        const therapyAreaVisualizations = await visualizationService.generateVisualizations(
          stepResults.step4,
          '',
          columns,
          'standard',
          { title: "Top Therapy Areas by Sales" }
        );

        console.log(`Generated ${therapyAreaVisualizations.length} therapy area visualizations`);
        allVisualizations = allVisualizations.concat(therapyAreaVisualizations);
      } else {
        console.log("No therapy area data available for visualizations");
      }

      console.log(`Total visualizations generated: ${allVisualizations.length}`);

      // Extract insights from all results
      const allInsights = [];

      // Client insights
      if (stepResults.step2 && stepResults.step2.length > 0) {
        console.log("Extracting insights from client data");
        const clientInsights = await insightService.extractInsights(
          stepResults.step2,
          '',
          columns,
          'standard',
          { title: "Client Analysis" }
        );

        if (clientInsights && clientInsights.length > 0) {
          console.log(`Extracted ${clientInsights.length} client insights`);
          allInsights.push(...clientInsights);
        }
      }

      // Therapy area insights
      if (stepResults.step4 && stepResults.step4.length > 0) {
        console.log("Extracting insights from therapy area data");
        const therapyAreaInsights = await insightService.extractInsights(
          stepResults.step4,
          '',
          columns,
          'standard',
          { title: "Therapy Area Analysis" }
        );

        if (therapyAreaInsights && therapyAreaInsights.length > 0) {
          console.log(`Extracted ${therapyAreaInsights.length} therapy area insights`);
          allInsights.push(...therapyAreaInsights);
        }
      }

      console.log(`Total insights extracted: ${allInsights.length}`);

      // Generate narrative with context from all data
      console.log("Generating narrative");
      const narrative = await narrativeService.generateNarrative(
        query,
        null, // No combined data
        allInsights,
        dataset,
        'standard',
        stepResults // Pass all step results for context
      );

      // Prepare data for response
      // Use both client and therapy area data when available
      const combinedData = [];

      // Add labeled client data
      if (stepResults.step2 && stepResults.step2.length > 0) {
        const clientData = stepResults.step2.map(row => ({
          ...row,
          dataType: 'client'
        }));
        combinedData.push(...clientData);
      }

      // Add labeled therapy area data
      if (stepResults.step4 && stepResults.step4.length > 0) {
        const therapyAreaData = stepResults.step4.map(row => ({
          ...row,
          dataType: 'therapyArea'
        }));
        combinedData.push(...therapyAreaData);
      }

      // Assemble complete report
      const reportData = {
        data: combinedData,
        stepResults,
        visualizations: allVisualizations,
        insights: allInsights,
        narrative,
        metadata: {
          reportType: 'complex',
          datasetName: dataset.name,
          datasetId,
          query
        }
      };

      console.log(`Complex report generation completed with ${allVisualizations.length} visualizations`);
      return reportData;
    } catch (error) {
      console.error(`Complex report generation failed: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Generate SQL query from natural language using NLP service
   * @param {string} query - Natural language query
   * @param {Array} columns - Dataset columns
   * @param {Object} dataset - Dataset object
   * @param {Array} conversationHistory - Previous conversation messages
   * @returns {Promise<Object>} SQL query result
   */
  async generateSqlQuery(query, columns, dataset, conversationHistory) {
    try {
      // Use existing NLP service to generate SQL
      const result = await naturalLanguageToSql(
        query,
        columns,
        dataset.name,
        conversationHistory
      );

      if (result.error) {
        throw new Error(`Could not generate SQL query: ${result.error}`);
      }

      // Get formatted columns for logging
      const columnNames = columns.map(c => c.name).join(', ');
      console.log(`Generated SQL for query "${query}" with columns: ${columnNames}`);
      console.log(`SQL: ${result.sqlQuery}`);

      return {
        sqlQuery: result.sqlQuery,
        fullSql: result.fullSql,
        prompt: query,
        aiResponse: result.aiResponse
      };
    } catch (error) {
      console.error('Error generating SQL query:', error);
      throw new Error(`Failed to generate SQL query: ${error.message}`);
    }
  }

  /**
   * Generate SQL query for a specific query step
   * @param {string} stepQuery - Natural language query for this step
   * @param {Array} columns - Dataset columns
   * @param {Object} dataset - Dataset object
   * @param {Array} conversationHistory - Previous conversation
   * @returns {Promise<Object>} SQL query result
   */
  async generateSqlForQueryStep(stepQuery, columns, dataset, conversationHistory) {
    try {
      console.log(`Generating SQL for step query: "${stepQuery}"`);

      // For steps involving clients
      if (stepQuery.toLowerCase().includes('client')) {
        // Find client column
        const clientCol = columns.find(col =>
          col.name.toLowerCase().includes('client') ||
          col.name.toLowerCase() === 'customer' ||
          (col.description && col.description.toLowerCase().includes('client'))
        );

        // Find amount column
        const amountCol = columns.find(col =>
          col.name.toLowerCase().includes('amount') ||
          col.name.toLowerCase().includes('sale') ||
          col.name.toLowerCase().includes('revenue') ||
          (col.description && (
            col.description.toLowerCase().includes('amount') ||
            col.description.toLowerCase().includes('sale') ||
            col.description.toLowerCase().includes('revenue')
          ))
        );

        if (clientCol && amountCol) {
          console.log(`Found client column: ${clientCol.name} and amount column: ${amountCol.name}`);

          // Create direct SQL
          const clientName = clientCol.name.includes(' ') ? `\`${clientCol.name}\`` : clientCol.name;
          const amountName = amountCol.name.includes(' ') ? `\`${amountCol.name}\`` : amountCol.name;

          // For numeric columns, use CAST to ensure proper aggregation
          const castClause = amountCol.type === 'string'
            ? `CAST(${amountName} AS FLOAT64)`
            : amountName;

          // Determine limit based on step query
          const limitMatch = stepQuery.match(/top\s+(\d+)/i) || stepQuery.match(/(\d+)/);
          const limit = limitMatch ? parseInt(limitMatch[1]) : 10;

          const sqlQuery = `SELECT ${clientName}, SUM(${castClause}) AS total_amount
                            FROM ...
                            GROUP BY ${clientName}
                            ORDER BY total_amount DESC
                            LIMIT ${limit}`;

          console.log(`Generated direct SQL for client step: ${sqlQuery}`);

          return {
            sqlQuery,
            prompt: stepQuery,
            aiResponse: null
          };
        }
      }

      // For steps involving therapy areas
      if (stepQuery.toLowerCase().includes('therapy') || stepQuery.toLowerCase().includes('area')) {
        // Find therapy area column
        const therapyAreaCol = columns.find(col =>
          col.name.toLowerCase().includes('therapy') ||
          col.name.toLowerCase().includes('area') ||
          col.name.toLowerCase().includes('ta') ||
          col.name.toLowerCase().includes('therapeutic') ||
          col.name.toLowerCase().includes('indication') ||
          (col.description && (
            col.description.toLowerCase().includes('therapy') ||
            col.description.toLowerCase().includes('therapeutic') ||
            col.description.toLowerCase().includes('area')
          ))
        );

        // Find amount column
        const amountCol = columns.find(col =>
          col.name.toLowerCase().includes('amount') ||
          col.name.toLowerCase().includes('sale') ||
          col.name.toLowerCase().includes('revenue') ||
          (col.description && (
            col.description.toLowerCase().includes('amount') ||
            col.description.toLowerCase().includes('sale') ||
            col.description.toLowerCase().includes('revenue')
          ))
        );

        if (therapyAreaCol && amountCol) {
          console.log(`Found therapy area column: ${therapyAreaCol.name} and amount column: ${amountCol.name}`);

          // Create direct SQL
          const therapyAreaName = therapyAreaCol.name.includes(' ') ? `\`${therapyAreaCol.name}\`` : therapyAreaCol.name;
          const amountName = amountCol.name.includes(' ') ? `\`${amountCol.name}\`` : amountCol.name;

          // For numeric columns, use CAST to ensure proper aggregation
          const castClause = amountCol.type === 'string'
            ? `CAST(${amountName} AS FLOAT64)`
            : amountName;

          // Determine limit based on step query
          const limitMatch = stepQuery.match(/top\s+(\d+)/i) || stepQuery.match(/(\d+)/);
          const limit = limitMatch ? parseInt(limitMatch[1]) : 10;

          const sqlQuery = `SELECT ${therapyAreaName}, SUM(${castClause}) AS total_amount
                            FROM ...
                            GROUP BY ${therapyAreaName}
                            ORDER BY total_amount DESC
                            LIMIT ${limit}`;

          console.log(`Generated direct SQL for therapy area step: ${sqlQuery}`);

          return {
            sqlQuery,
            prompt: stepQuery,
            aiResponse: null
          };
        }
      }

      // For combination steps
      if (stepQuery.toLowerCase().includes('combine') ||
          stepQuery.toLowerCase().includes('merge') ||
          stepQuery.toLowerCase().includes('report')) {
        console.log("This is a combination step, will use previous step results");

        return {
          sqlQuery: `SELECT * FROM ... LIMIT 100`,  // Placeholder query
          prompt: stepQuery,
          aiResponse: null
        };
      }

      // Default: fall back to using the NLP service
      console.log("Using NLP service to generate SQL for step");
      const { naturalLanguageToSql } = require('../../queries/services/nlpService');

      // Make the query more concrete for the NLP service by adding specifics about the dataset
      const enhancedQuery = `From the dataset ${dataset.name}, ${stepQuery} Specifically, show the exact columns needed for this step.`;

      // Generate SQL for this step
      const result = await naturalLanguageToSql(
        enhancedQuery,
        columns,
        dataset.name,
        conversationHistory
      );

      if (result.error) {
        console.error(`NLP service couldn't generate SQL: ${result.error}`);
        // Fallback to a simple query for this step
        const fallbackSql = this.generateFallbackSql(stepQuery, columns);
        return {
          sqlQuery: fallbackSql,
          prompt: stepQuery,
          aiResponse: null
        };
      }

      return {
        sqlQuery: result.sqlQuery,
        prompt: stepQuery,
        aiResponse: result.aiResponse
      };
    } catch (error) {
      console.error('Error generating SQL for query step:', error);

      // Important: provide fallback SQL rather than failing completely
      const fallbackSql = this.generateFallbackSql(stepQuery, columns);
      return {
        sqlQuery: fallbackSql,
        prompt: stepQuery,
        aiResponse: null
      };
    }
  }

  /**
   * Generate fallback SQL for when NLP services fail
   * @param {string} stepQuery - The step query description
   * @param {Array} columns - Dataset columns
   * @returns {string} Fallback SQL query
   */
  generateFallbackSql(stepQuery, columns) {
    console.log(`Generating fallback SQL for step: ${stepQuery}`);

    let dimensionCol = null;
    let dimensionName = "unknown_dimension";

    // Try to identify dimension column based on step query
    if (stepQuery.toLowerCase().includes('client')) {
      dimensionCol = columns.find(col =>
        col.name.toLowerCase().includes('client') ||
        col.name.toLowerCase() === 'customer'
      );
      dimensionName = "client";
    } else if (stepQuery.toLowerCase().includes('therapy') || stepQuery.toLowerCase().includes('area')) {
      dimensionCol = columns.find(col =>
        col.name.toLowerCase().includes('therapy') ||
        col.name.toLowerCase().includes('area') ||
        col.name.toLowerCase().includes('ta') ||
        col.name.toLowerCase().includes('indication')
      );
      dimensionName = "therapy_area";
    }

    // Find amount column
    const amountCol = columns.find(col =>
      col.name.toLowerCase().includes('amount') ||
      col.name.toLowerCase().includes('sale') ||
      col.name.toLowerCase().includes('revenue')
    );

    console.log(`Fallback SQL generation - Dimension: ${dimensionCol?.name || 'Not found'}, Amount: ${amountCol?.name || 'Not found'}`);

    // If we find dimension and amount columns, create a simple aggregation
    if (dimensionCol && amountCol) {
      const colName = dimensionCol.name.includes(' ') ? `\`${dimensionCol.name}\`` : dimensionCol.name;
      const amountName = amountCol.name.includes(' ') ? `\`${amountCol.name}\`` : amountCol.name;

      // Get limit from query if available
      const limitMatch = stepQuery.match(/top\s+(\d+)/i) || stepQuery.match(/(\d+)/);
      const limit = limitMatch ? parseInt(limitMatch[1]) : 10;

      return `SELECT ${colName}, SUM(${amountName}) AS total_amount FROM ... GROUP BY ${colName} ORDER BY total_amount DESC LIMIT ${limit}`;
    }

    // Default fallback - just select everything
    return `SELECT * FROM ... LIMIT 100`;
  }

  /**
   * Execute SQL query against BigQuery
   * @param {string} userId - User ID
   * @param {string} sql - SQL query to execute
   * @param {string} datasetId - Dataset ID
   * @returns {Promise<Object>} Query results
   */
  async executeQuery(userId, sql, datasetId) {
    try {
      // Construct the table reference
      const userDataset = `user_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const tableId = `dataset_${datasetId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const tableReference = `\`${process.env.GCP_PROJECT_ID}.${userDataset}.${tableId}\``;

      // Replace placeholder patterns with the actual table reference
      // 1. Replace "FROM ..." pattern
      sql = sql.replace(/FROM\s+\.\.\./gi, `FROM ${tableReference}`);

      // 2. Replace standalone "..." placeholder (if any remain)
      sql = sql.replace(/\.\.\./g, tableReference);

      // 3. Add FROM clause if missing entirely
      if (!sql.toLowerCase().includes(' from ')) {
        sql = `${sql} FROM ${tableReference}`;
      }

      console.log(`Executing query: ${sql}`);
      console.log(`Full SQL query before execution: ${sql}`);
      console.log(`Query length: ${sql.length}`);
      console.log(`Query length in bytes: ${Buffer.from(sql).length}`);
      console.log(`Query string: ${sql}`);

      // Use existing BigQuery service to execute query
      const results = await runBigQueryQuery(userId, sql);
      console.log(`Query executed successfully, returned ${results.rows.length} rows`);

      return results;
    } catch (error) {
      console.error('Error executing BigQuery query:', error);
      throw new Error(`Failed to execute query: ${error.message}`);
    }
  }
}

// Export a singleton instance
module.exports = new ReportGenerationService();