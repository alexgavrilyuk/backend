// modules/queries/services/sqlValidator.js

/**
 * Handles SQL validation and safety checking
 * Ensures queries are safe, properly formatted, and reference valid columns
 */

/**
 * Check if a SQL query is safe to execute
 * @param {string} sql - The SQL query to check
 * @returns {boolean} - Whether the query is safe
 */
function isSafeQuery(sql) {
  const unsafeKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
  return (
    sql.trim().toUpperCase().startsWith('SELECT') &&
    !unsafeKeywords.some((keyword) => sql.toUpperCase().includes(keyword))
  );
}

/**
 * Validate SQL query against dataset columns
 * @param {string} sql - SQL query to validate
 * @param {Array} columns - Dataset columns
 * @returns {Object} - Validation result
 */
function validateSqlQuery(sql, columns) {
  // Basic syntax check: must start with SELECT
  if (!sql.trim().toLowerCase().startsWith('select')) {
    return { valid: false, error: 'Query must start with SELECT' };
  }

  // Special case: Handle "SELECT *" queries - they're valid even without explicit column references
  if (sql.trim().toLowerCase().startsWith('select *')) {
    return { valid: true };
  }

  // Check if the query includes a standalone FROM clause - we want to remove this requirement
  // But we need to make sure we don't catch SQL functions like EXTRACT(YEAR FROM "Date")
  const fromClauseRegex = /\b(FROM)\b\s+([a-zA-Z0-9_"`'`.]+)(?!\s*["'`)\w])/i;
  const extractFunctionRegex = /EXTRACT\s*\(\s*\w+\s+FROM\s+["`'\w\s]+\)/i;

  // First check if we have an EXTRACT function to avoid false positives
  const hasExtractFunction = extractFunctionRegex.test(sql);

  // If there's no EXTRACT function, or if we find a FROM clause that's not part of an EXTRACT
  if (!hasExtractFunction && fromClauseRegex.test(sql)) {
    return {
      valid: false,
      error: 'Do not include a FROM clause or table name in your query. Only include columns, conditions, and other clauses.'
    };
  }

  // Get all valid column names (accounting for columns with spaces)
  const validColumnNames = new Set(columns.map(col => col.name.toLowerCase()));

  // Common SQL keywords to ignore
  const sqlKeywords = new Set([
    'select', 'from', 'where', 'group', 'order', 'by', 'having', 'limit',
    'and', 'or', 'not', 'in', 'between', 'like', 'is', 'null', 'as',
    'join', 'inner', 'outer', 'left', 'right', 'full', 'on',
    'distinct', 'count', 'sum', 'avg', 'min', 'max', 'case', 'when', 'then', 'else', 'end',
    'asc', 'desc', 'offset', 'all', 'cast', 'float64', 'int64', 'numeric',
    'total', 'amount', 'value', // Common alias elements
    // Date/time function parts
    'year', 'month', 'day', 'hour', 'minute', 'second', 'quarter', 'week', 'epoch',
    'millennium', 'centuries', 'decades', 'years', 'months', 'days',
    'dow', 'doy', 'isodow', 'isoyear'
  ]);

  // First, let's parse out the basic structure of the SQL query to distinguish between
  // column references and string literals in conditions

  // Check if there's a WHERE clause in the query
  const whereParts = sql.split(/\bWHERE\b/i);
  const hasWhereClause = whereParts.length > 1;

  // Process the column selection part (always present)
  const columnsPart = whereParts[0].replace(/^SELECT\s+/i, '').trim();

  // Look for aggregate expressions with AS aliases
  const aggregateExprPattern = /(SUM|AVG|COUNT|MIN|MAX)\s*\([^)]+\)\s+AS\s+([a-zA-Z0-9_]+)/gi;
  const aliases = new Set();

  let match;
  // Extract all column aliases so we don't treat them as column references
  while ((match = aggregateExprPattern.exec(columnsPart)) !== null) {
    if (match[2]) {
      aliases.add(match[2].toLowerCase());
    }
  }

  // Also look for simple column AS alias patterns
  const simpleAliasPattern = /([a-zA-Z0-9_`"]+)\s+AS\s+([a-zA-Z0-9_]+)/gi;
  while ((match = simpleAliasPattern.exec(columnsPart)) !== null) {
    if (match[2]) {
      aliases.add(match[2].toLowerCase());
    }
  }

  // Extract column references from the SELECT part - updated to include backticks
  const columnRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b|`([^`]+)`|"([^"]+)"/g;
  let hasValidColumnReferences = false;

  // First, validate column references in the SELECT part
  while ((match = columnRegex.exec(columnsPart)) !== null) {
    const potentialRef = match[1] || match[2] || match[3];
    if (!potentialRef) continue;

    const lowerRef = potentialRef.toLowerCase();

    // Skip SQL keywords, functions, and numbers
    if (sqlKeywords.has(lowerRef) || /^\d+$/.test(lowerRef)) {
      continue;
    }

    // Skip if it's an alias we identified
    if (aliases.has(lowerRef)) {
      continue;
    }

    // Special case - if it ends with "_sales", "_total", etc. it's likely an alias
    if (lowerRef.endsWith('_sales') || lowerRef.endsWith('_total') ||
        lowerRef.endsWith('_sum') || lowerRef.endsWith('_count') ||
        lowerRef.endsWith('_avg') || lowerRef.includes('total_')) {
      console.log(`Identified likely alias: ${potentialRef}`);
      continue;
    }

    // Check if it's a valid column
    if (validColumnNames.has(lowerRef)) {
      hasValidColumnReferences = true;
      continue;
    }

    // Check for column names with spaces
    if (columns.some(col => col.name.toLowerCase().includes(lowerRef))) {
      console.log(`Note: "${potentialRef}" might be part of a multi-word column name`);
      continue;
    }

    console.log(`Invalid column in SELECT part: ${potentialRef}`);
    return {
      valid: false,
      error: `Column '${potentialRef}' not found in dataset schema. If your column name contains spaces, make sure to quote it with backticks.`
    };
  }

  // If there's a WHERE clause, validate the column references there
  if (hasWhereClause) {
    const wherePart = whereParts[1].trim();

    // First, let's identify and temporarily remove any EXTRACT functions to avoid conflicts
    const extractRegex = /EXTRACT\s*\(\s*(\w+)\s+FROM\s+(["`']?[\w\s]+["`']?)\s*\)/gi;
    const extractMatches = [];
    let tempWherePart = wherePart.replace(extractRegex, (match, datepart, column) => {
      const placeholder = `__EXTRACT_FUNC_${extractMatches.length}__`;
      extractMatches.push({
        placeholder,
        match,
        datepart,
        column: column.replace(/["`']/g, '') // Strip quotes
      });
      return placeholder;
    });

    // This regex will find column refs followed by operators, avoiding string values
    const whereColRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b|`([^`]+)`|"([^"]+)"/g;

    // We need to track when we're looking at operators vs column names
    let isOperatorExpected = false;

    while ((match = whereColRegex.exec(tempWherePart)) !== null) {
      const potentialRef = match[1] || match[2] || match[3];
      if (!potentialRef) continue;

      // Skip if this is one of our extract function placeholders
      if (potentialRef.startsWith('__EXTRACT_FUNC_')) {
        continue;
      }

      const lowerRef = potentialRef.toLowerCase();

      // Skip SQL keywords and operators
      if (sqlKeywords.has(lowerRef) ||
          ['=', '!=', '<>', '>', '<', '>=', '<=', 'like', 'in', 'between'].includes(lowerRef)) {
        isOperatorExpected = !isOperatorExpected;
        continue;
      }

      // If we're expecting a column reference (not a value after an operator)
      if (!isOperatorExpected) {
        // Check if it's a valid column
        if (validColumnNames.has(lowerRef)) {
          // Valid column reference
          isOperatorExpected = true;
          continue;
        }

        // Check for columns with spaces
        if (columns.some(col => col.name.toLowerCase().includes(lowerRef))) {
          console.log(`Note: "${potentialRef}" might be part of a multi-word column name`);
          isOperatorExpected = true;
          continue;
        }

        console.log(`Invalid column in WHERE part: ${potentialRef}`);
        return {
          valid: false,
          error: `Column '${potentialRef}' not found in dataset schema. If your column name contains spaces, make sure to quote it with backticks.`
        };
      } else {
        // If we're expecting a value (after an operator), don't validate it as a column
        isOperatorExpected = false;
        continue;
      }
    }

    // Now verify that all the EXTRACT functions reference valid columns
    for (const extractFunc of extractMatches) {
      const columnName = extractFunc.column.toLowerCase();
      if (!validColumnNames.has(columnName) &&
          !columns.some(col => col.name.toLowerCase().includes(columnName))) {
        console.log(`Invalid column in EXTRACT function: ${extractFunc.column}`);
        return {
          valid: false,
          error: `Column '${extractFunc.column}' used in EXTRACT function not found in dataset schema.`
        };
      }
    }
  }

  // Ensure we found at least one valid column, unless it's a "SELECT *" query
  if (!hasValidColumnReferences && !sql.trim().toLowerCase().startsWith('select *')) {
    return {
      valid: false,
      error: 'No valid column references found in the query. Make sure to use column names from the dataset schema.'
    };
  }

  return { valid: true };
}

/**
 * Clean and normalize a SQL query
 * @param {string} sql - Original SQL query
 * @returns {string} - Cleaned SQL query
 */
function cleanSqlQuery(sql) {
  if (!sql) return '';

  // Normalize whitespace
  let cleanedSql = sql.replace(/\s+/g, ' ').trim();

  // Remove any FROM ... placeholder
  cleanedSql = cleanedSql.replace(/FROM\s+\.\.\.(\s|$)/i, ' ');

  // Normalize quotes: Replace double quotes with backticks for column names
  cleanedSql = cleanedSql.replace(/"([^"]+)"/g, "`$1`");

  return cleanedSql;
}

/**
 * Extract components from a SQL query
 * @param {string} sql - SQL query to analyze
 * @returns {Object} - Extracted components
 */
function extractSqlComponents(sql) {
  const cleanedSql = cleanSqlQuery(sql);

  // Initialize result object
  const result = {
    selectPart: '',
    wherePart: '',
    groupByPart: '',
    orderByPart: '',
    limitPart: '',
    havingPart: '',
    hasWhere: false,
    hasGroupBy: false,
    hasOrderBy: false,
    hasLimit: false,
    hasHaving: false
  };

  // Look for each clause keyword
  const clauseKeywords = ['WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'HAVING'];
  const keywordPositions = [];

  clauseKeywords.forEach(keyword => {
    // Create pattern that matches the keyword as a whole word
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    const match = cleanedSql.match(pattern);
    if (match) {
      keywordPositions.push({
        keyword: keyword,
        position: match.index
      });
    }
  });

  // Sort positions by their location in the string
  keywordPositions.sort((a, b) => a.position - b.position);

  // Extract the SELECT part - it goes from after "SELECT" to the first keyword
  const selectStart = 'SELECT '.length;
  const firstKeywordPos = keywordPositions.length > 0 ? keywordPositions[0].position : cleanedSql.length;

  // Get the select clause
  result.selectPart = cleanedSql.substring(selectStart, firstKeywordPos).trim();

  // If the selectPart is empty or just has *, set it to "*"
  if (!result.selectPart || result.selectPart === "*") {
    result.selectPart = "*";
  }

  // Extract the other clauses
  if (keywordPositions.length > 0) {
    for (let i = 0; i < keywordPositions.length; i++) {
      const keyword = keywordPositions[i].keyword;
      const startPos = keywordPositions[i].position;
      const endPos = (i < keywordPositions.length - 1) ? keywordPositions[i+1].position : cleanedSql.length;
      const clause = cleanedSql.substring(startPos, endPos).trim();

      // Store the clause without the keyword
      const clauseContent = clause.substring(keyword.length).trim();

      // Set the appropriate part in the result
      switch (keyword.toUpperCase()) {
        case 'WHERE':
          result.wherePart = clauseContent;
          result.hasWhere = true;
          break;
        case 'GROUP BY':
          result.groupByPart = clauseContent;
          result.hasGroupBy = true;
          break;
        case 'ORDER BY':
          result.orderByPart = clauseContent;
          result.hasOrderBy = true;
          break;
        case 'LIMIT':
          result.limitPart = clauseContent;
          result.hasLimit = true;
          break;
        case 'HAVING':
          result.havingPart = clauseContent;
          result.hasHaving = true;
          break;
      }
    }
  }

  return result;
}

/**
 * Compose a complete SQL query with table reference
 * @param {string} sql - Original SQL query
 * @param {string} tableReference - Full table reference with backticks
 * @returns {string} - Complete SQL query with table reference
 */
function composeSqlWithTableReference(sql, tableReference) {
  // Extract components from the SQL query
  const components = extractSqlComponents(sql);

  // Build the full SQL query
  let fullSql = `SELECT ${components.selectPart} FROM ${tableReference}`;

  // Add WHERE clause if present
  if (components.hasWhere) {
    fullSql += ` WHERE ${components.wherePart}`;
  }

  // Add GROUP BY clause if present
  if (components.hasGroupBy) {
    fullSql += ` GROUP BY ${components.groupByPart}`;
  }

  // Add HAVING clause if present
  if (components.hasHaving) {
    fullSql += ` HAVING ${components.havingPart}`;
  }

  // Add ORDER BY clause if present
  if (components.hasOrderBy) {
    fullSql += ` ORDER BY ${components.orderByPart}`;
  }

  // Add LIMIT clause if present
  if (components.hasLimit) {
    fullSql += ` LIMIT ${components.limitPart}`;
  }

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
    }
  }

  return fullSql;
}

module.exports = {
  isSafeQuery,
  validateSqlQuery,
  cleanSqlQuery,
  extractSqlComponents,
  composeSqlWithTableReference
};