# Reports Module

This module is responsible for generating comprehensive AI-driven reports based on dataset queries. It transforms simple data queries into detailed reports with visualizations, insights, and narrative explanations.

## Installation and Setup

1. Ensure the module is properly imported in `app/routes.js`
2. Run database migrations to create the necessary tables:
   ```bash
   npm run migrate
   ```
3. Verify the migration completed successfully
4. The module is now ready to use via the `/api/reports` endpoints

## Responsibilities

- Report generation from natural language queries
- Multi-query planning and execution
- Visualization selection and specification
- Insight extraction from data
- Narrative generation for reports
- Report retrieval and management

## API Endpoints

| Method | Endpoint                  | Description                    | Auth Required |
|--------|---------------------------|--------------------------------|---------------|
| POST   | /api/reports              | Generate a new report          | Yes           |
| GET    | /api/reports              | List all user reports          | Yes           |
| GET    | /api/reports/:reportId    | Get a specific report          | Yes           |
| DELETE | /api/reports/:reportId    | Delete a report                | Yes           |

## Database Setup

This module requires the reports table in the database. The database schema is automatically created when running database migrations:

```bash
npm run migrate
```

The migration system will:
1. Create the `reports` table based on the Report model
2. Establish the relationship between datasets and reports
3. Add appropriate indexes for performance

### Report Model Schema

The Report model includes the following fields:
- `id` (UUID): Primary key
- `userId` (String): References the user who created the report
- `datasetId` (UUID): References the dataset used for the report
- `query` (Text): Original natural language query
- `status` (String): Report status (processing, completed, error)
- `reportType` (String): Type of report (standard, executive, detailed)
- `generatedSql` (Text): SQL query generated for the report
- `visualizations` (Text): JSON string of visualization specifications
- `insights` (Text): JSON string of insights extracted from data
- `narrative` (Text): Markdown-formatted explanation of findings
- `reportData` (Text): JSON string of processed data for the report
- `errorMessage` (Text): Error message if processing failed

## Files

### controller.js

**Purpose**: Implements the business logic for report-related operations.

**Functionality**:
- Generates new reports based on natural language queries
- Retrieves reports by ID
- Lists all reports for a user
- Deletes reports

### routes.js

**Purpose**: Defines API routes for report operations.

**Functionality**:
- Maps HTTP endpoints to controller methods
- Applies authentication middleware
- Handles request routing

### models/reportModel.js

**Purpose**: Defines the database schema for storing report data.

**Functionality**:
- Specifies report metadata (ID, user, dataset, etc.)
- Defines storage for report content (visualizations, insights)
- Sets up relationships and indexes

### services/reportGenerationService.js

**Purpose**: Orchestrates the full report generation process.

**Functionality**:
- Coordinates between SQL generation, data retrieval, and report assembly
- Executes SQL queries against BigQuery
- Composes the complete report from various components
- Handles error recovery and fallbacks

### services/visualizationService.js

**Purpose**: Determines appropriate visualizations based on data.

**Functionality**:
- Analyzes data characteristics and query types
- Selects visualization types (bar, line, pie, etc.)
- Generates visualization specifications for frontend rendering
- Ensures data is properly formatted for visualization

### services/insightService.js

**Purpose**: Extracts insights and patterns from query results.

**Functionality**:
- Identifies trends, outliers, and key metrics
- Calculates statistics and comparisons
- Detects distribution patterns and correlations
- Prioritizes insights by significance

### services/narrativeService.js

**Purpose**: Generates natural language explanations of data.

**Functionality**:
- Creates textual descriptions of visualizations and insights
- Uses OpenAI to generate contextual narratives
- Formats explanations in markdown for readability
- Provides template-based fallbacks when needed

### utils/reportUtils.js

**Purpose**: Provides helper functions for report processing.

**Functionality**:
- Formats reports for API responses
- Validates visualization and insight objects
- Manages report size limits
- Categorizes insights for better organization

## Integration Points

The Reports module integrates with:
- BigQuery module for data retrieval
- Queries module for SQL generation
- Dataset module for metadata access
- OpenAI API for narrative generation

## Data Flow

### Report Generation Flow
1. User submits a natural language query
2. Report generation service processes the query
3. SQL is generated and executed against BigQuery
4. Data is analyzed to extract insights
5. Appropriate visualizations are selected
6. Narrative text is generated to explain findings
7. Complete report is assembled and stored
8. Report metadata is returned to the user

## Development Guidelines

When working with this module:

1. Ensure all report components handle empty datasets gracefully
2. Include fallbacks for all AI-dependent features
3. Keep visualizations appropriate to the data characteristics
4. Format responses consistently for frontend compatibility
5. Maintain clear error messaging in case of failures
6. Run migrations after making changes to the Report model schema