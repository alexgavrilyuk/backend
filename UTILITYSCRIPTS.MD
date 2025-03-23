This .md document is in backend root folder

# Utility Scripts

This folder contains various utility scripts that assist with maintenance, testing, and verification of the application setup. These scripts can be run directly from the command line and provide essential tools for development, debugging, and system administration.

## Overview

The utility scripts serve several purposes:
- System verification and diagnostics
- Database management and maintenance
- BigQuery integration testing and troubleshooting
- Environment setup validation
- OpenAI API integration

## Scripts

### checkAllDatasets.js

**Purpose**: Performs a comprehensive check of all datasets in the system, verifying their status in both the database and BigQuery.

**Functionality**:
- Connects to the PostgreSQL database and BigQuery
- Retrieves all datasets (or datasets for a specific user if provided)
- For each dataset, checks:
  - Database row count
  - BigQuery dataset existence
  - BigQuery table existence
  - BigQuery row count
  - Compares row counts between database and BigQuery
- Reports issues and inconsistencies
- Provides commands to fix datasets with issues

**Usage**:
```bash
# Check all datasets
node checkAllDatasets.js

# Check datasets for a specific user
node checkAllDatasets.js user123
```

**Sample Output**:
```
Found 15 datasets to check.

Checking dataset: Sales Data (dataset_123)
BigQuery table: user_456.dataset_123
Status: available
Database row count: 1500
BigQuery dataset exists: true
BigQuery table exists: true
BigQuery row count: 1500
No issues detected.

Checking dataset: Customer Data (dataset_456)
BigQuery table: user_789.dataset_456
Status: available
Database row count: 500
BigQuery dataset exists: true
BigQuery table exists: true
BigQuery row count: 0
Issues:
- BigQuery table has 0 rows
- Database shows rows but BigQuery table is empty

===== SUMMARY =====
Total datasets: 15
Datasets with issues: 1

Datasets that need attention:
- Customer Data (dataset_456): BigQuery table has 0 rows, Database shows rows but BigQuery table is empty

To fix datasets with 0 rows, run:
node reloadBigQueryTable.js dataset_456
```

### checkFirebaseSetup.js

**Purpose**: Verifies the Firebase setup and credentials used for authentication.

**Functionality**:
- Imports the verification utility from core/utils
- Runs Firebase verification
- Reports success or failure
- Provides detailed error information if Firebase setup is incorrect

**Usage**:
```bash
node checkFirebaseSetup.js
```

**Sample Output**:
```
===== FIREBASE SETUP VERIFICATION =====

Checking Firebase environment variables...
✅ Firebase service account file found at: /path/to/firebase-credentials.json
✅ Firebase service account file appears to be valid
   Project ID: my-project-123
   Client Email: firebase-adminsdk@my-project-123.iam.gserviceaccount.com

Attempting to initialize Firebase Admin SDK...
✅ Firebase Admin SDK initialized successfully
✅ Firebase Auth functionality verified
Firebase app deleted after test

===== FIREBASE VERIFICATION COMPLETE =====
```

### checkProject.js

**Purpose**: Verifies the Google Cloud Project configuration, credentials, and access.

**Functionality**:
- Checks service account key file existence and validity
- Validates project ID matches between .env file and service account
- Tests connection to Google Cloud Storage API
- Lists buckets in the project to verify access
- Provides detailed diagnostics and suggestions for common issues

**Usage**:
```bash
node checkProject.js
```

**Sample Output**:
```
=== GOOGLE CLOUD PROJECT CHECK ===

Service account key file path: ./gcp-credentials.json
✅ Service account key file exists
✅ Service account key file is valid JSON
✅ Service account email: service-account@my-project-123.iam.gserviceaccount.com
✅ Service account project ID: my-project-123
✅ Project IDs match

Trying to access Storage API...
✅ Successfully accessed Storage API!
✅ Found 3 buckets in project

Buckets in project:
- my-app-datasets
- my-app-backups
- my-app-temp

=== CHECK COMPLETE ===
```

