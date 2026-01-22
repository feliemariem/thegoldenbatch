const rateLimit = require('express-rate-limit');

// Helper to get client identifier (IP with fallback)
const getClientIp = (req) => {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
};

// Rate limiter for login attempts: 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limiter for registration: 3 attempts per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: { error: 'Too many registration attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skipSuccessfulRequests: true, // Don't count successful registrations
});

// Rate limiter for password reset: 3 attempts per hour per email
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many password reset attempts, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email if provided (for password reset), otherwise fall back to IP
    const email = req.body?.email?.toLowerCase();
    return email || getClientIp(req);
  },
  skipSuccessfulRequests: false, // Always count password reset requests
});

module.exports = {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
};
