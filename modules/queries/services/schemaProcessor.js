// modules/queries/services/schemaProcessor.js

/**
 * Handles schema processing and description generation for AI prompts
 * Extracts and formats dataset metadata for improved query generation
 */

/**
 * Generate a schema description for AI prompt based on dataset columns
 * @param {Array} columns - The dataset columns
 * @param {string} datasetName - Name of the dataset
 * @param {object} datasetContext - Optional dataset context information
 * @returns {string} - Formatted schema description
 */
function generateSchemaDescription(columns, datasetName, datasetContext = {}) {
  let description = `DATASET: ${datasetName}\n\n`;

  // Add dataset context information if available
  if (datasetContext) {
    if (datasetContext.context) {
      description += `DATASET CONTEXT: ${datasetContext.context}\n\n`;
    }

    if (datasetContext.purpose) {
      description += `DATASET PURPOSE: ${datasetContext.purpose}\n\n`;
    }

    if (datasetContext.source) {
      description += `DATASET SOURCE: ${datasetContext.source}\n\n`;
    }

    if (datasetContext.notes) {
      description += `ADDITIONAL NOTES: ${datasetContext.notes}\n\n`;
    }
  }

  // Determine column types and characteristics
  const numericColumns = columns.filter(col => col.type === 'integer' || col.type === 'float');
  const dateColumns = columns.filter(col => col.type === 'date');
  const categoricalColumns = columns.filter(col => col.type === 'string' && col.description &&
                                          (col.description.toLowerCase().includes('category') ||
                                          col.name.toLowerCase().includes('category') ||
                                          col.name.toLowerCase().includes('type') ||
                                          col.name.toLowerCase().includes('region') ||
                                          col.name.toLowerCase().includes('status')));

  description += `The dataset has the following columns:\n`;

  // Check if we have any columns with spaces
  const hasColumnsWithSpaces = columns.some(col => col.name.includes(' '));

  // Group columns by type for better analysis context
  const columnsByType = {
    numeric: [],
    date: [],
    categorical: [],
    other: []
  };

  // Add each column with its type and properties
  for (const column of columns) {
    // Determine if this column needs quoting in SQL
    const needsQuotes = column.name.includes(' ');

    // Show column name (indicating if it needs quotes)
    if (needsQuotes) {
      description += `- \`${column.name}\` (${column.type})`;
    } else {
      description += `- ${column.name} (${column.type})`;
    }

    // Add special flags
    if (column.primaryKey) {
      description += " [PRIMARY KEY]";
    }
    if (!column.nullable) {
      description += " [NOT NULL]";
    }

    // Add description if available
    if (column.description && column.description.trim() !== '') {
      description += ` - ${column.description}`;
    }

    // For columns with spaces, add a reminder about quotes
    if (needsQuotes) {
      description += " [REQUIRES BACKTICKS IN SQL]";
    }

    description += '\n';

    // Categorize column for analysis context
    if (column.type === 'integer' || column.type === 'float') {
      columnsByType.numeric.push(column.name);
    } else if (column.type === 'date') {
      columnsByType.date.push(column.name);
    } else if (categoricalColumns.includes(column)) {
      columnsByType.categorical.push(column.name);
    } else {
      columnsByType.other.push(column.name);
    }
  }

  // Add analysis context based on column types
  description += "\nANALYSIS CONTEXT:\n";

  if (columnsByType.numeric.length > 0) {
    description += `- Numeric measures that can be aggregated: ${columnsByType.numeric.join(', ')}\n`;
  }

  if (columnsByType.date.length > 0) {
    description += `- Time dimensions for trend analysis: ${columnsByType.date.join(', ')}\n`;
  }

  if (columnsByType.categorical.length > 0) {
    description += `- Categorical dimensions for grouping: ${columnsByType.categorical.join(', ')}\n`;
  }

  // Add potential analysis suggestions based on column combinations
  if (columnsByType.numeric.length > 0 && columnsByType.categorical.length > 0) {
    description += "- This dataset supports dimensional analysis (measures by categories)\n";
  }

  if (columnsByType.numeric.length > 0 && columnsByType.date.length > 0) {
    description += "- This dataset supports time series analysis (measures over time)\n";
  }

  if (columnsByType.numeric.length >= 2) {
    description += "- This dataset supports correlation analysis between numeric measures\n";
  }

  // Add a special note about quotation if there are columns with spaces
  if (hasColumnsWithSpaces) {
    description += "\nIMPORTANT: Some column names contain spaces and MUST be enclosed in backticks in SQL queries.\n";
    description += "Example: SELECT `RETAIL SALES`, `WAREHOUSE SALES`\n";
  }

  // Add instructions for dimensional queries
  description += "\nDIMENSIONAL QUERY PATTERNS:\n";
  description += "- When the user asks for data \"by X\", \"per X\", or \"for each X\", use GROUP BY X\n";
  description += "- For \"total X by Y\", use: SELECT Y, SUM(X) FROM ... GROUP BY Y ORDER BY Y\n";
  description += "- For \"average X by Y\", use: SELECT Y, AVG(X) FROM ... GROUP BY Y ORDER BY Y\n";
  description += "- Always include appropriate ORDER BY clauses for dimensional queries\n";
  description += "- When grouping by a dimension, always include that dimension in the SELECT clause\n";

  // Add instructions for column aliases and expressions
  description += "\nCOLUMN ALIASES AND EXPRESSIONS:\n";
  description += "- When creating calculated columns, always use AS to name them (example: SUM(X) AS total_x)\n";
  description += "- For multiple aggregated columns, use descriptive aliases (example: SUM(`RETAIL SALES`) AS total_retail_sales)\n";
  description += "- When the user asks for specific columns, make sure to name them clearly in the result\n";
  description += "- Column aliases should be lowercase with underscores (snake_case): total_sales, monthly_revenue, etc.\n";
  description += "- Aliases are not actual database columns, so they don't need backticks: AS total_sales (not AS `total_sales`)\n";

  description += "\nSQL QUERY PATTERNS:\n";
  description += "- \"Total sales by year\": SELECT YEAR, SUM(CAST(`RETAIL SALES` AS FLOAT64)) as total_sales FROM ... GROUP BY YEAR ORDER BY YEAR\n";
  description += "- \"Monthly sales for 2023\": SELECT MONTH, SUM(CAST(`RETAIL SALES` AS FLOAT64)) as total_sales FROM ... WHERE YEAR = 2023 GROUP BY MONTH ORDER BY MONTH\n";
  description += "- \"Average sales by client\": SELECT CLIENT, AVG(CAST(`RETAIL SALES` AS FLOAT64)) as average_sales FROM ... GROUP BY CLIENT ORDER BY CLIENT\n";
  description += "- \"Top 10 products by sales\": SELECT `ITEM DESCRIPTION`, SUM(CAST(`RETAIL SALES` AS FLOAT64)) as total_sales FROM ... GROUP BY `ITEM DESCRIPTION` ORDER BY total_sales DESC LIMIT 10\n";
  description += "- \"Sales trend over time\": SELECT `DATE`, SUM(CAST(`RETAIL SALES` AS FLOAT64)) as daily_sales FROM ... GROUP BY `DATE` ORDER BY `DATE`\n";
  description += "- \"Comparison of sales channels\": SELECT MONTH, SUM(CAST(`RETAIL SALES` AS FLOAT64)) AS retail_sales, SUM(CAST(`WAREHOUSE SALES` AS FLOAT64)) AS warehouse_sales FROM ... GROUP BY MONTH ORDER BY MONTH\n";

  description += "\nDATA VISUALIZATION SUGGESTIONS:\n";
  description += "- Time series data: Line charts for trends over time\n";
  description += "- Categorical comparisons: Bar charts for comparing categories\n";
  description += "- Part-to-whole relationships: Pie charts for showing composition\n";
  description += "- Distributions: Histograms for showing data distribution\n";
  description += "- Relationships: Scatter plots for showing correlations\n";
  description += "- Dimensional data with multiple measures: Combo charts or multiple series\n";
  description += "- Raw data exploration: Data tables with sorting and filtering\n";

  return description;
}

