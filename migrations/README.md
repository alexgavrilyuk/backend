this README is in backend/migrations

# Database Migrations

This folder contains database migration scripts that manage and update the application's database schema.

## Overview

The migrations system handles the creation, modification, and maintenance of database tables and relationships. It uses a combination of Sequelize's built-in synchronization capabilities and custom migration scripts to manage the database schema.

## Migration Files

### runMigrations.js

**Purpose**: Main entry point that executes all database migrations.

**Functionality**:
- Synchronizes all Sequelize models with the database
- Runs each specific migration script in sequence
- Reports success or failure of migrations
- Can be run directly or called programmatically

### add-context-fields-to-dataset.js

**Purpose**: Migration that adds context-related fields to the dataset table.

**Functionality**:
- Adds `context`, `purpose`, `source`, and `notes` fields to the datasets table
- Ensures backward compatibility with existing data

### add-reports-table.js

**Purpose**: Migration that creates the reports table for the enhanced reporting system.

**Functionality**:
- Creates the reports table based on the Report model
- Adds appropriate indexes for performance
- Ensures relationship with the datasets table
- Supports the AI-driven reporting capabilities

## Running Migrations

Run all migrations using:

```bash
npm run migrate
```

Or run a specific migration directly:

```bash
node migrations/add-reports-table.js
```

## Migration Strategy

The application uses a combination of:

1. **Automatic Schema Synchronization**: Using Sequelize's `sync({ alter: true })` to update tables based on model definitions
2. **Custom Migration Scripts**: For more complex schema changes or data migrations

This approach allows for both simplicity in development and precision in production deployments.

## Best Practices

- Always backup your database before running migrations
- Test migrations in development before applying to production
- Keep migration scripts idempotent (can be run multiple times safely)
- Document changes in migration scripts with comments
- Add new migration scripts to `runMigrations.js` when created

## Relation to Modules

### Reports Module

The `add-reports-table.js` migration creates the database schema required by the Reports module. This migration:

1. Creates the `reports` table with the following key fields:
   - `id` (UUID): Primary key for the report
   - `user_id`: References the user who created the report
   - `dataset_id`: References the dataset used for the report
   - `query`: Original natural language query
   - `status`: Report status (processing, completed, error)
   - `report_type`: Type of report (standard, executive, detailed)
   - `generated_sql`: SQL query generated for the report
   - `visualizations`: JSON string containing visualization specifications
   - `insights`: JSON string containing extracted insights
   - `narrative`: Markdown-formatted explanation of findings

2. Establishes the relationship between Datasets and Reports:
   - A Dataset can have many Reports
   - A Report belongs to a Dataset

After running this migration, the Reports module will be able to store and retrieve report data from the database.