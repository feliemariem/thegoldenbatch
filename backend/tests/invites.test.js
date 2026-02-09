/**
 * Invites API Tests
 *
 * Tests for /api/invites endpoints:
 * - POST / (create invite - admin only)
 * - POST /bulk (bulk upload - admin only)
 * - GET /:token/validate (public - validate invite token)
 * - GET / (list all invites - admin only with pagination)
 * - PUT /:id (update invite - admin only)
 * - DELETE /:id (delete invite - admin only)
 * - PUT /:id/link (link to master list - admin only)
 * - PUT /:id/unlink (unlink from master list - admin only)
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
process.env.FRONTEND_URL = 'http://localhost:3000';

const { getTestPool, truncateTables, seedTestData } = require('./setup');
const {
  createAdminToken,
  createUserToken
} = require('./helpers');

// Mock SendGrid before requiring routes
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

// Create test app with invite routes
const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/invites', require('../routes/invites'));
  return app;
};

describe('Invites API', () => {
  let app;
  let pool;
  let adminToken;

  beforeAll(() => {
    app = createTestApp();
    pool = getTestPool();
  });

  beforeEach(async () => {
    await truncateTables();
    await seedTestData();
    adminToken = createAdminToken(1, 'admin@test.com');
  });

  // ============================================================
  // POST / - Create Invite
  // ============================================================
  describe('POST /api/invites', () => {
    describe('Successful Creation', () => {
      it('should create a new invite', async () => {
        const response = await request(app)
          .post('/api/invites')
          .set('Cookie', `token=${adminToken}`)
          .send({
            email: 'newinvite@test.com',
            first_name: 'New',
            last_name: 'Invitee'
          });

        expect(response.status).toBe(201);
        expect(response.body.email).toBe('newinvite@test.com');
        expect(response.body.first_name).toBe('New');
        expect(response.body.last_name).toBe('Invitee');
        expect(response.body.invite_token).toBeDefined();
        expect(response.body.registrationUrl).toContain('/register/');
      });

      it('should create invite with email only', async () => {
        const response = await request(app)
          .post('/api/invites')
          .set('Cookie', `token=${adminToken}`)
          .send({
            email: 'emailonly@test.com'
          });

        expect(response.status).toBe(201);
        expect(response.body.email).toBe('emailonly@test.com');
        expect(response.body.first_name).toBeNull();
        expect(response.body.last_name).toBeNull();
      });

      it('should lowercase email', async () => {
        const response = await request(app)
          .post('/api/invites')
          .set('Cookie', `token=${adminToken}`)
          .send({
            email: 'UPPERCASE@TEST.COM',
            first_name: 'Test',
            last_name: 'User'
          });

        expect(response.status).toBe(201);
        expect(response.body.email).toBe('uppercase@test.com');
      });
    });

    describe('Validation Errors', () => {
      it('should reject missing email', async () => {
        const response = await request(app)
          .post('/api/invites')
          .set('Cookie', `token=${adminToken}`)
          .send({
            first_name: 'No',
            last_name: 'Email'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Email is required');
      });

      it('should reject duplicate email', async () => {
        // First create an invite
        await request(app)
          .post('/api/invites')
          .set('Cookie', `token=${adminToken}`)
          .send({ email: 'duplicate@test.com' });

        // Try to create another with same email
        const response = await request(app)
          .post('/api/invites')
          .set('Cookie', `token=${adminToken}`)
          .send({ email: 'duplicate@test.com' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Email already invited');
      });
    });

    describe('Authentication Required', () => {
      it('should reject unauthenticated requests', async () => {
        const response = await request(app)
          .post('/api/invites')
          .send({ email: 'test@test.com' });

        expect(response.status).toBe(401);
      });

      it('should reject non-admin users', async () => {
        const userToken = createUserToken(1, 'testuser@test.com');

        const response = await request(app)
          .post('/api/invites')
          .set('Cookie', `token=${userToken}`)
          .send({ email: 'test@test.com' });

        expect(response.status).toBe(403);
      });
    });
  });

  // ============================================================
  // POST /bulk - Bulk Upload
  // ============================================================
  describe('POST /api/invites/bulk', () => {
    it('should create multiple invites', async () => {
      const response = await request(app)
        .post('/api/invites/bulk')
        .set('Cookie', `token=${adminToken}`)
        .send({
          invites: [
            { email: 'bulk1@test.com', first_name: 'Bulk', last_name: 'One' },
            { email: 'bulk2@test.com', first_name: 'Bulk', last_name: 'Two' },
            { email: 'bulk3@test.com', first_name: 'Bulk', last_name: 'Three' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Created 3 invites');
      expect(response.body.success).toHaveLength(3);
      expect(response.body.duplicates).toHaveLength(0);
      expect(response.body.errors).toHaveLength(0);
    });

    it('should track duplicates in bulk upload', async () => {
      // Create an existing invite first
      await pool.query(
        `INSERT INTO invites (email, first_name, last_name) VALUES ('existing@test.com', 'Existing', 'User')`
      );

      const response = await request(app)
        .post('/api/invites/bulk')
        .set('Cookie', `token=${adminToken}`)
        .send({
          invites: [
            { email: 'new@test.com', first_name: 'New', last_name: 'User' },
            { email: 'existing@test.com', first_name: 'Existing', last_name: 'User' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Created 1 invites');
      expect(response.body.success).toHaveLength(1);
      expect(response.body.duplicates).toContain('existing@test.com');
    });

    it('should reject empty invites array', async () => {
      const response = await request(app)
        .post('/api/invites/bulk')
        .set('Cookie', `token=${adminToken}`)
        .send({ invites: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invites array is required');
    });

    it('should reject missing invites field', async () => {
      const response = await request(app)
        .post('/api/invites/bulk')
        .set('Cookie', `token=${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invites array is required');
    });
  });

  // ============================================================
  // GET /:token/validate - Validate Token (Public)
  // ============================================================
  describe('GET /api/invites/:token/validate', () => {
    it('should validate a valid unused token', async () => {
      const response = await request(app)
        .get('/api/invites/550e8400-e29b-41d4-a716-446655440001/validate');

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.email).toBe('newuser@test.com');
      expect(response.body.first_name).toBe('New');
      expect(response.body.last_name).toBe('User');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/invites/nonexistent-token/validate');

      expect(response.status).toBe(404);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Invalid invite token');
    });

    it('should reject already used token', async () => {
      const response = await request(app)
        .get('/api/invites/550e8400-e29b-41d4-a716-446655440002/validate');

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Invite already used');
    });

    it('should work without authentication', async () => {
      // This is a public endpoint
      const response = await request(app)
        .get('/api/invites/550e8400-e29b-41d4-a716-446655440001/validate');

      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // GET / - List Invites (Admin Only)
  // ============================================================
  describe('GET /api/invites', () => {
    beforeEach(async () => {
      // Add more invites for pagination testing
      for (let i = 1; i <= 5; i++) {
        await pool.query(
          `INSERT INTO invites (email, first_name, last_name, used) VALUES ($1, $2, $3, $4)`,
          [`test${i}@test.com`, `Test${i}`, `User${i}`, i % 2 === 0]
        );
      }
    });

    it('should return paginated list of invites', async () => {
      const response = await request(app)
        .get('/api/invites')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invites).toBeDefined();
      expect(Array.isArray(response.body.invites)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.stats).toBeDefined();
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/invites?page=1&limit=2')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.invites.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should support search filter', async () => {
      const response = await request(app)
        .get('/api/invites?search=test1')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      // Should find invite with email containing 'test1'
      const foundEmails = response.body.invites.map(i => i.email);
      const hasMatch = foundEmails.some(e => e.includes('test1'));
      expect(hasMatch).toBe(true);
    });

    it('should support status filter - registered', async () => {
      const response = await request(app)
        .get('/api/invites?status=registered')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      // All returned invites should be used
      response.body.invites.forEach(invite => {
        expect(invite.used).toBe(true);
      });
    });

    it('should support status filter - pending', async () => {
      const response = await request(app)
        .get('/api/invites?status=pending')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      // All returned invites should be unused
      response.body.invites.forEach(invite => {
        expect(invite.used).toBe(false);
      });
    });

    it('should include stats in response', async () => {
      const response = await request(app)
        .get('/api/invites')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.stats.total).toBeDefined();
      expect(response.body.stats.registered).toBeDefined();
      expect(response.body.stats.pending).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/invites');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // PUT /:id - Update Invite
  // ============================================================
  describe('PUT /api/invites/:id', () => {
    let pendingInviteId;

    beforeEach(async () => {
      // Create a pending invite
      const result = await pool.query(
        `INSERT INTO invites (email, first_name, last_name, used) VALUES ('pending@test.com', 'Pending', 'User', false) RETURNING id`
      );
      pendingInviteId = result.rows[0].id;
    });

    it('should update a pending invite', async () => {
      const response = await request(app)
        .put(`/api/invites/${pendingInviteId}`)
        .set('Cookie', `token=${adminToken}`)
        .send({
          first_name: 'Updated',
          last_name: 'Name'
        });

      expect(response.status).toBe(200);
      expect(response.body.first_name).toBe('Updated');
      expect(response.body.last_name).toBe('Name');
    });

    it('should update email to lowercase', async () => {
      const response = await request(app)
        .put(`/api/invites/${pendingInviteId}`)
        .set('Cookie', `token=${adminToken}`)
        .send({
          email: 'NEWEMAIL@TEST.COM'
        });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('newemail@test.com');
    });

    it('should reject updating a used invite', async () => {
      // Create a used invite
      const usedResult = await pool.query(
        `INSERT INTO invites (email, first_name, last_name, used) VALUES ('used@test.com', 'Used', 'User', true) RETURNING id`
      );
      const usedInviteId = usedResult.rows[0].id;

      const response = await request(app)
        .put(`/api/invites/${usedInviteId}`)
        .set('Cookie', `token=${adminToken}`)
        .send({ first_name: 'Cannot' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot edit a used invite');
    });

    it('should return 404 for non-existent invite', async () => {
      const response = await request(app)
        .put('/api/invites/99999')
        .set('Cookie', `token=${adminToken}`)
        .send({ first_name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invite not found');
    });

    it('should reject duplicate email on update', async () => {
      // Create another invite
      await pool.query(
        `INSERT INTO invites (email, first_name, last_name) VALUES ('another@test.com', 'Another', 'User')`
      );

      const response = await request(app)
        .put(`/api/invites/${pendingInviteId}`)
        .set('Cookie', `token=${adminToken}`)
        .send({ email: 'another@test.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email already exists');
    });
  });

  // ============================================================
  // DELETE /:id - Delete Invite
  // ============================================================
  describe('DELETE /api/invites/:id', () => {
    let pendingInviteId;

    beforeEach(async () => {
      const result = await pool.query(
        `INSERT INTO invites (email, first_name, last_name, used) VALUES ('todelete@test.com', 'Delete', 'Me', false) RETURNING id`
      );
      pendingInviteId = result.rows[0].id;
    });

    it('should delete a pending invite', async () => {
      const response = await request(app)
        .delete(`/api/invites/${pendingInviteId}`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Invite deleted');

      // Verify it's actually deleted
      const checkResult = await pool.query(
        'SELECT * FROM invites WHERE id = $1',
        [pendingInviteId]
      );
      expect(checkResult.rows.length).toBe(0);
    });

    it('should reject deleting a used invite', async () => {
      const usedResult = await pool.query(
        `INSERT INTO invites (email, first_name, last_name, used) VALUES ('useddelete@test.com', 'Used', 'Delete', true) RETURNING id`
      );
      const usedInviteId = usedResult.rows[0].id;

      const response = await request(app)
        .delete(`/api/invites/${usedInviteId}`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot delete a used invite');
    });

    it('should return 404 for non-existent invite', async () => {
      const response = await request(app)
        .delete('/api/invites/99999')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Invite not found');
    });

    it('should clean up master list link when deleting', async () => {
      // Create master list entry
      const mlResult = await pool.query(
        `INSERT INTO master_list (section, first_name, last_name, email, status)
         VALUES ('A', 'Linked', 'User', 'linked@test.com', 'Invited')
         RETURNING id`
      );
      const masterListId = mlResult.rows[0].id;

      // Create invite linked to master list
      const inviteResult = await pool.query(
        `INSERT INTO invites (email, first_name, last_name, used, master_list_id)
         VALUES ('linked@test.com', 'Linked', 'User', false, $1)
         RETURNING id`,
        [masterListId]
      );
      const linkedInviteId = inviteResult.rows[0].id;

      // Delete the invite
      const response = await request(app)
        .delete(`/api/invites/${linkedInviteId}`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);

      // Verify master list was cleaned up
      const mlCheck = await pool.query(
        'SELECT email, status, is_admin FROM master_list WHERE id = $1',
        [masterListId]
      );
      expect(mlCheck.rows[0].email).toBeNull();
      expect(mlCheck.rows[0].status).toBe('Not Invited');
      expect(mlCheck.rows[0].is_admin).toBe(false);
    });
  });

  // ============================================================
  // PUT /:id/link - Link to Master List
  // ============================================================
  describe('PUT /api/invites/:id/link', () => {
    let inviteId;
    let masterListId;

    beforeEach(async () => {
      // Create invite
      const inviteResult = await pool.query(
        `INSERT INTO invites (email, first_name, last_name, used)
         VALUES ('tolink@test.com', 'To', 'Link', false)
         RETURNING id`
      );
      inviteId = inviteResult.rows[0].id;

      // Create master list entry
      const mlResult = await pool.query(
        `INSERT INTO master_list (section, first_name, last_name, status)
         VALUES ('A', 'Master', 'Entry', 'Not Invited')
         RETURNING id`
      );
      masterListId = mlResult.rows[0].id;
    });

    it('should link invite to master list entry', async () => {
      const response = await request(app)
        .put(`/api/invites/${inviteId}/link`)
        .set('Cookie', `token=${adminToken}`)
        .send({ master_list_id: masterListId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify link was created
      const inviteCheck = await pool.query(
        'SELECT master_list_id FROM invites WHERE id = $1',
        [inviteId]
      );
      expect(inviteCheck.rows[0].master_list_id).toBe(masterListId);

      // Verify master list was updated
      const mlCheck = await pool.query(
        'SELECT email, current_name, status FROM master_list WHERE id = $1',
        [masterListId]
      );
      expect(mlCheck.rows[0].email).toBe('tolink@test.com');
      expect(mlCheck.rows[0].current_name).toBe('To Link');
      expect(mlCheck.rows[0].status).toBe('Pending');
    });

    it('should set status to Registered if invite is already used', async () => {
      // Mark invite as used
      await pool.query('UPDATE invites SET used = true WHERE id = $1', [inviteId]);

      const response = await request(app)
        .put(`/api/invites/${inviteId}/link`)
        .set('Cookie', `token=${adminToken}`)
        .send({ master_list_id: masterListId });

      expect(response.status).toBe(200);

      // Verify status is Registered
      const mlCheck = await pool.query(
        'SELECT status FROM master_list WHERE id = $1',
        [masterListId]
      );
      expect(mlCheck.rows[0].status).toBe('Registered');
    });

    it('should return 404 for non-existent invite', async () => {
      const response = await request(app)
        .put('/api/invites/99999/link')
        .set('Cookie', `token=${adminToken}`)
        .send({ master_list_id: masterListId });

      expect(response.status).toBe(404);
    });
  });

  // ============================================================
  // PUT /:id/unlink - Unlink from Master List
  // ============================================================
  describe('PUT /api/invites/:id/unlink', () => {
    let inviteId;
    let masterListId;

    beforeEach(async () => {
      // Create master list entry
      const mlResult = await pool.query(
        `INSERT INTO master_list (section, first_name, last_name, email, status)
         VALUES ('A', 'Linked', 'User', 'linked@test.com', 'Invited')
         RETURNING id`
      );
      masterListId = mlResult.rows[0].id;

      // Create linked invite
      const inviteResult = await pool.query(
        `INSERT INTO invites (email, first_name, last_name, used, master_list_id)
         VALUES ('linked@test.com', 'Linked', 'User', false, $1)
         RETURNING id`,
        [masterListId]
      );
      inviteId = inviteResult.rows[0].id;
    });

    it('should unlink invite from master list', async () => {
      const response = await request(app)
        .put(`/api/invites/${inviteId}/unlink`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify link was removed
      const inviteCheck = await pool.query(
        'SELECT master_list_id FROM invites WHERE id = $1',
        [inviteId]
      );
      expect(inviteCheck.rows[0].master_list_id).toBeNull();

      // Verify master list was cleaned up
      const mlCheck = await pool.query(
        'SELECT email, status, is_admin FROM master_list WHERE id = $1',
        [masterListId]
      );
      expect(mlCheck.rows[0].email).toBeNull();
      expect(mlCheck.rows[0].status).toBe('Not Invited');
      expect(mlCheck.rows[0].is_admin).toBe(false);
    });

    it('should return 404 for non-existent invite', async () => {
      const response = await request(app)
        .put('/api/invites/99999/unlink')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should clean up admin permissions when unlinking admin', async () => {
      // Mark the master list entry as admin
      await pool.query(
        'UPDATE master_list SET is_admin = true WHERE id = $1',
        [masterListId]
      );

      // Create admin entry
      const adminResult = await pool.query(
        `INSERT INTO admins (email, password_hash, first_name, is_super_admin)
         VALUES ('linked@test.com', 'hash', 'Linked', false)
         RETURNING id`
      );
      const adminId = adminResult.rows[0].id;

      // Add permissions
      await pool.query(
        `INSERT INTO permissions (admin_id, permission, enabled)
         VALUES ($1, 'invites_add', true)`,
        [adminId]
      );

      // Unlink
      const response = await request(app)
        .put(`/api/invites/${inviteId}/unlink`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);

      // Verify admin was removed (not super admin)
      const adminCheck = await pool.query(
        'SELECT * FROM admins WHERE email = $1',
        ['linked@test.com']
      );
      expect(adminCheck.rows.length).toBe(0);
    });
  });
});
