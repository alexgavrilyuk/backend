Let's update the README.md file for the queries module to reflect the refactored structure:

# Queries Module

The Queries module is responsible for converting natural language questions into SQL queries, executing them against the appropriate datasets in BigQuery, and returning the results to the user. This module leverages OpenAI's language models and the Data Processing module to enable intuitive data exploration without requiring SQL knowledge, including support for complex multi-query operations.

## Overview

The Queries module provides a bridge between natural language and SQL, allowing users to interact with their data using everyday language. It handles the entire pipeline from receiving a natural language query, generating appropriate SQL (or multiple SQL queries as needed), executing securely, and formatting the results.

## Features

- Natural language to SQL translation using OpenAI
- Support for multi-query decomposition for complex questions
- Context-aware query understanding for follow-up questions
- Intelligent handling of dimensional queries (GROUP BY)
- Query validation and security checks
- Special handling for date queries and time comparisons
- Enhanced error reporting and debugging

## Folder Structure

```
/modules/queries/
  controller.js       # Business logic for handling query requests
  index.js            # Module exports and metadata
  routes.js           # API route definitions
  /services/
    index.js          # Exports all NLP services
    nlpService.js     # Main entry point for NLP functionality
    schemaProcessor.js # Schema description generation
    sqlGenerator.js   # SQL generation using OpenAI
    sqlValidator.js   # SQL validation and safety checking
    analyticsExtractor.js # Insight extraction and context detection
```

## Services

### nlpService.js

**Purpose**: Main entry point for natural language processing services.

**Key Functions**:
- `naturalLanguageToSql()`: Converts natural language to SQL
- `generateDatasetQuery()`: Generates dataset-specific SQL queries
- `generateComponentQuery()`: Handles component queries for complex questions

### schemaProcessor.js

**Purpose**: Handles schema processing and description generation for AI prompts.

**Key Functions**:
- `generateSchemaDescription()`: Creates detailed schema information for AI prompts
- `detectQueryPatterns()`: Identifies query types (dimensional, comparison, time series)
- `generateSystemPrompt()`: Creates specialized system prompts for different query types

### sqlGenerator.js

**Purpose**: Handles SQL generation using OpenAI.

**Key Functions**:
- `generateEnhancedSqlQuery()`: Uses OpenAI to convert natural language to SQL
- `handleComplexQuery()`: Manages multi-step queries that require decomposition

### sqlValidator.js

**Purpose**: Validates SQL queries for safety and correctness.

**Key Functions**:
- `validateSqlQuery()`: Checks generated SQL against dataset schema
- `isSafeQuery()`: Ensures queries are read-only and not potentially harmful
- `extractSqlComponents()`: Parses SQL for various clause components
- `composeSqlWithTableReference()`: Builds complete SQL with table references

### analyticsExtractor.js

**Purpose**: Extracts insights and handles context detection.

**Key Functions**:
- `extractAnalyticalInsights()`: Identifies key insights from AI responses
- `detectContextReferences()`: Checks if a query references previous context
- `detectVisualizationRequest()`: Identifies when a user wants visualization
- `processAiResponse()`: Extracts structured data from AI responses

## Integration Points

The Queries module integrates with several other modules:

1. **Data Processing Module**: For complex query planning, result aggregation, and analysis
2. **BigQuery Module**: For SQL execution against datasets
3. **Datasets Module**: For retrieving dataset schema and context
4. **Reports Module**: Provides query capabilities for report generation

## Data Flow

### Simple Query Flow
1. User submits a natural language query
2. NLP service analyzes query complexity
3. For simple queries, SQL is generated directly
4. SQL is validated and corrected if needed
5. SQL is executed against BigQuery
6. Results are formatted and returned

### Complex Query Flow
1. User submits a complex natural language query
2. NLP service analyzes and determines query needs decomposition
3. Query planner breaks it down into component queries
4. Each component query is generated and executed
5. Results are aggregated and transformed
6. Combined results are analyzed to extract insights
7. Complete results with insights are returned

### Context-Aware Query Flow
1. User submits a follow-up question to a previous query
2. System detects context references in the query
3. Previous conversation history is used for context
4. Query is generated with awareness of previous results
5. Results maintain continuity with previous queries

## Best Practices

- Include conversation history for context-aware follow-up queries
- Provide comprehensive dataset context for better query understanding
- Use clear and specific natural language queries
- Validate dataset availability before querying
- Handle large result sets appropriately on the frontend
