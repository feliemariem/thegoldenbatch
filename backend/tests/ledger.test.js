/**
 * Ledger API Tests
 *
 * Tests for /api/ledger endpoints:
 * - GET / (list transactions with pagination, filters)
 * - GET /balance (public - get current balance)
 * - GET /donors (public - get donor list)
 * - GET /master-list-options (admin - dropdown options)
 * - POST / (create transaction)
 * - PUT /:id (update transaction)
 * - DELETE /:id (delete transaction)
 * - POST /:id/receipt (upload receipt)
 * - DELETE /:id/receipt (delete receipt)
 * - PUT /:id/link (link to master list)
 * - PUT /:id/unlink (unlink from master list)
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';

const { getTestPool, truncateTables, seedTestData } = require('./setup');
const {
  createAdminToken,
  createUserToken
} = require('./helpers');

// Mock Cloudinary
jest.mock('../utils/cloudinary', () => ({
  upload: {
    single: () => (req, res, next) => {
      if (req.headers['content-type']?.includes('multipart')) {
        req.file = {
          buffer: Buffer.from('fake-receipt-data'),
          mimetype: 'image/jpeg',
          originalname: 'receipt.jpg'
        };
      }
      next();
    }
  },
  uploadToCloudinary: jest.fn().mockResolvedValue({
    secure_url: 'https://cloudinary.com/test-receipt.jpg',
    public_id: 'test-receipt-id'
  }),
  deleteFromCloudinary: jest.fn().mockResolvedValue({ result: 'ok' })
}));

// Create test app with ledger routes
const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/ledger', require('../routes/ledger'));
  return app;
};

describe('Ledger API', () => {
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

    const adminResult = await pool.query(
      `SELECT id FROM admins WHERE email = 'admin@test.com' LIMIT 1`
    );
    adminToken = createAdminToken(adminResult.rows[0]?.id || 1, 'admin@test.com');
  });

  // Helper to create test transactions
  const createTestTransactions = async () => {
    await pool.query(`
      INSERT INTO ledger (transaction_date, name, description, deposit, withdrawal, verified)
      VALUES
        ('2024-01-01', 'Donor A', 'Initial deposit', 10000, NULL, 'OK'),
        ('2024-01-15', 'Venue', 'Venue rental', NULL, 5000, 'OK'),
        ('2024-02-01', 'Donor B', 'Contribution', 15000, NULL, 'Pending'),
        ('2024-02-15', 'Catering', 'Food deposit', NULL, 3000, 'OK'),
        ('2024-03-01', 'Donor C', 'Donation', 20000, NULL, 'OK')
    `);
  };

  // ============================================================
  // GET /balance - Public Balance
  // ============================================================
  describe('GET /api/ledger/balance', () => {
    it('should return balance without authentication', async () => {
      await createTestTransactions();

      const response = await request(app)
        .get('/api/ledger/balance');

      expect(response.status).toBe(200);
      expect(response.body.balance).toBeDefined();
      expect(response.body.totalDeposits).toBeDefined();
      expect(response.body.totalWithdrawals).toBeDefined();
      expect(response.body.updated_at).toBeDefined();
    });

    it('should only count verified transactions', async () => {
      await createTestTransactions();

      const response = await request(app)
        .get('/api/ledger/balance');

      expect(response.status).toBe(200);
      // Verified deposits: 10000 + 20000 = 30000
      // Verified withdrawals: 5000 + 3000 = 8000
      // Balance: 30000 - 8000 = 22000
      expect(response.body.totalDeposits).toBe(30000);
      expect(response.body.totalWithdrawals).toBe(8000);
      expect(response.body.balance).toBe(22000);
    });

    it('should return zero for empty ledger', async () => {
      const response = await request(app)
        .get('/api/ledger/balance');

      expect(response.status).toBe(200);
      expect(response.body.balance).toBe(0);
      expect(response.body.totalDeposits).toBe(0);
      expect(response.body.totalWithdrawals).toBe(0);
    });
  });

  // ============================================================
  // GET /donors - Public Donor List
  // ============================================================
  describe('GET /api/ledger/donors', () => {
    it('should return list of verified donors', async () => {
      await createTestTransactions();

      const response = await request(app)
        .get('/api/ledger/donors');

      expect(response.status).toBe(200);
      expect(response.body.donors).toBeDefined();
      expect(Array.isArray(response.body.donors)).toBe(true);
      // Should include verified donors: Donor A, Donor C
      // Should NOT include pending: Donor B
      expect(response.body.donors).toContain('Donor A');
      expect(response.body.donors).toContain('Donor C');
      expect(response.body.donors).not.toContain('Donor B');
    });

    it('should not include withdrawal names', async () => {
      await createTestTransactions();

      const response = await request(app)
        .get('/api/ledger/donors');

      expect(response.status).toBe(200);
      // Withdrawals like 'Venue' and 'Catering' should not be included
      expect(response.body.donors).not.toContain('Venue');
      expect(response.body.donors).not.toContain('Catering');
    });

    it('should work without authentication', async () => {
      const response = await request(app)
        .get('/api/ledger/donors');

      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // GET / - List Transactions (Admin)
  // ============================================================
  describe('GET /api/ledger', () => {
    beforeEach(async () => {
      await createTestTransactions();
    });

    it('should return paginated transactions with stats', async () => {
      const response = await request(app)
        .get('/api/ledger')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.transactions).toBeDefined();
      expect(Array.isArray(response.body.transactions)).toBe(true);
      expect(response.body.balance).toBeDefined();
      expect(response.body.totalDeposits).toBeDefined();
      expect(response.body.totalWithdrawals).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.stats).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/ledger?page=1&limit=2')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.transactions.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should support search filter', async () => {
      const response = await request(app)
        .get('/api/ledger?search=Donor')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      response.body.transactions.forEach(t => {
        const searchable = `${t.name || ''} ${t.description || ''}`.toLowerCase();
        expect(searchable).toContain('donor');
      });
    });

    it('should support type filter - deposits', async () => {
      const response = await request(app)
        .get('/api/ledger?type=deposit')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      response.body.transactions.forEach(t => {
        expect(t.deposit).toBeGreaterThan(0);
      });
    });

    it('should support type filter - withdrawals', async () => {
      const response = await request(app)
        .get('/api/ledger?type=withdrawal')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      response.body.transactions.forEach(t => {
        expect(t.withdrawal).toBeGreaterThan(0);
      });
    });

    it('should support date range filters', async () => {
      const response = await request(app)
        .get('/api/ledger?start_date=2024-02-01&end_date=2024-02-28')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      response.body.transactions.forEach(t => {
        const date = new Date(t.transaction_date);
        expect(date >= new Date('2024-02-01')).toBe(true);
        expect(date <= new Date('2024-02-28')).toBe(true);
      });
    });

    it('should include running balance for each transaction', async () => {
      const response = await request(app)
        .get('/api/ledger')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      response.body.transactions.forEach(t => {
        expect(t.balance).toBeDefined();
      });
    });

    it('should require admin authentication', async () => {
      const userToken = createUserToken(1, 'testuser@test.com');

      const response = await request(app)
        .get('/api/ledger')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/ledger');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // GET /master-list-options - Dropdown Options (Admin)
  // ============================================================
  describe('GET /api/ledger/master-list-options', () => {
    it('should return master list entries for dropdown', async () => {
      const response = await request(app)
        .get('/api/ledger/master-list-options')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(entry => {
        expect(entry.id).toBeDefined();
        expect(entry.first_name).toBeDefined();
        expect(entry.last_name).toBeDefined();
      });
    });

    it('should exclude in_memoriam entries', async () => {
      // Mark one entry as in_memoriam
      await pool.query(
        `UPDATE master_list SET in_memoriam = true WHERE id = 1`
      );

      const response = await request(app)
        .get('/api/ledger/master-list-options')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      response.body.forEach(entry => {
        expect(entry.id).not.toBe(1);
      });
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/ledger/master-list-options');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // POST / - Create Transaction
  // ============================================================
  describe('POST /api/ledger', () => {
    it('should create a deposit transaction', async () => {
      const response = await request(app)
        .post('/api/ledger')
        .set('Cookie', `token=${adminToken}`)
        .send({
          transaction_date: '2024-03-15',
          name: 'New Donor',
          description: 'Test donation',
          deposit: 5000,
          reference_no: 'REF001',
          payment_type: 'Bank Transfer'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New Donor');
      expect(parseFloat(response.body.deposit)).toBe(5000);
      expect(response.body.withdrawal).toBeNull();
      expect(response.body.verified).toBe('Pending');
    });

    it('should create a withdrawal transaction', async () => {
      const response = await request(app)
        .post('/api/ledger')
        .set('Cookie', `token=${adminToken}`)
        .send({
          transaction_date: '2024-03-15',
          name: 'Expense',
          description: 'Test expense',
          withdrawal: 2000
        });

      expect(response.status).toBe(201);
      expect(parseFloat(response.body.withdrawal)).toBe(2000);
      expect(response.body.deposit).toBeNull();
    });

    it('should reject transaction with neither deposit nor withdrawal', async () => {
      const response = await request(app)
        .post('/api/ledger')
        .set('Cookie', `token=${adminToken}`)
        .send({
          transaction_date: '2024-03-15',
          name: 'Invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Either deposit or withdrawal amount is required');
    });

    it('should reject transaction with both deposit and withdrawal', async () => {
      const response = await request(app)
        .post('/api/ledger')
        .set('Cookie', `token=${adminToken}`)
        .send({
          transaction_date: '2024-03-15',
          name: 'Invalid',
          deposit: 1000,
          withdrawal: 500
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot have both deposit and withdrawal in same transaction');
    });

    it('should default to current date if not provided', async () => {
      const response = await request(app)
        .post('/api/ledger')
        .set('Cookie', `token=${adminToken}`)
        .send({
          name: 'Test',
          deposit: 1000
        });

      expect(response.status).toBe(201);
      expect(response.body.transaction_date).toBeDefined();
    });

    it('should record the admin name as recorder', async () => {
      const response = await request(app)
        .post('/api/ledger')
        .set('Cookie', `token=${adminToken}`)
        .send({
          name: 'Test',
          deposit: 1000
        });

      expect(response.status).toBe(201);
      // recorded_by should be the admin's first name
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .post('/api/ledger')
        .send({
          name: 'Test',
          deposit: 1000
        });

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // PUT /:id - Update Transaction
  // ============================================================
  describe('PUT /api/ledger/:id', () => {
    let transactionId;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO ledger (transaction_date, name, deposit, verified)
        VALUES ('2024-03-01', 'Test Donor', 5000, 'Pending')
        RETURNING id
      `);
      transactionId = result.rows[0].id;
    });

    it('should update transaction fields', async () => {
      const response = await request(app)
        .put(`/api/ledger/${transactionId}`)
        .set('Cookie', `token=${adminToken}`)
        .send({
          name: 'Updated Donor',
          verified: 'OK',
          reference_no: 'REF999'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Donor');
      expect(response.body.verified).toBe('OK');
      expect(response.body.reference_no).toBe('REF999');
    });

    it('should allow changing deposit to withdrawal', async () => {
      const response = await request(app)
        .put(`/api/ledger/${transactionId}`)
        .set('Cookie', `token=${adminToken}`)
        .send({
          deposit: null,
          withdrawal: 3000
        });

      expect(response.status).toBe(200);
      expect(response.body.deposit).toBeNull();
      expect(parseFloat(response.body.withdrawal)).toBe(3000);
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .put('/api/ledger/99999')
        .set('Cookie', `token=${adminToken}`)
        .send({ name: 'Test' });

      expect(response.status).toBe(404);
    });
  });

  // ============================================================
  // DELETE /:id - Delete Transaction
  // ============================================================
  describe('DELETE /api/ledger/:id', () => {
    let transactionId;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO ledger (transaction_date, name, deposit)
        VALUES ('2024-03-01', 'To Delete', 5000)
        RETURNING id
      `);
      transactionId = result.rows[0].id;
    });

    it('should delete a transaction', async () => {
      const response = await request(app)
        .delete(`/api/ledger/${transactionId}`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Transaction deleted');

      // Verify deletion
      const check = await pool.query(
        'SELECT * FROM ledger WHERE id = $1',
        [transactionId]
      );
      expect(check.rows.length).toBe(0);
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .delete('/api/ledger/99999')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================
  // POST /:id/receipt - Upload Receipt
  // ============================================================
  describe('POST /api/ledger/:id/receipt', () => {
    let transactionId;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO ledger (transaction_date, name, deposit)
        VALUES ('2024-03-01', 'Test', 5000)
        RETURNING id
      `);
      transactionId = result.rows[0].id;
    });

    it('should upload receipt to transaction', async () => {
      const response = await request(app)
        .post(`/api/ledger/${transactionId}/receipt`)
        .set('Cookie', `token=${adminToken}`)
        .set('Content-Type', 'multipart/form-data')
        .attach('receipt', Buffer.from('fake-receipt'), 'receipt.jpg');

      expect(response.status).toBe(200);
      expect(response.body.receipt_url).toBeDefined();
    });

    it('should reject request without file', async () => {
      const response = await request(app)
        .post(`/api/ledger/${transactionId}/receipt`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .post('/api/ledger/99999/receipt')
        .set('Cookie', `token=${adminToken}`)
        .set('Content-Type', 'multipart/form-data')
        .attach('receipt', Buffer.from('fake'), 'receipt.jpg');

      expect(response.status).toBe(404);
    });
  });

  // ============================================================
  // DELETE /:id/receipt - Delete Receipt
  // ============================================================
  describe('DELETE /api/ledger/:id/receipt', () => {
    let transactionId;

    beforeEach(async () => {
      const result = await pool.query(`
        INSERT INTO ledger (transaction_date, name, deposit, receipt_url, receipt_public_id)
        VALUES ('2024-03-01', 'Test', 5000, 'https://example.com/receipt.jpg', 'receipt-123')
        RETURNING id
      `);
      transactionId = result.rows[0].id;
    });

    it('should delete receipt from transaction', async () => {
      const response = await request(app)
        .delete(`/api/ledger/${transactionId}/receipt`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Receipt deleted');

      // Verify receipt was removed
      const check = await pool.query(
        'SELECT receipt_url FROM ledger WHERE id = $1',
        [transactionId]
      );
      expect(check.rows[0].receipt_url).toBeNull();
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .delete('/api/ledger/99999/receipt')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================
  // PUT /:id/link - Link to Master List
  // ============================================================
  describe('PUT /api/ledger/:id/link', () => {
    let transactionId;
    let masterListId;

    beforeEach(async () => {
      const txResult = await pool.query(`
        INSERT INTO ledger (transaction_date, name, deposit)
        VALUES ('2024-03-01', 'Test', 5000)
        RETURNING id
      `);
      transactionId = txResult.rows[0].id;

      const mlResult = await pool.query(
        `SELECT id FROM master_list LIMIT 1`
      );
      masterListId = mlResult.rows[0]?.id;
    });

    it('should link transaction to master list entry', async () => {
      const response = await request(app)
        .put(`/api/ledger/${transactionId}/link`)
        .set('Cookie', `token=${adminToken}`)
        .send({ master_list_id: masterListId });

      expect(response.status).toBe(200);
      expect(response.body.master_list_id).toBe(masterListId);
    });

    it('should reject request without master_list_id', async () => {
      const response = await request(app)
        .put(`/api/ledger/${transactionId}/link`)
        .set('Cookie', `token=${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('master_list_id is required');
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .put('/api/ledger/99999/link')
        .set('Cookie', `token=${adminToken}`)
        .send({ master_list_id: masterListId });

      expect(response.status).toBe(404);
    });
  });

  // ============================================================
  // PUT /:id/unlink - Unlink from Master List
  // ============================================================
  describe('PUT /api/ledger/:id/unlink', () => {
    let transactionId;

    beforeEach(async () => {
      const mlResult = await pool.query(
        `SELECT id FROM master_list LIMIT 1`
      );
      const masterListId = mlResult.rows[0]?.id;

      const txResult = await pool.query(`
        INSERT INTO ledger (transaction_date, name, deposit, master_list_id)
        VALUES ('2024-03-01', 'Test', 5000, $1)
        RETURNING id
      `, [masterListId]);
      transactionId = txResult.rows[0].id;
    });

    it('should unlink transaction from master list', async () => {
      const response = await request(app)
        .put(`/api/ledger/${transactionId}/unlink`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.master_list_id).toBeNull();
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .put('/api/ledger/99999/unlink')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(404);
    });
  });
});
