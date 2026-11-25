/**
 * Public Firebase Web App configuration for STARLIGHTER.
 * Note: Firebase web config values are public client identifiers (not server secrets).
 * Access control is enforced server-side via Firestore Security Rules (`firestore.rules`)
 * and Firebase Authentication Authorized Domains.
 *
 * Environment variables (`VITE_FIREBASE_*`) can still override these defaults if set.
 */
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB8Cz3xZdIEPhcys8RPhvEtppQk4vaFCgk',
  authDomain: 'starlighter-15b1f.firebaseapp.com',
  projectId: 'starlighter-15b1f',
  storageBucket: 'starlighter-15b1f.firebasestorage.app',
  messagingSenderId: '230868270941',
  appId: '1:230868270941:web:0529a8549d430fda11b2b4',
  measurementId: 'G-E6MS70FSBM',
} as const;