### checkSetup.js

**Purpose**: Comprehensive verification utility for the entire application setup.

**Functionality**:
- Checks all required environment variables
- Verifies database connectivity
- Tests Google Cloud Storage access
- Validates BigQuery connectivity
- Checks OpenAI API access
- Provides detailed diagnostics for each component

**Usage**:
```bash
node checkSetup.js
```

**Sample Output**:
```
===== SETUP VERIFICATION =====

Checking environment variables...
✅ All required environment variables are set
Current environment variables:
  - DB_USER: postgres
  - DB_HOST: localhost
  - DB_PORT: 5432
  - DB_NAME: mydatabase
  - GCP_PROJECT_ID: my-project-123
  - OPENAI_API_KEY: ******
✅ GCP key file found at: ./gcp-credentials.json

Checking database connectivity...
✅ Database connectivity successful: 2023-06-15 10:15:30.123456+00
✅ All required database tables exist

Checking Google Cloud Storage connectivity...
✅ GCS bucket 'my-app-datasets' exists and is accessible

Checking BigQuery connectivity...
✅ BigQuery connectivity successful

Checking OpenAI API connectivity...
✅ OpenAI API connectivity successful

===== VERIFICATION COMPLETE =====
```

### index.js

**Purpose**: Main application entry point that loads and starts the server.

**Functionality**:
- Simple file that requires the main server module from app/server.js
- Serves as the entry point when running the application

**Usage**:
```bash
# Direct usage
node index.js

# With npm scripts
npm start
```

### jest.config.js

**Purpose**: Configuration file for Jest testing framework.

**Functionality**:
- Configures test environment settings
- Sets coverage reporting options
- Defines test matching patterns
- Sets test timeouts
- Configures test setup files

**Key Settings**:
- Test environment: Node.js
- Coverage directory: ./coverage/
- Coverage collection: true
- Test timeout: 30000ms
- Test matching: **/__tests__/**/*.js?(x) and **/?(*.)+(spec|test).js?(x)
- Setup files: ./tests/setup.js

### multiRegionTest.js

**Purpose**: Tests BigQuery connectivity across multiple regions to identify region-specific issues.

**Functionality**:
- Tests BigQuery connections with different region settings:
  - US region
  - EU region
  - No region specified (default)
- For each region, attempts to run a simple query
- Reports success or failure for each region
- Helps diagnose region-related connectivity issues

**Usage**:
```bash
node multiRegionTest.js
```

**Sample Output**:
```
Testing BigQuery with region: US
Running query with options: { query: 'SELECT 1 as test', useLegacySql: false, location: 'US' }
✅ SUCCESS with region US! Result: [ { test: 1 } ]
--------------------------------------------------
Testing BigQuery with region: EU
Running query with options: { query: 'SELECT 1 as test', useLegacySql: false, location: 'EU' }
✅ SUCCESS with region EU! Result: [ { test: 1 } ]
--------------------------------------------------
Testing BigQuery with region: NONE
Running query with options: { query: 'SELECT 1 as test', useLegacySql: false }
✅ SUCCESS with region NONE! Result: [ { test: 1 } ]
--------------------------------------------------
```

### openai.js

**Purpose**: Utility for testing and demonstrating OpenAI API integration.

**Functionality**:
- Creates an OpenAI client using your API key
- Defines a function to generate SQL from natural language queries
- Demonstrates the prompt structure used for SQL generation
- Can be used to test OpenAI connectivity and response quality

**Usage**:
```bash
# Modify the script to include a test query, then run:
node openai.js
```

**Key Components**:
- OpenAI client initialization
- `generateSqlQuery` function that takes user query and schema
- System prompt template for SQL generation
- Error handling for API failures

### package.json and package-lock.json

**Purpose**: Node.js package configuration files.

