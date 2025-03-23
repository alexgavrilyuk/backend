this README is in backend/modules/dataProcessing

# Data Processing Module

This module is responsible for handling complex data processing operations, including multi-query planning, result aggregation, and advanced data analysis. It serves as a core component of the enhanced reporting system.

## Overview

The Data Processing module extends the application's capabilities beyond simple query-to-table operations by enabling:

1. Breaking down complex questions into multiple coordinated queries
2. Aggregating and transforming results from multiple data sources
3. Performing advanced statistical analysis across multiple datasets
4. Identifying cross-query insights and relationships
5. Preparing data for visualizations and narrative generation

## Files

### index.js

**Purpose**: Main entry point that exports the module's functionality.

**Usage**:
```javascript
const dataProcessing = require('../modules/dataProcessing');

// Use the main components
const complexity = await dataProcessing.analyzeQueryComplexity(query, columns, dataset);
const queryPlan = await dataProcessing.createQueryPlan(query, columns, dataset, complexity);
const combinedResults = dataProcessing.combineQueryResults(queryResults, queryPlan);
const analysis = await dataProcessing.analyzeData(combinedResults, queryPlan);
```

### queryPlanner.js

**Purpose**: Analyzes complex queries and breaks them down into simpler components.

**Key Functions**:
- `analyzeQueryComplexity()`: Determines if a query requires multiple data operations
- `createQueryPlan()`: Creates a comprehensive plan for executing complex queries
- `generateExecutionSequence()`: Creates an ordered sequence of query execution steps

**Query Types Handled**:
- `temporal-comparison`: Comparing data across time periods
- `multi-dimensional-aggregation`: Multiple simultaneous aggregations
- `trend-and-summary`: Combined trend and summary analysis
- `performers-with-details`: Top/bottom performers with detailed data

### aggregator.js

**Purpose**: Combines results from multiple queries into cohesive datasets.

**Key Functions**:
- `combineQueryResults()`: Merges data from multiple query results
- `prepareForVisualization()`: Transforms combined data for visualization

**Data Combination Patterns**:
- Period-to-period comparison data
- Multi-dimensional aggregated data
- Trend and summary combined data
- Performance data with details
- Historical data with predictions

### dataAnalysis.js

**Purpose**: Coordinates data analysis operations and integrates specialized analysis modules.

**Key Functions**:
- `analyzeData()`: Main function for comprehensive data analysis
- `generateTargetedAnalysis()`: Performs focused analysis on specific aspects
- `combineAnalyses()`: Merges multiple analysis results

### baseAnalysis.js

**Purpose**: Performs basic statistical analysis and pattern recognition.

**Key Functions**:
- `determineDataStructure()`: Identifies the structure of data
- `analyzeSimpleData()`: Analyzes basic tabular data
- `generateBasicStats()`: Calculates statistical metrics
- `identifyPatterns()`: Discovers patterns in data

### comparisonAnalysis.js

**Purpose**: Specializes in analyzing comparison data.

**Key Functions**:
- `analyzeComparisonData()`: Main function for comparison analysis
- `analyzeComparisons()`: Analyzes period-to-period comparisons
- `analyzeGrowthCategories()`: Categorizes entities by growth patterns
- `analyzeRelativePerformance()`: Compares performance across periods

### relationshipAnalysis.js

**Purpose**: Analyzes relationships between multiple datasets.

**Key Functions**:
- `analyzeMultiDatasetData()`: Main function for multi-dataset analysis
- `analyzeDatasetRelationships()`: Discovers relationships between datasets
- `analyzeTrendSummaryRelationship()`: Analyzes trend and summary data
- `analyzePerformersDetailsRelationship()`: Analyzes performer and detail data
- `analyzeHistoricalPredictionRelationship()`: Analyzes historical and prediction data

## Integration Points

The Data Processing module integrates with:

