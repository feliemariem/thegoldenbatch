export const API_URL = process.env.REACT_APP_API_URL || 'https://the-golden-batch-api.onrender.com';
export const SITE_URL = process.env.REACT_APP_SITE_URL || 'https://the-golden-batch.onrender.com';

// Application constants (must match backend/config/constants.js)
export const AMOUNT_DUE = 25000; // Target contribution amount per graduate (in PHP)
export const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
