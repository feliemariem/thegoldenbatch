/**
 * Application Constants
 * Centralized location for magic numbers and configuration values
 */

// Financial constants
const AMOUNT_DUE = 25000; // Target contribution amount per graduate (in PHP)

// JWT token expiry durations
const JWT_EXPIRY_DEFAULT = '7d';      // Default token expiry (registration)
const JWT_EXPIRY_REMEMBER = '30d';    // Extended expiry when "Remember Me" is checked
const JWT_EXPIRY_SHORT = '1d';        // Short expiry when "Remember Me" is not checked

// Session management
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

module.exports = {
  AMOUNT_DUE,
  JWT_EXPIRY_DEFAULT,
  JWT_EXPIRY_REMEMBER,
  JWT_EXPIRY_SHORT,
  SESSION_TIMEOUT_MS,
};
