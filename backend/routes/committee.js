const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

// Get all committee members (admins with role_title set)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    // Get admins with role_title set, joined with users for profile_photo
    const result = await db.query(`
      SELECT
        a.id,
        a.email,
        a.first_name,
        a.last_name,
        a.role_title,
        a.sub_committees,
        a.is_core_leader,
        m.current_name,
        u.profile_photo
      FROM admins a
      LEFT JOIN master_list m ON LOWER(a.email) = LOWER(m.email)
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE a.role_title IS NOT NULL AND a.role_title != ''
      ORDER BY a.is_core_leader DESC, a.role_title
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching committee members:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's volunteer interests
router.get('/interests', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT role FROM volunteer_interests WHERE user_id = $1',
      [req.user.id]
    );

    const interests = result.rows.map(r => r.role);
    res.json({ interests });
  } catch (err) {
    console.error('Error fetching volunteer interests:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Express interest in a volunteer role
router.post('/interests', authenticateToken, async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Check if already interested
    const existing = await db.query(
      'SELECT id FROM volunteer_interests WHERE user_id = $1 AND role = $2',
      [req.user.id, role]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already expressed interest in this role' });
    }

    // Insert new interest
    await db.query(
      'INSERT INTO volunteer_interests (user_id, role) VALUES ($1, $2)',
      [req.user.id, role]
    );

    res.status(201).json({ message: 'Interest saved successfully' });
  } catch (err) {
    console.error('Error saving volunteer interest:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all volunteer interests
router.get('/interests/all', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        vi.id,
        vi.role,
        vi.created_at,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        m.current_name
      FROM volunteer_interests vi
      JOIN users u ON vi.user_id = u.id
      LEFT JOIN master_list m ON LOWER(u.email) = LOWER(m.email)
      ORDER BY vi.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching all volunteer interests:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
