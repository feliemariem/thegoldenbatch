const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// POST /api/name-change-requests - Create a new name change request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { requested_first_name, requested_last_name } = req.body;
    const userId = req.user.id;

    if (!requested_first_name || !requested_last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    // Get current name from user
    const userResult = await db.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = userResult.rows[0];

    // Check if there's already a pending request
    const existingRequest = await db.query(
      'SELECT id FROM name_change_requests WHERE user_id = $1 AND status = $2',
      [userId, 'pending']
    );

    if (existingRequest.rows.length > 0) {
      // Update existing pending request
      await db.query(
        `UPDATE name_change_requests
         SET requested_first_name = $1, requested_last_name = $2,
             current_first_name = $3, current_last_name = $4, created_at = NOW()
         WHERE user_id = $5 AND status = 'pending'`,
        [requested_first_name, requested_last_name, currentUser.first_name, currentUser.last_name, userId]
      );
    } else {
      // Create new request
      await db.query(
        `INSERT INTO name_change_requests
         (user_id, requested_first_name, requested_last_name, current_first_name, current_last_name, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [userId, requested_first_name, requested_last_name, currentUser.first_name, currentUser.last_name]
      );
    }

    res.status(201).json({ message: 'Name change request submitted' });
  } catch (err) {
    console.error('Error creating name change request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/name-change-requests - Get all pending requests (super admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is super admin
    const adminResult = await db.query(
      'SELECT is_super_admin FROM admins WHERE email = $1',
      [req.user.email]
    );

    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_super_admin) {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    // Get all pending requests with user email
    const result = await db.query(
      `SELECT ncr.id, ncr.user_id, ncr.requested_first_name, ncr.requested_last_name,
              ncr.current_first_name, ncr.current_last_name, ncr.status, ncr.created_at,
              u.email
       FROM name_change_requests ncr
       JOIN users u ON u.id = ncr.user_id
       WHERE ncr.status = 'pending'
       ORDER BY ncr.created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching name change requests:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/name-change-requests/:id/approve - Approve a request (super admin only)
router.put('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is super admin
    const adminResult = await db.query(
      'SELECT is_super_admin FROM admins WHERE email = $1',
      [req.user.email]
    );

    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_super_admin) {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    // Get the request
    const requestResult = await db.query(
      'SELECT user_id, requested_first_name, requested_last_name FROM name_change_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const request = requestResult.rows[0];

    // Update the user's name
    await db.query(
      'UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3',
      [request.requested_first_name, request.requested_last_name, request.user_id]
    );

    // Update request status
    await db.query(
      'UPDATE name_change_requests SET status = $1 WHERE id = $2',
      ['approved', id]
    );

    res.json({ message: 'Name change approved' });
  } catch (err) {
    console.error('Error approving name change request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/name-change-requests/:id/reject - Reject a request (super admin only)
router.put('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is super admin
    const adminResult = await db.query(
      'SELECT is_super_admin FROM admins WHERE email = $1',
      [req.user.email]
    );

    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_super_admin) {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    // Check if request exists and is pending
    const requestResult = await db.query(
      'SELECT id FROM name_change_requests WHERE id = $1 AND status = $2',
      [id, 'pending']
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    // Update request status
    await db.query(
      'UPDATE name_change_requests SET status = $1 WHERE id = $2',
      ['rejected', id]
    );

    res.json({ message: 'Name change rejected' });
  } catch (err) {
    console.error('Error rejecting name change request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