1. **Queries Module**: Receives natural language queries and column information
2. **BigQuery Module**: Executes SQL queries and receives results
3. **Reports Module**: Provides processed data for report generation
4. **OpenAI API**: Used for AI-driven query complexity analysis and planning

## Data Flow

### Complex Query Processing Flow

1. User submits a complex natural language query
2. `analyzeQueryComplexity()` determines if it requires multiple queries
3. `createQueryPlan()` breaks it down into component queries
4. Each component query is executed against BigQuery
5. `combineQueryResults()` aggregates the results
6. `analyzeData()` performs comprehensive analysis
7. Results are used for visualization and report generation

## Examples

### Analyzing Query Complexity

```javascript
const { analyzeQueryComplexity } = require('../modules/dataProcessing');

// Example: Analyze a complex query
const complexity = await analyzeQueryComplexity(
  "Compare sales by region for Q1 2023 vs Q1 2022 and highlight the top performers",
  columns,
  dataset
);

// Sample output
// {
//   isComplex: true,
//   reason: "Query requires comparison across different time periods",
//   recommendedApproach: "multi-query-comparison",
//   queryType: "temporal-comparison"
// }
```

### Creating a Query Plan

```javascript
const { createQueryPlan } = require('../modules/dataProcessing');

// Example: Create execution plan for a complex query
const queryPlan = await createQueryPlan(
  "Compare sales by region for Q1 2023 vs Q1 2022 and highlight the top performers",
  columns,
  dataset,
  complexity
);

// Sample output
// {
//   type: "complex",
//   queryType: "temporal-comparison",
//   steps: [
//     {
//       id: "q1-2023-data",
//       description: "Get Q1 2023 sales by region",
//       query: "Get sales by region for Q1 2023",
//       dependencies: [],
//       outputType: "aggregated"
//     },
//     {
//       id: "q1-2022-data",
//       description: "Get Q1 2022 sales by region",
//       query: "Get sales by region for Q1 2022",
//       dependencies: [],
//       outputType: "aggregated"
//     },
//     {
//       id: "top-performers",
//       description: "Identify top performing regions",
//       query: "Get top regions by sales growth from Q1 2022 to Q1 2023",
//       dependencies: ["q1-2023-data", "q1-2022-data"],
//       outputType: "comparison"
//     }
//   ]
// }
```

### Combining Query Results

```javascript
const { combineQueryResults } = require('../modules/dataProcessing');

// Example: Combine results from multiple queries
const combinedResults = combineQueryResults(
  [
    {
      id: "q1-2023-data",
      data: [/* Q1 2023 data */]
    },
    {
      id: "q1-2022-data",
      data: [/* Q1 2022 data */]
    },
    {
      id: "top-performers",
      data: [/* Top performers data */]
    }
  ],
  queryPlan
);
```

### Analyzing Combined Data

```javascript
const { analyzeData } = require('../modules/dataProcessing');

// Example: Analyze combined data
const analysis = await analyzeData(combinedResults, queryPlan, "temporal-comparison");

// Sample output includes:
// - dataStructure: Information about the data structure
// - comparisons: Detailed comparison analysis results
// - insights: Generated insights from the data
// - metadata: Additional information about the analysis
```

## Best Practices

1. **Query Planning**: Always analyze query complexity before execution to determine if multi-query approach is needed

2. **Error Handling**: Include proper error handling around AI-driven components like query planning

3. **Performance**: For large datasets, use the targeted analysis functions instead of full analysis

4. **Visualization Preparation**: Always use `prepareForVisualization()` before sending data to visualization components

5. **Context Awareness**: Include dataset context information when analyzing query complexity for better results

## Development Guidelines

When enhancing this module:

1. Add new query type patterns to `queryPlanner.js` when identified
2. Add new data combination patterns to `aggregator.js` as needed
3. Extend the analysis capabilities in the specialized analysis modules
4. Maintain backward compatibility with existing query patterns
5. Add comprehensive tests for any new functionality
6. Update this documentation when adding significant features