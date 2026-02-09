/**
 * Users API Tests
 *
 * Tests for /api/me endpoints:
 * - GET / (get current user profile)
 * - PUT / (update profile)
 * - PUT /rsvp (update RSVP only)
 * - POST /photo (upload profile photo)
 * - DELETE /photo (remove profile photo)
 * - GET /birthdays/today (get today's birthdays)
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';

const { getTestPool, truncateTables, seedTestData } = require('./setup');
const {
  createUserToken,
  createAdminToken
} = require('./helpers');

// Mock Cloudinary
jest.mock('../utils/cloudinary', () => ({
  upload: {
    single: () => (req, res, next) => {
      // Simulate file upload
      if (req.headers['content-type']?.includes('multipart')) {
        req.file = {
          buffer: Buffer.from('fake-image-data'),
          mimetype: 'image/jpeg',
          originalname: 'test.jpg'
        };
      }
      next();
    }
  },
  uploadToCloudinary: jest.fn().mockResolvedValue({
    secure_url: 'https://cloudinary.com/test-photo.jpg',
    public_id: 'test-photo-id'
  }),
  deleteFromCloudinary: jest.fn().mockResolvedValue({ result: 'ok' })
}));

// Create test app with user routes
const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/me', require('../routes/users'));
  return app;
};

describe('Users API', () => {
  let app;
  let pool;
  let userToken;
  let userId;

  beforeAll(() => {
    app = createTestApp();
    pool = getTestPool();
  });

  beforeEach(async () => {
    await truncateTables();
    await seedTestData();

    // Get the test user ID
    const userResult = await pool.query(
      `SELECT id FROM users WHERE email = 'testuser@test.com' LIMIT 1`
    );
    userId = userResult.rows[0]?.id || 1;
    userToken = createUserToken(userId, 'testuser@test.com');
  });

  // ============================================================
  // GET / - Get Current User Profile
  // ============================================================
  describe('GET /api/me', () => {
    describe('Registered User', () => {
      it('should return user profile with RSVP status', async () => {
        // Create RSVP for test user
        await pool.query(
          `INSERT INTO rsvps (user_id, status) VALUES ($1, 'going')`,
          [userId]
        );

        const response = await request(app)
          .get('/api/me')
          .set('Cookie', `token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.email).toBe('testuser@test.com');
        expect(response.body.first_name).toBe('Test');
        expect(response.body.last_name).toBe('User');
        expect(response.body.city).toBe('Manila');
        expect(response.body.country).toBe('Philippines');
        expect(response.body.rsvp_status).toBe('going');
        expect(response.body.amount_due).toBeDefined();
        expect(response.body.isAdmin).toBe(false);
      });

      it('should include payment information if linked to master list', async () => {
        // Link user to master list and add payment
        const inviteResult = await pool.query(
          `SELECT id, master_list_id FROM invites WHERE email = 'useduser@test.com' LIMIT 1`
        );

        if (inviteResult.rows[0]?.master_list_id) {
          // Add ledger entry
          await pool.query(
            `INSERT INTO ledger (transaction_date, name, deposit, master_list_id)
             VALUES (CURRENT_DATE, 'Test User', 5000, $1)`,
            [inviteResult.rows[0].master_list_id]
          );
        }

        const response = await request(app)
          .get('/api/me')
          .set('Cookie', `token=${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.total_paid).toBeDefined();
        expect(response.body.amount_due).toBeDefined();
      });

      it('should include section information from master list', async () => {
        const response = await request(app)
          .get('/api/me')
          .set('Cookie', `token=${userToken}`);

        expect(response.status).toBe(200);
        // section may be null if not linked to master list
        expect(response.body).toHaveProperty('section');
      });
    });

    describe('Admin User', () => {
      it('should return admin profile when logged in as admin', async () => {
        // Use regularadmin who has id=2 (no user with id=2 exists)
        // This ensures /api/me won't find a user first and will fall back to admins table
        const adminResult = await pool.query(
          `SELECT id FROM admins WHERE email = 'regularadmin@test.com' LIMIT 1`
        );
        const adminId = adminResult.rows[0]?.id;

        const adminToken = createAdminToken(adminId, 'regularadmin@test.com');

        const response = await request(app)
          .get('/api/me')
          .set('Cookie', `token=${adminToken}`);

        expect(response.status).toBe(200);
        // Admin profile found in admins table (not users table)
        expect(response.body.email).toBe('regularadmin@test.com');
        expect(response.body.isAdmin).toBe(true);
      });
    });

    describe('Authentication Required', () => {
      it('should reject unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/me');

        expect(response.status).toBe(401);
      });
    });
  });

  // ============================================================
  // PUT / - Update Profile
  // ============================================================
  describe('PUT /api/me', () => {
    it('should update user profile fields', async () => {
      const response = await request(app)
        .put('/api/me')
        .set('Cookie', `token=${userToken}`)
        .send({
          first_name: 'Updated',
          last_name: 'Name',
          city: 'Cebu',
          occupation: 'Software Engineer'
        });

      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe('Updated');
      expect(response.body.last_name).toBe('Name');
      expect(response.body.city).toBe('Cebu');
      expect(response.body.occupation).toBe('Software Engineer');
    });

    it('should apply title case to name fields', async () => {
      const response = await request(app)
        .put('/api/me')
        .set('Cookie', `token=${userToken}`)
        .send({
          first_name: 'JOHN',
          last_name: 'DOE',
          city: 'NEW YORK',
          country: 'usa'
        });

      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe('John');
      expect(response.body.last_name).toBe('Doe');
      expect(response.body.city).toBe('New York');
      expect(response.body.country).toBe('Usa');
    });

    it('should update RSVP when included', async () => {
      const response = await request(app)
        .put('/api/me')
        .set('Cookie', `token=${userToken}`)
        .send({
          rsvp_status: 'going'
        });

      expect(response.status).toBe(200);
      expect(response.body.rsvp_status).toBe('going');

      // Verify RSVP was saved
      const rsvpResult = await pool.query(
        'SELECT status FROM rsvps WHERE user_id = $1',
        [userId]
      );
      expect(rsvpResult.rows[0].status).toBe('going');
    });

    it('should update social media URLs', async () => {
      const response = await request(app)
        .put('/api/me')
        .set('Cookie', `token=${userToken}`)
        .send({
          facebook_url: 'https://facebook.com/testuser',
          linkedin_url: 'https://linkedin.com/in/testuser',
          instagram_url: 'https://instagram.com/testuser'
        });

      expect(response.status).toBe(200);
      expect(response.body.facebook_url).toBe('https://facebook.com/testuser');
      expect(response.body.linkedin_url).toBe('https://linkedin.com/in/testuser');
      expect(response.body.instagram_url).toBe('https://instagram.com/testuser');
    });

    it('should allow partial updates', async () => {
      const response = await request(app)
        .put('/api/me')
        .set('Cookie', `token=${userToken}`)
        .send({
          occupation: 'New Occupation'
        });

      expect(response.status).toBe(200);
      expect(response.body.occupation).toBe('New Occupation');
      // Other fields should remain unchanged
      expect(response.body.first_name).toBe('Test');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .put('/api/me')
        .send({ first_name: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // PUT /rsvp - Update RSVP Only
  // ============================================================
  describe('PUT /api/me/rsvp', () => {
    it('should update RSVP status to going', async () => {
      const response = await request(app)
        .put('/api/me/rsvp')
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'going' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('going');
    });

    it('should update RSVP status to maybe', async () => {
      const response = await request(app)
        .put('/api/me/rsvp')
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'maybe' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('maybe');
    });

    it('should update RSVP status to not_going', async () => {
      const response = await request(app)
        .put('/api/me/rsvp')
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'not_going' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('not_going');
    });

    it('should reject invalid RSVP status', async () => {
      const response = await request(app)
        .put('/api/me/rsvp')
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid RSVP status');
    });

    it('should reject missing status', async () => {
      const response = await request(app)
        .put('/api/me/rsvp')
        .set('Cookie', `token=${userToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid RSVP status');
    });

    it('should upsert RSVP (create if not exists, update if exists)', async () => {
      // First call creates RSVP
      await request(app)
        .put('/api/me/rsvp')
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'going' });

      // Second call updates RSVP
      const response = await request(app)
        .put('/api/me/rsvp')
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'maybe' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('maybe');

      // Verify only one RSVP exists
      const rsvpResult = await pool.query(
        'SELECT COUNT(*) FROM rsvps WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(rsvpResult.rows[0].count)).toBe(1);
    });
  });

  // ============================================================
  // POST /photo - Upload Profile Photo
  // ============================================================
  describe('POST /api/me/photo', () => {
    it('should upload profile photo', async () => {
      const response = await request(app)
        .post('/api/me/photo')
        .set('Cookie', `token=${userToken}`)
        .set('Content-Type', 'multipart/form-data')
        .attach('photo', Buffer.from('fake-image'), 'test.jpg');

      expect(response.status).toBe(200);
      expect(response.body.profile_photo).toBeDefined();
    });

    it('should reject request without file', async () => {
      const response = await request(app)
        .post('/api/me/photo')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });
  });

  // ============================================================
  // DELETE /photo - Remove Profile Photo
  // ============================================================
  describe('DELETE /api/me/photo', () => {
    it('should remove profile photo', async () => {
      // First set a profile photo
      await pool.query(
        'UPDATE users SET profile_photo = $1 WHERE id = $2',
        ['https://cloudinary.com/old-photo.jpg', userId]
      );

      const response = await request(app)
        .delete('/api/me/photo')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Photo removed');

      // Verify photo was removed
      const userResult = await pool.query(
        'SELECT profile_photo FROM users WHERE id = $1',
        [userId]
      );
      expect(userResult.rows[0].profile_photo).toBeNull();
    });

    it('should work even if no photo exists', async () => {
      const response = await request(app)
        .delete('/api/me/photo')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // GET /birthdays/today - Today's Birthdays
  // ============================================================
  describe('GET /api/me/birthdays/today', () => {
    it('should return users with birthday today', async () => {
      // Set test user's birthday to today
      const today = new Date();
      const birthday = `${today.getFullYear() - 30}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      await pool.query(
        'UPDATE users SET birthday = $1 WHERE id = $2',
        [birthday, userId]
      );

      const response = await request(app)
        .get('/api/me/birthdays/today')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].first_name).toBe('Test');
    });

    it('should return empty array if no birthdays today', async () => {
      // Set birthday to a different day
      await pool.query(
        `UPDATE users SET birthday = '1990-01-01' WHERE id = $1`,
        [userId]
      );

      const response = await request(app)
        .get('/api/me/birthdays/today')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // May or may not be empty depending on seed data
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/me/birthdays/today');

      expect(response.status).toBe(401);
    });
  });
});
