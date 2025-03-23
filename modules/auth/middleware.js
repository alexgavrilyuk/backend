// modules/auth/middleware.js

const admin = require('firebase-admin');
require('dotenv').config();

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebaseAdmin() {
  // Check if already initialized
  if (admin.apps.length === 0) {
    try {
      // Option 1: Using a service account JSON file
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const path = require('path');
        const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT);
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          // Optional: Database URL for other Firebase services
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
      }
      // Option 2: Using environment variables (e.g., for production)
      else if (process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      }
      // Option 3: Auto-detect from GOOGLE_APPLICATION_CREDENTIALS env var
      else {
        admin.initializeApp();
      }

      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      throw error;
    }
  }

  return admin;
}

/**
 * Middleware to verify Firebase ID tokens
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
async function firebaseAuthMiddleware(req, res, next) {
  try {
    // Check for token in various places (to be more flexible with frontend implementations)
    let idToken;

    // 1. Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.split(' ')[1];
    }

    // 2. Check Firebase ID token header (some frontends use this)
    else if (req.headers['firebase-id-token']) {
      idToken = req.headers['firebase-id-token'];
    }

    // 3. Check token in query parameter (not recommended for production, but useful for debugging)
    else if (req.query && req.query.token) {
      idToken = req.query.token;
    }

    // 4. Check token in cookies
    else if (req.cookies && req.cookies.firebaseToken) {
      idToken = req.cookies.firebaseToken;
    }

    // If no token found, return authentication error
    if (!idToken) {
      console.log('No authentication token found in request');
      // Log headers to help debug
      console.log('Request headers:', JSON.stringify(req.headers, null, 2));
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Initialize Firebase Admin
    const firebaseAdmin = initializeFirebaseAdmin();

    // Verify the ID token
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);

    // Log successful authentication
    console.log(`User authenticated: ${decodedToken.email} (${decodedToken.uid})`);

    // Add user info to request
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email,
      firebaseUser: decodedToken
    };

    next();
  } catch (error) {
    console.error('Firebase Auth error:', error);

    // Return appropriate error response
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
}

module.exports = {
  firebaseAuthMiddleware,
  initializeFirebaseAdmin
};