**Functionality**:
- Lists application dependencies
- Defines npm scripts for common operations
- Specifies application metadata
- (package-lock.json) Locks dependency versions for consistent installations

**Key Scripts**:
```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "migrate": "node migrations/runMigrations.js",
    "check": "node checkSetup.js",
    "check-firebase": "node checkFirebaseSetup.js"
  }
}
```

### reloadBigQueryTable.js

**Purpose**: Utility to reload data from Cloud Storage into BigQuery for a specific dataset.

**Functionality**:
- Retrieves dataset information from the database
- Checks the corresponding BigQuery table
- If the table exists but has 0 rows, reloads the data from the original file in Cloud Storage
- Uses dataset schema information to ensure correct column mapping
- Reports progress and results

**Usage**:
```bash
node reloadBigQueryTable.js dataset_123
```

**Sample Output**:
```
Checking dataset: Customer Data (dataset_456)
Checking BigQuery table: user_789.dataset_456
Current row count: 0
Table has 0 rows. Starting reload process...
GCS file path: users/user_789/datasets/dataset_456/customer_data.csv
Source file verified in GCS: users/user_789/datasets/dataset_456/customer_data.csv
Prepared schema with 15 columns.
Loading data from GCS URI: gs://my-app-datasets/users/user_789/datasets/dataset_456/customer_data.csv
BigQuery load job job_abc123 started
Waiting for BigQuery load job to complete...
BigQuery load job completed successfully. Loaded 500 rows.
Verified 500 rows in BigQuery table after reload.
Reload process completed successfully.
```

### simpleBQTest.js

**Purpose**: Simplified BigQuery connectivity test with minimal configuration.

**Functionality**:
- Initializes BigQuery client with minimal configuration (no region)
- Runs a simple test query
- Reports success or failure
- Useful for basic connectivity testing without region-specific settings

**Usage**:
```bash
node simpleBQTest.js
```

**Sample Output**:
```
Testing BigQuery with minimal config
Project ID: my-project-123
Running simple query...
Query successful! Result: [ { test: 1 } ]
BigQuery is working without specifying a region
```

### testBigQuery.js

**Purpose**: Comprehensive BigQuery connectivity test with detailed diagnostics.

**Functionality**:
- Tests BigQuery connectivity with explicit region settings
- Provides detailed diagnostic information
- Suggests solutions for common connectivity problems
- Can help diagnose permission, API, and configuration issues

**Usage**:
```bash
node testBigQuery.js
```

**Sample Output**:
```
Testing BigQuery connectivity...
Project ID: my-project-123
Key file exists: Yes
BigQuery client initialized
Executing test query...
Query successful, result: [ { test: 1 } ]
BigQuery is properly configured!
```

Or for a failure case:
```
Testing BigQuery connectivity...
Project ID: my-project-123
Key file exists: Yes
BigQuery client initialized
Executing test query...
Error testing BigQuery: Permission denied while accessing BigQuery resource

Possible solution: The service account needs BigQuery permissions.
Go to Google Cloud Console -> IAM -> Find your service account
Add the "BigQuery Admin" role to your service account.
```

## Running Utility Scripts

You can run these utility scripts directly from the command line with Node.js:

```bash
# Basic usage
node <script-name>.js [arguments]

# Examples
node checkSetup.js
node checkAllDatasets.js
node reloadBigQueryTable.js dataset_123
```

Some scripts are also available as npm commands:

```bash
# Run verification scripts
npm run check
npm run check-firebase

# Start the application
npm start
```

## Best Practices

1. **Regular Verification**: Run `checkSetup.js` regularly during development to ensure your environment is correctly configured

2. **Issue Resolution**: When datasets have issues, use `reloadBigQueryTable.js` to fix them

3. **Region Testing**: If BigQuery operations fail, use `multiRegionTest.js` to diagnose region-specific issues

4. **Environment Setup**: Before deployment, verify the entire setup with `checkSetup.js`

5. **Package Management**: Keep `package.json` and dependencies up to date