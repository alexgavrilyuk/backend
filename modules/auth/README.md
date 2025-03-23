This README is in backend/modules/auth

# Auth Module

This module is responsible for all authentication and authorization functionality in the application.

## Responsibilities

- Firebase authentication
- JWT token verification
- User identification and session management
- Authentication middleware

## API

The module exports the following components:

### Middleware Functions

- `middleware.firebaseAuth`: Express middleware that verifies Firebase ID tokens
- `middleware.initializeFirebaseAdmin`: Function to initialize the Firebase Admin SDK

## Usage

### Firebase Authentication Middleware

```javascript
// Import the auth module
const { middleware } = require('../auth');

// Apply to routes
router.use(middleware.firebaseAuth);
// Or for specific routes
router.get('/protected-route', middleware.firebaseAuth, someController.method);
```

### Initialize Firebase Admin SDK

```javascript
const { middleware } = require('../auth');

// Initialize Firebase Admin SDK
middleware.initializeFirebaseAdmin();
```

## Dependencies

This module depends on:
- `firebase-admin`: For Firebase authentication
- Environment variables: For Firebase configuration

## Configuration

The module requires the following environment variables:

- `FIREBASE_SERVICE_ACCOUNT`: Path to Firebase service account JSON file (Option 1)
- `FIREBASE_PROJECT_ID`: Firebase project ID (Option 2, for application default credentials)
- `FIREBASE_DATABASE_URL`: Optional Firebase Database URL
- `GOOGLE_APPLICATION_CREDENTIALS`: Application default credentials (used with Option 2)

The module supports three initialization methods:
1. Using a service account JSON file (preferred for development)
2. Using application default credentials with project ID (preferred for production)
3. Auto-detection of credentials from environment (fallback)

## Authentication Flow

1. Client requests a protected resource with a Firebase ID token
2. The `firebaseAuthMiddleware` extracts the token from various places (header, query, cookie)
3. The middleware verifies the token with Firebase Admin SDK
4. If valid, user information is added to `req.user` and the request proceeds
5. If invalid, a 401 Unauthorized response is returned

## Exposed User Object

When authentication succeeds, the following user object is added to the request:

```javascript
req.user = {
  id: "firebase-user-uid",
  email: "user@example.com",
  firebaseUser: decodedToken // The full decoded Firebase token
};
```

## Error Handling

Authentication errors return a standardized JSON response:

```json
{
  "success": false,
  "error": "Authentication required"
}
```

## Best Practices

- Always apply the middleware to routes that require authentication
- Use the `req.user.id` value to associate data with users
- Keep Firebase configuration secure