This README is in backend/app

# App Folder

This folder contains the core application setup files that initialize, configure and start the Express application.

## Overview

The app folder is responsible for the composition and bootstrapping of the application. It brings together all modules, middleware, and configuration to create a functioning Express server. This folder doesn't contain business logic but instead focuses on application assembly and startup.

## Files

### index.js

**Purpose**: Creates and configures the Express application instance.

**Functionality**:
- Imports and initializes Express
- Configures middleware (CORS, cookie-parser, body-parser, etc.)
- Sets up file upload handling with express-fileupload
- Initializes Firebase Admin SDK
- Creates the Express app with proper configuration
- Defines a `start()` method that:
  - Tests database connection
  - Runs migrations
  - Verifies BigQuery configuration and connectivity
  - Starts the HTTP server

**Usage**:
```javascript
const { createApp } = require('./index');
const app = createApp();
app.start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

### routes.js

**Purpose**: Centralizes route registration for all application modules.

**Functionality**:
- Imports routes from all feature modules
- Registers global middleware (request logging, rate limiting)
- Mounts each module's routes at the appropriate path
- Sets up debug/test routes
- Applies the global error handler middleware (must be last)

**Key Concepts**:
- Route organization by module
- Centralized middleware application
- Authentication middleware application where needed
- Error handler registration

**Usage**:
```javascript
const { registerRoutes } = require('./routes');
// Apply routes to Express app
registerRoutes(app);
```

### server.js

**Purpose**: Application entry point that starts the Express server.

**Functionality**:
- Imports the application from index.js
- Calls the start method to initialize the server
- Sets up global error handlers for uncaught exceptions and unhandled rejections
- Manages graceful shutdown

**Key Features**:
- Process-level error handling
- Clean error reporting
- Exit code management
- Starting point for the application

**Usage**:
This file is typically the entry point specified in package.json:
```json
{
  "scripts": {
    "start": "node app/server.js"
  }
}
```

## Flow

The application startup flow is:

1. `server.js` is invoked by Node.js
2. `server.js` imports the app creation function from `index.js`
3. The app is created with all middleware and configuration
4. `registerRoutes` from `routes.js` is called to wire up all module routes
5. `app.start()` is called to:
   - Initialize database
   - Run migrations
   - Verify external service connectivity
   - Start the HTTP server
6. Global error handlers are registered to catch any unhandled errors

## Best Practices

- Avoid putting business logic in these files
- Keep the configuration and startup code clean and focused
- Handle startup errors gracefully
- Log initialization steps clearly
- Maintain a clear separation between app configuration and domain logic