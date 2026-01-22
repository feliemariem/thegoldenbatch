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
// IMPORTANT: skipSuccessfulRequests MUST be false to prevent brute force attacks
// Even correct passwords must be blocked during the ban period
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  statusCode: 429,
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  // Count ALL requests - both successful and failed logins
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  // Handler MUST send response and NOT call next() to block the request
  handler: (req, res) => {
    return res.status(429).json({ error: 'Too many login attempts, please try again after 15 minutes' });
  },
});

// Rate limiter for registration: 3 attempts per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  statusCode: 429,
  message: { error: 'Too many registration attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  // For registration, skip successful requests (user registered successfully)
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  handler: (req, res) => {
    return res.status(429).json({ error: 'Too many registration attempts, please try again after 15 minutes' });
  },
});

// Rate limiter for password reset: 3 attempts per hour per email
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  statusCode: 429,
  message: { error: 'Too many password reset attempts, please try again after an hour' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase();
    return email || getClientIp(req);
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  handler: (req, res) => {
    return res.status(429).json({ error: 'Too many password reset attempts, please try again after an hour' });
  },
});

module.exports = {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
};
