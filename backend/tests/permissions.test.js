/**
 * Permission Tests
 *
 * Tests for /api/permissions endpoints and permission-based access:
 * - GET /permissions/me (get current user's permissions)
 * - GET /permissions/admins (super admin only - list all admins)
 * - PUT /permissions/admins/:id (super admin only - update permissions)
 * - requireSuperAdmin middleware
 * - Role-based access (viewer, editor, admin, super_admin)
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';

const { getTestPool, truncateTables, seedTestData } = require('./setup');
const {
  generateTestToken,
  createUserToken,
  createAdminToken,
  createSuperAdminToken
} = require('./helpers');

// Create test app with permission routes
const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/permissions', require('../routes/permissions'));
  return app;
};

describe('Permissions API', () => {
  let app;
  let pool;

  beforeAll(() => {
    app = createTestApp();
    pool = getTestPool();
  });

  beforeEach(async () => {
    await truncateTables();
    await seedTestData();
  });

  // ============================================================
  // GET /permissions/me - Current User Permissions
  // ============================================================
  describe('GET /api/permissions/me', () => {
    describe('Super Admin', () => {
      it('should return all permissions enabled for super admin', async () => {
        const token = createSuperAdminToken(1, 'admin@test.com');

        const response = await request(app)
          .get('/api/permissions/me')
          .set('Cookie', `token=${token}`);

        expect(response.status).toBe(200);
        expect(response.body.is_super_admin).toBe(true);

        // All permissions should be true for super admin
        const { permissions } = response.body;
        expect(permissions.invites_add).toBe(true);
        expect(permissions.invites_link).toBe(true);
        expect(permissions.announcements_send).toBe(true);
        expect(permissions.accounting_edit).toBe(true);
      });
    });

    describe('Regular Admin', () => {
      it('should return specific permissions for regular admin', async () => {
        // First, create an admin with specific permissions
        const adminResult = await pool.query(
          `SELECT id FROM admins WHERE email = 'regularadmin@test.com'`
        );
        const adminId = adminResult.rows[0].id;

        // Set up permissions
        await pool.query(`
          INSERT INTO permissions (admin_id, permission, enabled)
          VALUES
            ($1, 'invites_add', true),
            ($1, 'invites_link', false),
            ($1, 'announcements_view', true),
            ($1, 'accounting_edit', false)
        `, [adminId]);

        // Also update master_list to mark as admin
        await pool.query(`
          INSERT INTO master_list (section, last_name, first_name, email, is_admin)
          VALUES ('A', 'Admin', 'Regular', 'regularadmin@test.com', true)
          ON CONFLICT DO NOTHING
        `);

        const token = createAdminToken(adminId, 'regularadmin@test.com');

        const response = await request(app)
          .get('/api/permissions/me')
          .set('Cookie', `token=${token}`);

        expect(response.status).toBe(200);
        expect(response.body.is_super_admin).toBe(false);

        const { permissions } = response.body;
        expect(permissions.invites_add).toBe(true);
        expect(permissions.invites_link).toBe(false);
        expect(permissions.announcements_view).toBe(true);
        expect(permissions.accounting_edit).toBe(false);
      });
    });

    describe('Non-Admin User', () => {
      it('should return all permissions as false for non-admin', async () => {
        const token = createUserToken(1, 'testuser@test.com');

        const response = await request(app)
          .get('/api/permissions/me')
          .set('Cookie', `token=${token}`);

        expect(response.status).toBe(200);
        expect(response.body.is_super_admin).toBe(false);

        // All permissions should be false for non-admin
        const { permissions } = response.body;
        Object.values(permissions).forEach(value => {
          expect(value).toBe(false);
        });
      });
    });

    describe('Authentication Required', () => {
      it('should reject unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/permissions/me');

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Access token required');
      });
    });
  });

  // ============================================================
  // GET /permissions/admins - List All Admins (Super Admin Only)
  // ============================================================
  describe('GET /api/permissions/admins', () => {
    describe('Super Admin Access', () => {
      it('should list all admins with permissions for super admin', async () => {
        const token = createSuperAdminToken(1, 'admin@test.com');

        const response = await request(app)
          .get('/api/permissions/admins')
          .set('Cookie', `token=${token}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThanOrEqual(1);

        // Check admin structure
        const admin = response.body.find(a => a.email === 'admin@test.com');
        expect(admin).toBeDefined();
        expect(admin.permissions).toBeDefined();
        expect(typeof admin.permissions.invites_add).toBe('boolean');
      });
    });

    describe('Access Denied', () => {
      it('should deny access to regular admin', async () => {
        // Create regular admin entry
        const adminResult = await pool.query(
          `SELECT id FROM admins WHERE is_super_admin = false LIMIT 1`
        );

        if (adminResult.rows.length === 0) {
          // Create a non-super admin if none exists
          await pool.query(`
            INSERT INTO admins (email, password_hash, first_name, is_super_admin)
            VALUES ('regular@test.com', 'hash', 'Regular', false)
          `);
        }

        const token = createAdminToken(
          adminResult.rows[0]?.id || 2,
          'regularadmin@test.com'
        );

        const response = await request(app)
          .get('/api/permissions/admins')
          .set('Cookie', `token=${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Super Admin access required');
      });

      it('should deny access to non-admin users', async () => {
        const token = createUserToken(1, 'testuser@test.com');

        const response = await request(app)
          .get('/api/permissions/admins')
          .set('Cookie', `token=${token}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Admin access required');
      });

      it('should deny access to unauthenticated requests', async () => {
        const response = await request(app)
          .get('/api/permissions/admins');

        expect(response.status).toBe(401);
      });
    });
  });

  // ============================================================
  // PUT /permissions/admins/:id - Update Admin Permissions
  // ============================================================
  describe('PUT /api/permissions/admins/:id', () => {
    let superAdminToken;
    let targetAdminId;

    beforeEach(async () => {
      // Get super admin token
      superAdminToken = createSuperAdminToken(1, 'admin@test.com');

      // Get a regular admin to update
      const adminResult = await pool.query(
        `SELECT id FROM admins WHERE email = 'regularadmin@test.com'`
      );
      targetAdminId = adminResult.rows[0]?.id;

      if (!targetAdminId) {
        const newAdmin = await pool.query(`
          INSERT INTO admins (email, password_hash, first_name, is_super_admin)
          VALUES ('regularadmin@test.com', 'hash', 'Regular', false)
          RETURNING id
        `);
        targetAdminId = newAdmin.rows[0].id;
      }
    });

    describe('Successful Updates', () => {
      it('should update permissions for an admin', async () => {
        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send({
            permissions: {
              invites_add: true,
              invites_link: true,
              announcements_send: false,
              accounting_edit: true
            }
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Permissions updated');

        // Verify permissions were saved
        const permsResult = await pool.query(
          'SELECT permission, enabled FROM permissions WHERE admin_id = $1',
          [targetAdminId]
        );

        const permsMap = {};
        permsResult.rows.forEach(row => {
          permsMap[row.permission] = row.enabled;
        });

        expect(permsMap.invites_add).toBe(true);
        expect(permsMap.invites_link).toBe(true);
        expect(permsMap.announcements_send).toBe(false);
        expect(permsMap.accounting_edit).toBe(true);
      });

      it('should update is_super_admin status', async () => {
        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send({
            is_super_admin: true
          });

        expect(response.status).toBe(200);

        // Verify status was updated
        const adminResult = await pool.query(
          'SELECT is_super_admin FROM admins WHERE id = $1',
          [targetAdminId]
        );
        expect(adminResult.rows[0].is_super_admin).toBe(true);
      });

      it('should update role_title', async () => {
        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send({
            role_title: 'Treasurer'
          });

        expect(response.status).toBe(200);

        const adminResult = await pool.query(
          'SELECT role_title FROM admins WHERE id = $1',
          [targetAdminId]
        );
        expect(adminResult.rows[0].role_title).toBe('Treasurer');
      });

      it('should update sub_committees', async () => {
        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send({
            sub_committees: 'Finance, Fundraising'
          });

        expect(response.status).toBe(200);

        const adminResult = await pool.query(
          'SELECT sub_committees FROM admins WHERE id = $1',
          [targetAdminId]
        );
        expect(adminResult.rows[0].sub_committees).toBe('Finance, Fundraising');
      });

      it('should update is_core_leader', async () => {
        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send({
            is_core_leader: true
          });

        expect(response.status).toBe(200);

        const adminResult = await pool.query(
          'SELECT is_core_leader FROM admins WHERE id = $1',
          [targetAdminId]
        );
        expect(adminResult.rows[0].is_core_leader).toBe(true);
      });

      it('should update multiple fields at once', async () => {
        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send({
            role_title: 'Secretary',
            sub_committees: 'Communications',
            is_core_leader: true,
            permissions: {
              minutes_view: true,
              minutes_edit: true,
              messages_view: true
            }
          });

        expect(response.status).toBe(200);

        const adminResult = await pool.query(
          'SELECT role_title, sub_committees, is_core_leader FROM admins WHERE id = $1',
          [targetAdminId]
        );
        expect(adminResult.rows[0].role_title).toBe('Secretary');
        expect(adminResult.rows[0].sub_committees).toBe('Communications');
        expect(adminResult.rows[0].is_core_leader).toBe(true);
      });

      it('should use upsert for permissions (create if not exists)', async () => {
        // Clear existing permissions
        await pool.query('DELETE FROM permissions WHERE admin_id = $1', [targetAdminId]);

        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${superAdminToken}`)
          .send({
            permissions: {
              invites_add: true
            }
          });

        expect(response.status).toBe(200);

        // Verify all permissions were created (enabled or not)
        const permsResult = await pool.query(
          'SELECT COUNT(*) FROM permissions WHERE admin_id = $1',
          [targetAdminId]
        );
        expect(parseInt(permsResult.rows[0].count)).toBeGreaterThan(0);
      });
    });

    describe('Access Denied', () => {
      it('should deny access to regular admin', async () => {
        const regularToken = createAdminToken(targetAdminId, 'regularadmin@test.com');

        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${regularToken}`)
          .send({
            permissions: { invites_add: true }
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Super Admin access required');
      });

      it('should deny access to non-admin users', async () => {
        const userToken = createUserToken(1, 'testuser@test.com');

        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .set('Cookie', `token=${userToken}`)
          .send({
            permissions: { invites_add: true }
          });

        expect(response.status).toBe(403);
      });

      it('should deny access to unauthenticated requests', async () => {
        const response = await request(app)
          .put(`/api/permissions/admins/${targetAdminId}`)
          .send({
            permissions: { invites_add: true }
          });

        expect(response.status).toBe(401);
      });
    });
  });

  // ============================================================
  // Role-Based Access Control Tests
  // ============================================================
  describe('Role-Based Access Control', () => {
    // Create a test app with a route that checks specific permissions
    let rbacApp;

    beforeAll(() => {
      rbacApp = express();
      rbacApp.use(cookieParser());
      rbacApp.use(express.json());

      const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

      // Simulated permission check middleware
      const requirePermission = (permission) => async (req, res, next) => {
        const { Pool } = require('pg');
        const testPool = new Pool({
          connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/test_alumni_homecoming',
          ssl: false
        });

        try {
          // Check if super admin
          const superCheck = await testPool.query(
            'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
            [req.user.email.toLowerCase()]
          );

          if (superCheck.rows[0]?.is_super_admin) {
            await testPool.end();
            return next();
          }

          // Check specific permission
          const adminResult = await testPool.query(
            'SELECT id FROM admins WHERE LOWER(email) = $1',
            [req.user.email.toLowerCase()]
          );

          if (adminResult.rows.length === 0) {
            await testPool.end();
            return res.status(403).json({ error: 'Permission denied' });
          }

          const permResult = await testPool.query(
            'SELECT enabled FROM permissions WHERE admin_id = $1 AND permission = $2',
            [adminResult.rows[0].id, permission]
          );

          await testPool.end();

          if (!permResult.rows[0]?.enabled) {
            return res.status(403).json({ error: `Permission '${permission}' required` });
          }

          next();
        } catch (err) {
          res.status(500).json({ error: 'Server error' });
        }
      };

      // Test routes with different permission requirements
      rbacApp.get('/invites', authenticateAdmin, requirePermission('invites_add'), (req, res) => {
        res.json({ message: 'Invites access granted' });
      });

      rbacApp.get('/accounting', authenticateAdmin, requirePermission('accounting_edit'), (req, res) => {
        res.json({ message: 'Accounting access granted' });
      });

      rbacApp.get('/announcements', authenticateAdmin, requirePermission('announcements_send'), (req, res) => {
        res.json({ message: 'Announcements access granted' });
      });
    });

    it('should allow super admin to access any route', async () => {
      const superAdminToken = createSuperAdminToken(1, 'admin@test.com');

      const invitesResponse = await request(rbacApp)
        .get('/invites')
        .set('Cookie', `token=${superAdminToken}`);

      expect(invitesResponse.status).toBe(200);

      const accountingResponse = await request(rbacApp)
        .get('/accounting')
        .set('Cookie', `token=${superAdminToken}`);

      expect(accountingResponse.status).toBe(200);
    });

    it('should allow admin with specific permission', async () => {
      // Create admin with invites_add permission
      const adminResult = await pool.query(`
        INSERT INTO admins (email, password_hash, first_name, is_super_admin)
        VALUES ('permadmin@test.com', 'hash', 'Perm', false)
        RETURNING id
      `);
      const adminId = adminResult.rows[0].id;

      await pool.query(`
        INSERT INTO permissions (admin_id, permission, enabled)
        VALUES ($1, 'invites_add', true)
      `, [adminId]);

      const token = createAdminToken(adminId, 'permadmin@test.com');

      const response = await request(rbacApp)
        .get('/invites')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Invites access granted');
    });

    it('should deny admin without required permission', async () => {
      // Create admin with only invites_add permission
      const adminResult = await pool.query(`
        INSERT INTO admins (email, password_hash, first_name, is_super_admin)
        VALUES ('limitedadmin@test.com', 'hash', 'Limited', false)
        RETURNING id
      `);
      const adminId = adminResult.rows[0].id;

      await pool.query(`
        INSERT INTO permissions (admin_id, permission, enabled)
        VALUES ($1, 'invites_add', true)
      `, [adminId]);

      const token = createAdminToken(adminId, 'limitedadmin@test.com');

      // Should be denied accounting access
      const response = await request(rbacApp)
        .get('/accounting')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain("'accounting_edit' required");
    });

    it('should deny access when permission is explicitly disabled', async () => {
      const adminResult = await pool.query(`
        INSERT INTO admins (email, password_hash, first_name, is_super_admin)
        VALUES ('disabledperm@test.com', 'hash', 'Disabled', false)
        RETURNING id
      `);
      const adminId = adminResult.rows[0].id;

      // Explicitly set permission to false
      await pool.query(`
        INSERT INTO permissions (admin_id, permission, enabled)
        VALUES ($1, 'announcements_send', false)
      `, [adminId]);

      const token = createAdminToken(adminId, 'disabledperm@test.com');

      const response = await request(rbacApp)
        .get('/announcements')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // Permission Constants Tests
  // ============================================================
  describe('Permission Constants', () => {
    it('should have all expected permissions defined', async () => {
      const expectedPermissions = [
        'invites_add',
        'invites_link',
        'invites_upload',
        'invites_export',
        'registered_export',
        'masterlist_edit',
        'masterlist_upload',
        'masterlist_export',
        'announcements_view',
        'announcements_send',
        'accounting_view',
        'accounting_edit',
        'accounting_export',
        'minutes_view',
        'minutes_edit',
        'messages_view',
        'strategic_view'
      ];

      const token = createUserToken(1, 'testuser@test.com');

      const response = await request(app)
        .get('/api/permissions/me')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(200);

      const returnedPermissions = Object.keys(response.body.permissions);

      expectedPermissions.forEach(perm => {
        expect(returnedPermissions).toContain(perm);
      });
    });
  });
});
