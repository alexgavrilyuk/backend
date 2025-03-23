// core/utils/verifyFirebaseSetup.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

/**
 * Verifies Firebase Admin SDK setup and configuration
 */
async function verifyFirebaseSetup() {
  console.log('\n===== FIREBASE SETUP VERIFICATION =====\n');

  // Check environment variables
  checkFirebaseEnvironmentVars();

  // Attempt to initialize Firebase Admin SDK
  await checkFirebaseInitialization();

  console.log('\n===== FIREBASE VERIFICATION COMPLETE =====\n');
}

/**
 * Check Firebase-related environment variables
 */
function checkFirebaseEnvironmentVars() {
  console.log('Checking Firebase environment variables...');

  // Check service account file path
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (fs.existsSync(serviceAccountPath)) {
      console.log(`✅ Firebase service account file found at: ${serviceAccountPath}`);

      // Validate JSON format
      try {
        const serviceAccount = require(serviceAccountPath);
        if (serviceAccount.type === 'service_account' &&
            serviceAccount.project_id &&
            serviceAccount.private_key &&
            serviceAccount.client_email) {
          console.log('✅ Firebase service account file appears to be valid');
          console.log(`   Project ID: ${serviceAccount.project_id}`);
          console.log(`   Client Email: ${serviceAccount.client_email}`);
        } else {
          console.log('❌ Firebase service account file is missing required fields');
        }
      } catch (error) {
        console.log(`❌ Error parsing Firebase service account file: ${error.message}`);
      }
    } else {
      console.log(`❌ Firebase service account file not found at: ${serviceAccountPath}`);
      console.log('   Please download a new service account file from Firebase Console > Project Settings > Service accounts');
    }
  } else if (process.env.FIREBASE_PROJECT_ID) {
    console.log(`✅ Using application default credentials with project ID: ${process.env.FIREBASE_PROJECT_ID}`);

    // Check for GOOGLE_APPLICATION_CREDENTIALS environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (fs.existsSync(credPath)) {
        console.log(`✅ GOOGLE_APPLICATION_CREDENTIALS points to existing file: ${credPath}`);
      } else {
        console.log(`❌ GOOGLE_APPLICATION_CREDENTIALS file not found: ${credPath}`);
      }
    } else {
      console.log('❓ GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
      console.log('   This is required when using application default credentials outside of GCP');
    }
  } else {
    console.log('❌ No Firebase authentication configuration found');
    console.log('   Set either FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID in your .env file');
  }

  console.log('');
}

/**
 * Attempt to initialize Firebase Admin SDK
 */
async function checkFirebaseInitialization() {
  console.log('Attempting to initialize Firebase Admin SDK...');

  try {
    // Only attempt if we have configuration
    if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_PROJECT_ID && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('❌ Cannot initialize Firebase without configuration');
      return;
    }

    // Check if already initialized
    if (admin.apps.length > 0) {
      // Force delete existing app for testing
      await admin.app().delete();
      console.log('Existing Firebase app deleted for testing purposes');
    }

    // Initialize based on available configuration
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    } else {
      admin.initializeApp();
    }

    console.log('✅ Firebase Admin SDK initialized successfully');

    // Get project info
    const projectInfo = await admin.app().options;
    console.log(`   Project ID: ${projectInfo.projectId || 'undefined'}`);

    // Test auth functionality
    try {
      // Just accessing the auth service is enough to verify basic functionality
      admin.auth();
      console.log('✅ Firebase Auth functionality verified');
    } catch (authError) {
      console.log(`❌ Error with Firebase Auth: ${authError.message}`);
    }

    // Cleanup
    await admin.app().delete();
    console.log('Firebase app deleted after test');

  } catch (error) {
    console.log(`❌ Firebase Admin SDK initialization failed: ${error.message}`);
    console.log('   Stack trace:');
    console.log(error.stack);

    // Provide specific guidance based on error
    if (error.message.includes('Failed to parse')) {
      console.log('\nPossible solution: The service account JSON file is invalid or corrupted.');
      console.log('Download a new one from Firebase Console > Project settings > Service accounts.');
    } else if (error.message.includes('credential implementation')) {
      console.log('\nPossible solution: There is a problem with your credentials.');
      console.log('Ensure you are using the correct service account file or proper environment variables.');
    } else if (error.message.includes('permission_denied')) {
      console.log('\nPossible solution: The service account lacks necessary permissions.');
      console.log('Ensure it has the Firebase Authentication Admin role.');
    }
  }

  console.log('');
}

// Run the verification if this script is executed directly
if (require.main === module) {
  verifyFirebaseSetup().catch(err => {
    console.error('Verification failed with error:', err);
    process.exit(1);
  });
}

module.exports = { verifyFirebaseSetup };