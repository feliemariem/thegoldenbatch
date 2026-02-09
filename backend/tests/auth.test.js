/**
 * Authentication Tests
 *
 * Tests for /api/auth endpoints:
 * - POST /login (valid, invalid, missing fields, rate limiting)
 * - POST /register (valid invite, used invite, expired invite, no RSVP)
 * - POST /logout (clear cookies)
 * - POST /forgot-password (valid email, invalid email)
 * - POST /reset-password (valid token, expired token, mismatched passwords)
 * - JWT validation (valid, expired, tampered tokens)
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';

const { getTestPool, truncateTables, seedTestData } = require('./setup');
const {
  generateTestToken,
  generateExpiredToken,
  generateTamperedToken,
  withAuth
} = require('./helpers');

// Mock SendGrid before requiring auth routes
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

// Create test app with auth routes
const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  return app;
};

describe('Authentication API', () => {
  let app;
  let pool;

  beforeAll(() => {
    app = createTestApp();
    pool = getTestPool();
  });

  beforeEach(async () => {
    // Reset test data before each test
    await truncateTables();
    await seedTestData();
  });

  // ============================================================
  // LOGIN TESTS
  // ============================================================
  describe('POST /api/auth/login', () => {
    describe('Successful Login', () => {
      it('should login a valid user and set auth cookie', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'testuser@test.com', password: 'user123' });

        expect(response.status).toBe(200);
        expect(response.body.user).toBeDefined();
        expect(response.body.user.email).toBe('testuser@test.com');
        expect(response.body.user.first_name).toBe('Test');
        expect(response.body.user.isAdmin).toBe(false);

        // Check cookie was set
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies[0]).toContain('token=');
        expect(cookies[0]).toContain('HttpOnly');
      });

      it('should login an admin from admins table', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'admin@test.com', password: 'admin123' });

        expect(response.status).toBe(200);
        expect(response.body.user).toBeDefined();
        expect(response.body.user.email).toBe('admin@test.com');
        expect(response.body.user.isAdmin).toBe(true);
      });

      it('should set longer expiry cookie when rememberMe is true', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'testuser@test.com', password: 'user123', rememberMe: true });

        expect(response.status).toBe(200);

        // Check cookie has Max-Age set (30 days)
        const cookies = response.headers['set-cookie'];
        expect(cookies[0]).toContain('Max-Age=');
      });

      it('should set session cookie when rememberMe is false', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'testuser@test.com', password: 'user123', rememberMe: false });

        expect(response.status).toBe(200);

        // Check cookie does NOT have Max-Age (session cookie)
        const cookies = response.headers['set-cookie'];
        expect(cookies[0]).not.toContain('Max-Age=');
      });
    });

    describe('Invalid Credentials', () => {
      it('should reject invalid password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'testuser@test.com', password: 'wrongpassword' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid credentials');
      });

      it('should reject non-existent email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'nonexistent@test.com', password: 'password123' });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Invalid credentials');
      });

      it('should be case-insensitive for email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'TESTUSER@TEST.COM', password: 'user123' });

        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe('testuser@test.com');
      });
    });

    describe('Missing Fields', () => {
      it('should reject missing email', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ password: 'password123' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Email and password required');
      });

      it('should reject missing password', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'testuser@test.com' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Email and password required');
      });

      it('should reject empty body', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Email and password required');
      });
    });

    describe('Admin Flag Detection', () => {
      it('should detect admin flag from master_list for user login', async () => {
        // Update master_list to mark testuser as admin
        await pool.query(
          `UPDATE master_list SET is_admin = true WHERE email = 'testuser@test.com'`
        );

        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: 'testuser@test.com', password: 'user123' });

        expect(response.status).toBe(200);
        expect(response.body.user.isAdmin).toBe(true);
      });
    });
  });

  // ============================================================
  // REGISTRATION TESTS
  // ============================================================
  describe('POST /api/auth/register', () => {
    describe('Successful Registration', () => {
      it('should register a new user with valid invite token', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: '550e8400-e29b-41d4-a716-446655440001',
            password: 'newpassword123',
            first_name: 'New',
            last_name: 'User',
            city: 'Cebu',
            country: 'Philippines'
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Registration successful');
        expect(response.body.user).toBeDefined();
        expect(response.body.user.email).toBe('newuser@test.com');
        expect(response.body.user.first_name).toBe('New');

        // Check auth cookie was set
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies[0]).toContain('token=');
      });

      it('should mark invite as used after registration', async () => {
        await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: '550e8400-e29b-41d4-a716-446655440001',
            password: 'newpassword123',
            first_name: 'New',
            last_name: 'User',
            city: 'Cebu',
            country: 'Philippines'
          });

        // Try to register again with same token
        const response2 = await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: '550e8400-e29b-41d4-a716-446655440001',
            password: 'anotherpassword',
            first_name: 'Another',
            last_name: 'User',
            city: 'Manila',
            country: 'Philippines'
          });

        expect(response2.status).toBe(400);
        expect(response2.body.error).toBe('Invite already used');
      });

      it('should save RSVP if provided during registration', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: '550e8400-e29b-41d4-a716-446655440001',
            password: 'newpassword123',
            first_name: 'New',
            last_name: 'User',
            city: 'Cebu',
            country: 'Philippines',
            rsvp: 'going'
          });

        expect(response.status).toBe(201);

        // Verify RSVP was saved
        const rsvpResult = await pool.query(
          'SELECT status FROM rsvps WHERE user_id = $1',
          [response.body.user.id]
        );
        expect(rsvpResult.rows.length).toBe(1);
        expect(rsvpResult.rows[0].status).toBe('going');
      });

      it('should apply title case to names', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: '550e8400-e29b-41d4-a716-446655440001',
            password: 'newpassword123',
            first_name: 'JOHN',
            last_name: 'DOE',
            city: 'MANILA',
            country: 'PHILIPPINES'
          });

        expect(response.status).toBe(201);
        expect(response.body.user.first_name).toBe('John');
        expect(response.body.user.last_name).toBe('Doe');
      });
    });

    describe('Invalid Invite Token', () => {
      it('should reject invalid invite token', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: 'nonexistent-token',
            password: 'password123',
            first_name: 'Test',
            last_name: 'User',
            city: 'Manila',
            country: 'Philippines'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid invite token');
      });

      it('should reject already used invite token', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: '550e8400-e29b-41d4-a716-446655440002',
            password: 'password123',
            first_name: 'Test',
            last_name: 'User',
            city: 'Manila',
            country: 'Philippines'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invite already used');
      });
    });

    describe('Missing Required Fields', () => {
      it('should reject missing invite_token', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            password: 'password123',
            first_name: 'Test',
            last_name: 'User',
            city: 'Manila',
            country: 'Philippines'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('invite_token');
      });

      it('should reject missing password', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: '550e8400-e29b-41d4-a716-446655440001',
            first_name: 'Test',
            last_name: 'User',
            city: 'Manila',
            country: 'Philippines'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('password');
      });

      it('should reject missing required profile fields', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            invite_token: '550e8400-e29b-41d4-a716-446655440001',
            password: 'password123',
            first_name: 'Test'
            // Missing last_name, city, country
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Required fields');
      });
    });
  });

  // ============================================================
  // LOGOUT TESTS
  // ============================================================
  describe('POST /api/auth/logout', () => {
    it('should clear the auth cookie on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out');

      // Check cookie was cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('token=;');
    });

    it('should work even without existing auth cookie', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out');
    });
  });

  // ============================================================
  // FORGOT PASSWORD TESTS
  // ============================================================
  describe('POST /api/auth/forgot-password', () => {
    it('should accept valid email and create reset token', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'testuser@test.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reset link has been sent');

      // Verify reset token was created
      const resetResult = await pool.query(
        'SELECT * FROM password_resets WHERE email = $1',
        ['testuser@test.com']
      );
      expect(resetResult.rows.length).toBe(1);
      expect(resetResult.rows[0].used).toBe(false);
    });

    it('should return error for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Email not found');
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');
    });

    it('should delete existing reset tokens for same email', async () => {
      // Create first reset token
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'testuser@test.com' });

      const firstResult = await pool.query(
        'SELECT token FROM password_resets WHERE email = $1',
        ['testuser@test.com']
      );
      const firstToken = firstResult.rows[0].token;

      // Create second reset token
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'testuser@test.com' });

      const secondResult = await pool.query(
        'SELECT token FROM password_resets WHERE email = $1',
        ['testuser@test.com']
      );

      expect(secondResult.rows.length).toBe(1);
      expect(secondResult.rows[0].token).not.toBe(firstToken);
    });

    it('should work for admin emails too', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'admin@test.com' });

      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // VALIDATE RESET TOKEN TESTS
  // ============================================================
  describe('GET /api/auth/reset-password/:token', () => {
    let validToken;

    beforeEach(async () => {
      // Create a valid reset token
      validToken = 'test-reset-token-12345';
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await pool.query(
        'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
        ['testuser@test.com', validToken, expiresAt]
      );
    });

    it('should validate a valid token', async () => {
      const response = await request(app)
        .get(`/api/auth/reset-password/${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.email).toBe('testuser@test.com');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/reset-password/invalid-token');

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Invalid reset link');
    });

    it('should reject expired token', async () => {
      // Create expired token
      const expiredToken = 'expired-token-67890';
      const expiredAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      await pool.query(
        'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
        ['testuser@test.com', expiredToken, expiredAt]
      );

      const response = await request(app)
        .get(`/api/auth/reset-password/${expiredToken}`);

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Reset link has expired');
    });

    it('should reject already used token', async () => {
      // Mark token as used
      await pool.query(
        'UPDATE password_resets SET used = true WHERE token = $1',
        [validToken]
      );

      const response = await request(app)
        .get(`/api/auth/reset-password/${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Reset link already used');
    });
  });

  // ============================================================
  // RESET PASSWORD TESTS
  // ============================================================
  describe('POST /api/auth/reset-password', () => {
    let validToken;

    beforeEach(async () => {
      // Create a valid reset token
      validToken = 'test-reset-token-12345';
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await pool.query(
        'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
        ['testuser@test.com', validToken, expiresAt]
      );
    });

    it('should reset password with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: validToken, password: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Password reset successful');

      // Verify password was changed by attempting login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'testuser@test.com', password: 'newpassword123' });

      expect(loginResponse.status).toBe(200);
    });

    it('should mark reset token as used after successful reset', async () => {
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: validToken, password: 'newpassword123' });

      const result = await pool.query(
        'SELECT used FROM password_resets WHERE token = $1',
        [validToken]
      );

      expect(result.rows[0].used).toBe(true);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token', password: 'newpassword123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid reset link');
    });

    it('should reject expired token', async () => {
      const expiredToken = 'expired-token-67890';
      const expiredAt = new Date(Date.now() - 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
        ['testuser@test.com', expiredToken, expiredAt]
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: expiredToken, password: 'newpassword123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Reset link has expired');
    });

    it('should reject password shorter than 6 characters', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: validToken, password: '12345' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 6 characters');
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ password: 'newpassword123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Token and password are required');
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: validToken });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Token and password are required');
    });

    it('should work for admin password reset', async () => {
      const adminToken = 'admin-reset-token';
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
        ['admin@test.com', adminToken, expiresAt]
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: adminToken, password: 'newadminpass123' });

      expect(response.status).toBe(200);

      // Verify admin can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'newadminpass123' });

      expect(loginResponse.status).toBe(200);
    });
  });

  // ============================================================
  // JWT VALIDATION TESTS
  // ============================================================
  describe('JWT Token Validation', () => {
    // These tests verify middleware behavior using a protected endpoint
    // We'll create a mini test app with the auth middleware

    let protectedApp;

    beforeAll(() => {
      protectedApp = express();
      protectedApp.use(cookieParser());
      protectedApp.use(express.json());

      const { authenticateToken } = require('../middleware/auth');

      protectedApp.get('/protected', authenticateToken, (req, res) => {
        res.json({ user: req.user, message: 'Access granted' });
      });
    });

    it('should accept valid JWT token', async () => {
      const token = generateTestToken({
        id: 1,
        email: 'testuser@test.com',
        isAdmin: false
      });

      const response = await request(protectedApp)
        .get('/protected')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Access granted');
      expect(response.body.user.email).toBe('testuser@test.com');
    });

    it('should reject expired JWT token', async () => {
      const token = generateExpiredToken({
        id: 1,
        email: 'testuser@test.com',
        isAdmin: false
      });

      const response = await request(protectedApp)
        .get('/protected')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should reject tampered JWT token', async () => {
      const token = generateTamperedToken();

      const response = await request(protectedApp)
        .get('/protected')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should reject missing token', async () => {
      const response = await request(protectedApp)
        .get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });

    it('should reject token with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { id: 1, email: 'test@test.com', isAdmin: false },
        'wrong-secret-key',
        { expiresIn: '1h' }
      );

      const response = await request(protectedApp)
        .get('/protected')
        .set('Cookie', `token=${wrongSecretToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or expired token');
    });
  });

  // ============================================================
  // ADMIN MIDDLEWARE TESTS
  // ============================================================
  describe('Admin Middleware', () => {
    let adminApp;

    beforeAll(() => {
      adminApp = express();
      adminApp.use(cookieParser());
      adminApp.use(express.json());

      const { authenticateAdmin } = require('../middleware/auth');

      adminApp.get('/admin-only', authenticateAdmin, (req, res) => {
        res.json({ user: req.user, message: 'Admin access granted' });
      });
    });

    it('should accept valid admin token', async () => {
      const token = generateTestToken({
        id: 1,
        email: 'admin@test.com',
        isAdmin: true
      });

      const response = await request(adminApp)
        .get('/admin-only')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Admin access granted');
    });

    it('should reject non-admin token', async () => {
      const token = generateTestToken({
        id: 1,
        email: 'testuser@test.com',
        isAdmin: false
      });

      const response = await request(adminApp)
        .get('/admin-only')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should reject missing token', async () => {
      const response = await request(adminApp)
        .get('/admin-only');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Access token required');
    });
  });
});
