const jwt = require('jsonwebtoken');

// Generate a valid JWT token for testing
const generateTestToken = (payload, options = {}) => {
  const defaultPayload = {
    id: 1,
    email: 'test@test.com',
    isAdmin: false,
    ...payload
  };

  return jwt.sign(
    defaultPayload,
    process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production',
    { expiresIn: '1h', ...options }
  );
};

// Generate an expired token for testing
const generateExpiredToken = (payload = {}) => {
  const defaultPayload = {
    id: 1,
    email: 'test@test.com',
    isAdmin: false,
    ...payload
  };

  return jwt.sign(
    defaultPayload,
    process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production',
    { expiresIn: '-1h' } // Already expired
  );
};

// Generate a tampered token (invalid signature)
const generateTamperedToken = () => {
  const validToken = generateTestToken();
  // Change a character in the signature to make it invalid
  return validToken.slice(0, -5) + 'XXXXX';
};

// Create a test user token (non-admin)
const createUserToken = (userId = 1, email = 'testuser@test.com') => {
  return generateTestToken({ id: userId, email, isAdmin: false });
};

// Create a test admin token
const createAdminToken = (adminId = 1, email = 'admin@test.com') => {
  return generateTestToken({ id: adminId, email, isAdmin: true });
};

// Create a super admin token
const createSuperAdminToken = (adminId = 1, email = 'admin@test.com') => {
  return generateTestToken({ id: adminId, email, isAdmin: true });
};

// Helper to set auth cookie on supertest request
const withAuth = (request, token) => {
  return request.set('Cookie', `token=${token}`);
};

// Mock SendGrid email service
const mockSendGrid = () => {
  jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
  }));
};

// Clean up between tests - helper to truncate specific tables
const cleanupTables = async (pool, tables) => {
  await pool.query('SET session_replication_role = replica');
  for (const table of tables) {
    await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }
  await pool.query('SET session_replication_role = DEFAULT');
};

module.exports = {
  generateTestToken,
  generateExpiredToken,
  generateTamperedToken,
  createUserToken,
  createAdminToken,
  createSuperAdminToken,
  withAuth,
  mockSendGrid,
  cleanupTables
};
