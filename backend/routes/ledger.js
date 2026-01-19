const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// =============================================================================
// IMPORTANT: Route order matters in Express! Specific routes MUST come before
// dynamic /:id routes, otherwise Express will match /balance as /:id with id="balance"
// =============================================================================

// Get all transactions with running balance
// NOTE: Only verified (status = 'OK') transactions count toward balances and totals.
// Pending transactions are displayed in tables but excluded from all calculations.
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    // Get transactions ordered by date ASC to calculate running balance
    const result = await db.query(
      `SELECT l.*,
              m.first_name as ml_first_name,
              m.last_name as ml_last_name,
              m.section as ml_section
       FROM ledger l
       LEFT JOIN master_list m ON l.master_list_id = m.id
       ORDER BY l.transaction_date ASC, l.created_at ASC`
    );

    // Calculate running balance - ONLY from verified transactions (status = 'OK')
    let balance = 0;
    const transactions = result.rows.map(row => {
      const deposit = parseFloat(row.deposit) || 0;
      const withdrawal = parseFloat(row.withdrawal) || 0;
      const isVerified = row.verified === 'OK';

      // Only verified transactions affect the running balance
      if (isVerified) {
        balance += deposit - withdrawal;
      }

      return {
        ...row,
        deposit: deposit || null,
        withdrawal: withdrawal || null,
        balance: balance // Running balance (only verified count)
      };
    });

    // Reverse for display (newest first) but keep balance calculated correctly
    const displayTransactions = [...transactions].reverse();

    // Calculate totals - ONLY from verified transactions
    const verifiedTransactions = transactions.filter(t => t.verified === 'OK');
    const totalDeposits = verifiedTransactions.reduce((sum, t) => sum + (parseFloat(t.deposit) || 0), 0);
    const totalWithdrawals = verifiedTransactions.reduce((sum, t) => sum + (parseFloat(t.withdrawal) || 0), 0);

    // Also calculate pending amounts for transparency
    const pendingTransactions = transactions.filter(t => t.verified !== 'OK');
    const pendingDeposits = pendingTransactions.reduce((sum, t) => sum + (parseFloat(t.deposit) || 0), 0);
    const pendingWithdrawals = pendingTransactions.reduce((sum, t) => sum + (parseFloat(t.withdrawal) || 0), 0);

    res.json({
      transactions: displayTransactions,
      balance: balance,
      totalDeposits: totalDeposits,
      totalWithdrawals: totalWithdrawals,
      pendingDeposits: pendingDeposits,
      pendingWithdrawals: pendingWithdrawals
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================================
// PUBLIC ROUTES - Must be defined BEFORE /:id routes
// =============================================================================

// Public route - get balance only (for public funds page)
// NOTE: Only verified (status = 'OK') transactions count toward balances and totals.
// Pending transactions are excluded until a financial controller marks them OK.
router.get('/balance', async (req, res) => {
  try {
    // Only sum verified transactions (status = 'OK')
    const depositResult = await db.query(
      `SELECT COALESCE(SUM(deposit), 0) as total FROM ledger WHERE verified = 'OK'`
    );
    const withdrawalResult = await db.query(
      `SELECT COALESCE(SUM(withdrawal), 0) as total FROM ledger WHERE verified = 'OK'`
    );

    const totalDeposits = parseFloat(depositResult.rows[0].total);
    const totalWithdrawals = parseFloat(withdrawalResult.rows[0].total);
    const balance = totalDeposits - totalWithdrawals;

    res.json({
      balance: balance,
      totalDeposits: totalDeposits,
      totalWithdrawals: totalWithdrawals,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public route - get unique donor names (for thank you credits)
// NOTE: Only verified (status = 'OK') donations are shown in donor credits.
router.get('/donors', async (req, res) => {
  try {
    // Only show donors with verified deposits (status = 'OK')
    const result = await db.query(
      `SELECT DISTINCT name FROM ledger
       WHERE deposit > 0 AND name IS NOT NULL AND name != '' AND verified = 'OK'
       ORDER BY name ASC`
    );

    res.json({
      donors: result.rows.map(r => r.name)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get master list entries for linking dropdown - Must be before /:id
router.get('/master-list-options', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, first_name, last_name, section
       FROM master_list
       WHERE in_memoriam IS NOT TRUE
       ORDER BY last_name, first_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================================
// ADMIN ROUTES - POST, PUT, DELETE operations
// =============================================================================

// Add a transaction
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      transaction_date,
      name,
      description,
      deposit,
      withdrawal,
      reference_no,
      verified,
      payment_type,
      master_list_id
    } = req.body;

    // Validate - must have either deposit or withdrawal
    if (!deposit && !withdrawal) {
      return res.status(400).json({ error: 'Either deposit or withdrawal amount is required' });
    }

    if (deposit && withdrawal) {
      return res.status(400).json({ error: 'Cannot have both deposit and withdrawal in same transaction' });
    }

    // Get recorder name
    let recorderName = null;
    const userResult = await db.query('SELECT first_name FROM users WHERE LOWER(email) = $1', [req.user.email.toLowerCase()]);
    if (userResult.rows.length > 0) {
      recorderName = userResult.rows[0].first_name;
    } else {
      const adminResult = await db.query('SELECT first_name FROM admins WHERE LOWER(email) = $1', [req.user.email.toLowerCase()]);
      if (adminResult.rows.length > 0) {
        recorderName = adminResult.rows[0].first_name;
      }
    }

    const result = await db.query(
      `INSERT INTO ledger (transaction_date, name, description, deposit, withdrawal, reference_no, verified, payment_type, master_list_id, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        transaction_date || new Date(),
        name || null,
        description || null,
        deposit ? parseFloat(deposit) : null,
        withdrawal ? parseFloat(withdrawal) : null,
        reference_no || null,
        verified || 'Pending',
        payment_type || null,
        master_list_id || null,
        recorderName
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================================
// DYNAMIC /:id ROUTES - Must be AFTER all specific routes
// =============================================================================

// Update a transaction
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      transaction_date,
      name,
      description,
      deposit,
      withdrawal,
      reference_no,
      verified,
      payment_type,
      master_list_id
    } = req.body;

    const result = await db.query(
      `UPDATE ledger SET
        transaction_date = COALESCE($1, transaction_date),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        deposit = $4,
        withdrawal = $5,
        reference_no = COALESCE($6, reference_no),
        verified = COALESCE($7, verified),
        payment_type = $8,
        master_list_id = $9
       WHERE id = $10
       RETURNING *`,
      [
        transaction_date,
        name,
        description,
        deposit ? parseFloat(deposit) : null,
        withdrawal ? parseFloat(withdrawal) : null,
        reference_no,
        verified,
        payment_type || null,
        master_list_id !== undefined ? master_list_id : null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload receipt for a transaction
router.post('/:id/receipt', authenticateAdmin, upload.single('receipt'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if transaction exists
    const existing = await db.query('SELECT receipt_url, receipt_public_id FROM ledger WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Delete old receipt if exists
    if (existing.rows[0].receipt_public_id) {
      try {
        await deleteFromCloudinary(existing.rows[0].receipt_public_id);
      } catch (e) {
        console.error('Failed to delete old receipt:', e);
      }
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'receipts');

    // Update database
    const result = await db.query(
      `UPDATE ledger SET
        receipt_url = $1,
        receipt_public_id = $2
       WHERE id = $3
       RETURNING *`,
      [uploadResult.secure_url, uploadResult.public_id, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// Delete receipt from a transaction
router.delete('/:id/receipt', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get current receipt info
    const existing = await db.query('SELECT receipt_public_id FROM ledger WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Delete from Cloudinary if exists
    if (existing.rows[0].receipt_public_id) {
      try {
        await deleteFromCloudinary(existing.rows[0].receipt_public_id);
      } catch (e) {
        console.error('Failed to delete from Cloudinary:', e);
      }
    }

    // Clear from database
    await db.query(
      `UPDATE ledger SET receipt_url = NULL, receipt_public_id = NULL WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Receipt deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

// Delete a transaction
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get receipt info to delete from Cloudinary
    const existing = await db.query('SELECT receipt_public_id FROM ledger WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Delete receipt from Cloudinary if exists
    if (existing.rows[0].receipt_public_id) {
      try {
        await deleteFromCloudinary(existing.rows[0].receipt_public_id);
      } catch (e) {
        console.error('Failed to delete receipt from Cloudinary:', e);
      }
    }

    const result = await db.query(
      'DELETE FROM ledger WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Link transaction to master list entry
router.put('/:id/link', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { master_list_id } = req.body;

    if (!master_list_id) {
      return res.status(400).json({ error: 'master_list_id is required' });
    }

    const result = await db.query(
      `UPDATE ledger SET master_list_id = $1 WHERE id = $2 RETURNING *`,
      [master_list_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unlink transaction from master list entry
router.put('/:id/unlink', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE ledger SET master_list_id = NULL WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
