const rateLimit = require('express-rate-limit');

// Helper to get client identifier (IP with normalization)
const getClientIp = (req) => {
  let ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  // Normalize localhost addresses (IPv6 ::1 and IPv4 127.0.0.1 should be treated the same)
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }

  // Strip IPv6 prefix from IPv4-mapped addresses (::ffff:192.168.1.1 -> 192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip;
};

// Rate limiter for login attempts: 5 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    console.log('[RATE LIMIT] authLimiter key:', ip, '| Path:', req.path);
    return ip;
  },
  skipSuccessfulRequests: false, // Count ALL requests, successful or not
});

// Rate limiter for registration: 3 attempts per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: { error: 'Too many registration attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    console.log('[RATE LIMIT] registerLimiter key:', ip, '| Path:', req.path);
    return ip;
  },
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
    const key = email || getClientIp(req);
    console.log('[RATE LIMIT] passwordResetLimiter key:', key, '| Path:', req.path);
    return key;
  },
  skipSuccessfulRequests: false, // Always count password reset requests
});

module.exports = {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
};
