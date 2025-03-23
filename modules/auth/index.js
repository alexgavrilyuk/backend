// modules/auth/index.js
const authMiddleware = require('./middleware');

/**
 * Auth module
 * Responsible for all authentication-related functionality including:
 * - Firebase authentication
 * - Token verification
 * - User identification
 */
module.exports = {
  // Export middleware functions for direct use by other modules
  middleware: {
    firebaseAuth: authMiddleware.firebaseAuthMiddleware,
    initializeFirebaseAdmin: authMiddleware.initializeFirebaseAdmin
  },

  // Module metadata - useful for documentation and discovery
  metadata: {
    name: 'auth',
    description: 'Handles authentication and authorization using Firebase'
  }
};