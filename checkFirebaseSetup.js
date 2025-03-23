// checkFirebaseSetup.js

// // Import the Firebase verification utility
const { verifyFirebaseSetup } = require('./core/utils');

// Run the verification
verifyFirebaseSetup()
  .then(() => {
    console.log('Firebase setup verification completed');
  })
  .catch(err => {
    console.error('Firebase setup verification failed:', err);
    process.exit(1);
  });