/**
 * Generate a system prompt for SQL generation
 * @param {Array} columns - Dataset columns
 * @param {string} datasetName - Name of the dataset
 * @param {Object} datasetContext - Dataset context information
 * @param {boolean} isDimensionalQuery - Whether the query appears to be dimensional
 * @param {boolean} isComparisonQuery - Whether the query appears to be a comparison
 * @param {boolean} isTimeSeriesQuery - Whether the query appears to be time-series based
 * @param {boolean} isRankingQuery - Whether the query appears to be ranking based
 * @param {boolean} requestsVisualization - Whether the query requests visualization
 * @returns {string} Formatted system prompt
 */
function generateSystemPrompt(columns, datasetName, datasetContext, {
  isDimensionalQuery = false,
  isComparisonQuery = false,
  isTimeSeriesQuery = false,
  isRankingQuery = false,
  requestsVisualization = false
} = {}) {
  // Get the schema description
  const schemaDescription = generateSchemaDescription(columns, datasetName, datasetContext);

  // Create the base system prompt
  let systemContent = `You are an expert data analyst providing direct insights and analysis.
  Your goal is to answer data questions by analyzing query results and conveying clear,
  actionable insights about what the data actually shows - not suggestions for future analysis.

  ANALYZE THE DATA DIRECTLY:
  1. Understand the intent of the query and what insight the user is seeking
  2. Identify clear patterns, trends, outliers, and relationships in the results
  3. Provide direct conclusions rather than suggestions for further analysis
  4. Focus on "what the data shows" instead of "what analysis you could do"
  5. Structure your response as a complete data analysis, not a list of possibilities

  RESPONSE STRUCTURE:
  1. Start with a concise summary of the key finding (1-2 sentences)
  2. Present the most important data points that directly answer the query
  3. Highlight meaningful patterns, anomalies, or distributions
  4. Explain what these findings actually mean in business/practical terms
  5. DO NOT include visualization recommendations - assume visualizations will be created automatically
  6. DO NOT suggest "further analysis" - provide the most complete analysis now

  ${schemaDescription}

  DATA ANALYSIS APPROACH:
  1. For quantitative metrics - calculate key statistics and explain their significance
  2. For time-based data - identify actual trends and seasonal patterns
  3. For categorical data - analyze the actual distribution and explain what it means
  4. For comparative analysis - directly state which items perform better/worse and by how much
  5. For outlier detection - identify actual outliers and explain their significance
  6. For ranking - explain why the rankings appear as they do and what factors influence them

  SQL QUERY REQUIREMENTS:
  1. Generate a SQL query that accurately addresses the user's question
  2. Your queries should only read data (SELECT statements only)
  3. Only reference columns that exist in the dataset schema
  4. Use appropriate SQL functions based on column types
  5. ALWAYS enclose column names with spaces in backticks (\`), e.g., \`RETAIL SALES\`
  6. DO NOT include a FROM clause or table name - the system will add this automatically
  7. DO NOT use table aliases or reference any tables by name
  8. ALWAYS use single quotes for string literals in WHERE clauses (e.g., WHERE Client = 'Pfizer')
  9. SQL functions like EXTRACT(YEAR FROM \`Date\`) are valid - the FROM keyword is allowed in functions`;

  // Add specialized instructions based on query type
  if (isDimensionalQuery) {
    systemContent += `\n\nDIMENSIONAL QUERY ANALYSIS:
    - Present the key differences between dimensions
    - Explain the relative performance across dimensions
    - Identify which dimensions are performing best/worst and why
    - Calculate the actual spread or range between highest and lowest performers
    - Provide context about what these dimensional differences mean`;
  }

  if (isComparisonQuery) {
    systemContent += `\n\nCOMPARISON ANALYSIS:
    - Directly calculate the actual differences between compared items (absolute and percentage)
    - Highlight the key factors driving these differences
    - Analyze whether the differences are significant or negligible
    - Explain what these differences mean in context
    - State clear conclusions about which item performs better/worse and by how much`;
  }

  if (isTimeSeriesQuery) {
    systemContent += `\n\nTIME SERIES ANALYSIS:
    - Directly identify growth rates, seasonal patterns or cyclical behaviors
    - Calculate period-over-period changes (month-over-month, year-over-year)
    - Identify acceleration or deceleration in trends
    - Find anomalous periods and explain potential causes
    - Provide concrete analysis of when changes occurred and their magnitude`;
  }

  if (isRankingQuery) {
    systemContent += `\n\nRANKING ANALYSIS:
    - Analyze the magnitude of differences between ranks
    - Calculate the share or percentage each ranked item represents of the total
    - Identify whether there's a long tail or concentrated distribution
    - Compare top performers against the average
    - Explain what factors might be driving the ranking order`;
  }

  // Add visual analysis specific instructions if the query requests visualization
  if (requestsVisualization) {
    systemContent += `\n\nVISUALIZATION CONTEXT:
    - Focus on what the data actually shows, not how it should be visualized
    - Provide insights that would be apparent in any visualization
    - Describe patterns that would be visible (e.g., "sales show a strong upward trend")
    - Analyze distributions or groupings that would be evident visually
    - Emphasize the most important findings that would stand out in a visual`;
  }

  return systemContent;
}

/**
 * Detect query patterns for classification
 * @param {string} query - Natural language query
 * @returns {Object} Query pattern types
 */
function detectQueryPatterns(query) {
  if (!query) return {};

  const queryLower = query.toLowerCase();

  // Check for dimensional query patterns
  const dimensionalPattern = /\b(by|per|for each|group by)\s+\w+\b|\b\w+ly\b/i;
  const comparisonPattern = /\b(compare|comparison|versus|vs|against)\b/i;
  const timePattern = /\b(trend|over time|historical|monthly|yearly|quarterly|weekly|daily)\b/i;
  const topPattern = /\b(top|bottom|highest|lowest|best|worst)\s+\d*\b/i;

  return {
    isDimensionalQuery: dimensionalPattern.test(queryLower),
    isComparisonQuery: comparisonPattern.test(queryLower),
    isTimeSeriesQuery: timePattern.test(queryLower),
    isRankingQuery: topPattern.test(queryLower)
  };
}

module.exports = {
  generateSchemaDescription,
  generateSystemPrompt,
  detectQueryPatterns
};