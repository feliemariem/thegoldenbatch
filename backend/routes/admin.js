const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

// Get dashboard summary stats (without user list)
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
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

    // Parse stats from strings to integers (PostgreSQL COUNT returns strings)
    const raw = statsResult.rows[0];
    const stats = {
      total_registered: parseInt(raw.total_registered) || 0,
      going: parseInt(raw.going) || 0,
      not_going: parseInt(raw.not_going) || 0,
      maybe: parseInt(raw.maybe) || 0,
      no_response: parseInt(raw.no_response) || 0,
    };

    res.json({
      stats: {
        ...stats,
        invites: inviteStats.rows[0],
        admins_count: parseInt(adminsCountResult.rows[0].admin_count) || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get registered users with pagination
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 45, search, rsvp } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 45;
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE conditions
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Search filter (by name or email)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(u.first_name || ' ' || u.last_name) LIKE $${paramIndex}
        OR LOWER(u.email) LIKE $${paramIndex}
        OR LOWER(COALESCE(u.city, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(u.country, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(u.occupation, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(u.company, '')) LIKE $${paramIndex}
      )`);
      params.push(searchTerm);
      paramIndex++;
    }

    // RSVP status filter
    if (rsvp && rsvp !== 'all') {
      if (rsvp === 'no_response') {
        conditions.push(`r.status IS NULL`);
      } else {
        conditions.push(`r.status = $${paramIndex}`);
        params.push(rsvp);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    // Get paginated results
    const result = await db.query(`
      SELECT
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
      ${whereClause}
      ORDER BY u.last_name ASC NULLS LAST, u.first_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limitNum, offset]);

    // Get total count for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) FROM users u
      LEFT JOIN rsvps r ON u.id = r.user_id
      ${whereClause}
    `, params);
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN r.status = 'going' THEN 1 END) as going,
        COUNT(CASE WHEN r.status = 'not_going' THEN 1 END) as not_going,
        COUNT(CASE WHEN r.status = 'maybe' THEN 1 END) as maybe,
        COUNT(CASE WHEN r.status IS NULL THEN 1 END) as no_response
      FROM users u
      LEFT JOIN rsvps r ON u.id = r.user_id
    `);

    // Parse stats from strings to integers (PostgreSQL COUNT returns strings)
    const rawStats = statsResult.rows[0];
    const stats = {
      total: parseInt(rawStats.total) || 0,
      going: parseInt(rawStats.going) || 0,
      not_going: parseInt(rawStats.not_going) || 0,
      maybe: parseInt(rawStats.maybe) || 0,
      no_response: parseInt(rawStats.no_response) || 0,
    };

    res.json({
      users: result.rows,
      stats,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
