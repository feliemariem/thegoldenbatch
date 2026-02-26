const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const { upload, uploadToCloudinary } = require('../utils/cloudinary');

// =============================================================================
// USER ROUTES (authenticateToken)
// =============================================================================

// Upload a receipt
router.post('/', authenticateToken, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user's master_list_id
    const linkResult = await db.query(
      `SELECT i.master_list_id FROM users u JOIN invites i ON u.invite_id = i.id WHERE u.id = $1`,
      [req.user.id]
    );

    const masterListId = linkResult.rows.length > 0 ? linkResult.rows[0].master_list_id : null;

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'receipts');

    const { note } = req.body;

    // Insert receipt
    const result = await db.query(
      `INSERT INTO receipt_uploads (user_id, master_list_id, image_url, image_public_id, note, status, source)
       VALUES ($1, $2, $3, $4, $5, 'submitted', 'user')
       RETURNING *`,
      [req.user.id, masterListId, uploadResult.secure_url, uploadResult.public_id, note || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// Delete a receipt (only user's own, only if status is 'submitted')
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // First, verify the receipt belongs to this user and is still 'submitted'
    const receiptResult = await db.query(
      `SELECT r.*, i.master_list_id
       FROM receipt_uploads r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN invites i ON u.invite_id = i.id
       WHERE r.id = $1`,
      [id]
    );

    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const receipt = receiptResult.rows[0];

    // Check ownership (must be the user who uploaded it)
    if (receipt.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own receipts' });
    }

    // Check status (can only delete 'submitted' receipts)
    if (receipt.status !== 'submitted') {
      return res.status(400).json({ error: 'Cannot delete processed receipts' });
    }

    // Delete from Cloudinary if public_id exists
    if (receipt.image_public_id) {
      const cloudinary = require('cloudinary').v2;
      try {
        await cloudinary.uploader.destroy(receipt.image_public_id);
      } catch (cloudinaryErr) {
        console.error('Failed to delete from Cloudinary:', cloudinaryErr);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete from database
    await db.query('DELETE FROM receipt_uploads WHERE id = $1', [id]);

    res.json({ success: true, message: 'Receipt deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

// Get my receipt history
router.get('/my', authenticateToken, async (req, res) => {
  try {
    // Get user's master_list_id
    const linkResult = await db.query(
      `SELECT i.master_list_id FROM users u JOIN invites i ON u.invite_id = i.id WHERE u.id = $1`,
      [req.user.id]
    );

    const masterListId = linkResult.rows.length > 0 ? linkResult.rows[0].master_list_id : null;

    // Get receipts for this user or their master_list_id
    const result = await db.query(
      `SELECT r.*,
              l.deposit as ledger_amount,
              l.verified as ledger_status,
              l.transaction_date as ledger_date
       FROM receipt_uploads r
       LEFT JOIN ledger l ON r.ledger_id = l.id
       WHERE r.user_id = $1 OR r.master_list_id = $2
       ORDER BY r.created_at DESC`,
      [req.user.id, masterListId]
    );

    res.json({ receipts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================================
// ADMIN ROUTES (authenticateAdmin)
// =============================================================================

// Get receipts for controller inbox
router.get('/admin/inbox', authenticateAdmin, async (req, res) => {
  try {
    const { status = 'submitted' } = req.query;

    // Build WHERE clause based on status
    let whereClause = '';
    if (status === 'submitted') {
      whereClause = "WHERE r.status = 'submitted'";
    } else if (status === 'processed') {
      // 'processed' tab shows both pending_verification and verified receipts
      whereClause = "WHERE r.status IN ('pending_verification', 'verified')";
    }
    // If 'all', no WHERE clause

    const result = await db.query(
      `SELECT r.*,
              u.first_name,
              u.last_name,
              u.email,
              m.section,
              a.first_name as processor_first_name,
              a.last_name as processor_last_name
       FROM receipt_uploads r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN master_list m ON r.master_list_id = m.id
       LEFT JOIN admins a ON r.processed_by = a.id
       ${whereClause}
       ORDER BY CASE WHEN r.status = 'submitted' THEN 0 ELSE 1 END, r.created_at DESC`
    );

    res.json({ receipts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark receipt as processed (for duplicates)
router.put('/admin/:id/mark-processed', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_duplicate } = req.body;

    const result = await db.query(
      `UPDATE receipt_uploads
       SET status = 'pending_verification', is_duplicate = $1, processed_by = $2, processed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [is_duplicate || false, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Link receipt to ledger entry
router.put('/admin/:id/link-ledger', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { ledger_id } = req.body;

    if (!ledger_id) {
      return res.status(400).json({ error: 'ledger_id is required' });
    }

    const result = await db.query(
      `UPDATE receipt_uploads
       SET status = 'pending_verification', ledger_id = $1, processed_by = $2, processed_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [ledger_id, req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin uploads receipt on behalf of a user
router.post('/admin/on-behalf', authenticateAdmin, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { master_list_id, note, ledger_id } = req.body;

    if (!master_list_id) {
      return res.status(400).json({ error: 'master_list_id is required' });
    }

    // Try to find user_id from master_list_id
    const userResult = await db.query(
      `SELECT u.id FROM users u JOIN invites i ON u.invite_id = i.id WHERE i.master_list_id = $1`,
      [master_list_id]
    );

    const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'receipts');

    // Insert receipt
    const result = await db.query(
      `INSERT INTO receipt_uploads (user_id, master_list_id, image_url, image_public_id, note, status, source, ledger_id, processed_by, processed_at)
       VALUES ($1, $2, $3, $4, $5, 'pending_verification', 'admin', $6, $7, NOW())
       RETURNING *`,
      [userId, master_list_id, uploadResult.secure_url, uploadResult.public_id, note || null, ledger_id || null, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

module.exports = router;
