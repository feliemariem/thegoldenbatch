const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

// Get dashboard data - all users with RSVP status
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.birthday,
        u.mobile,
        u.address,
        u.city,
        u.country,
        u.occupation,
        u.company,
        u.created_at as registered_at,
        r.status as rsvp_status,
        r.updated_at as rsvp_updated_at
       FROM users u
       LEFT JOIN rsvps r ON u.id = r.user_id
       ORDER BY u.created_at DESC`
    );

    // Get summary stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_registered,
        COUNT(CASE WHEN r.status = 'going' THEN 1 END) as going,
        COUNT(CASE WHEN r.status = 'not_going' THEN 1 END) as not_going,
        COUNT(CASE WHEN r.status = 'maybe' THEN 1 END) as maybe,
        COUNT(CASE WHEN r.status IS NULL THEN 1 END) as no_response
      FROM users u
      LEFT JOIN rsvps r ON u.id = r.user_id
    `);

    const inviteStats = await db.query(`
      SELECT
        COUNT(*) as total_invited,
        COUNT(CASE WHEN used = true THEN 1 END) as used,
        COUNT(CASE WHEN used = false THEN 1 END) as pending
      FROM invites
    `);

    // Get count of admins who are also registered users (for admin-only announcements)
    const adminsCountResult = await db.query(`
      SELECT COUNT(*) as admin_count
      FROM users u
      INNER JOIN admins a ON LOWER(u.email) = LOWER(a.email)
    `);

    res.json({
      users: result.rows,
      stats: {
        ...statsResult.rows[0],
        invites: inviteStats.rows[0],
        admins_count: parseInt(adminsCountResult.rows[0].admin_count) || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
