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

    // Get count of full admins (have non-registry permissions) who are also registered users
    const fullAdminsCountResult = await db.query(`
      SELECT COUNT(DISTINCT u.id) as admin_count
      FROM users u
      INNER JOIN admins a ON LOWER(u.email) = LOWER(a.email)
      INNER JOIN permissions p ON p.admin_id = a.id
      WHERE p.enabled = true
        AND p.permission NOT LIKE 'invites_%'
        AND p.permission NOT LIKE 'registered_%'
        AND p.permission NOT LIKE 'masterlist_%'
    `);

    // Get count of registry admins (no non-registry permissions) who are also registered users
    const registryAdminsCountResult = await db.query(`
      SELECT COUNT(DISTINCT u.id) as admin_count
      FROM users u
      INNER JOIN admins a ON LOWER(u.email) = LOWER(a.email)
      WHERE NOT EXISTS (
        SELECT 1 FROM permissions p
        WHERE p.admin_id = a.id
          AND p.enabled = true
          AND p.permission NOT LIKE 'invites_%'
          AND p.permission NOT LIKE 'registered_%'
          AND p.permission NOT LIKE 'masterlist_%'
      )
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
        full_admins_count: parseInt(fullAdminsCountResult.rows[0].admin_count) || 0,
        registry_admins_count: parseInt(registryAdminsCountResult.rows[0].admin_count) || 0,
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
        u.shirt_size,
        u.jacket_size,
        u.has_alumni_card,
        u.created_at as registered_at,
        r.status as rsvp_status,
        r.updated_at as rsvp_updated_at,
        m.section
      FROM users u
      LEFT JOIN rsvps r ON u.id = r.user_id
      LEFT JOIN invites i ON u.invite_id = i.id
      LEFT JOIN master_list m ON i.master_list_id = m.id
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

    // Grad RSVP going count for progress tracker
    const gradGoingResult = await db.query(`
      SELECT
        COUNT(CASE WHEN m.section != 'Non-Graduate' AND r.status = 'going' THEN 1 END) as grads_going,
        COUNT(CASE WHEN m.section = 'Non-Graduate' AND r.status = 'going' THEN 1 END) as non_grads_going
      FROM users u
      LEFT JOIN rsvps r ON u.id = r.user_id
      LEFT JOIN invites i ON u.invite_id = i.id
      LEFT JOIN master_list m ON i.master_list_id = m.id
    `);

    // Parse stats from strings to integers (PostgreSQL COUNT returns strings)
    const rawStats = statsResult.rows[0];
    const stats = {
      total: parseInt(rawStats.total) || 0,
      going: parseInt(rawStats.going) || 0,
      not_going: parseInt(rawStats.not_going) || 0,
      maybe: parseInt(rawStats.maybe) || 0,
      no_response: parseInt(rawStats.no_response) || 0,
      grads_going: parseInt(gradGoingResult.rows[0].grads_going) || 0,
      non_grads_going: parseInt(gradGoingResult.rows[0].non_grads_going) || 0,
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

// Get user profile by ID (System Admin only - id=1)
router.get('/users/:id/profile', authenticateAdmin, async (req, res) => {
  try {
    // Restrict to system admin (id=1)
    if (req.user.id !== 1) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    const userResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.birthday,
              u.mobile, u.address, u.city, u.country, u.occupation, u.company,
              u.profile_photo, u.facebook_url, u.linkedin_url, u.instagram_url,
              u.shirt_size, u.jacket_size, u.has_alumni_card,
              u.created_at, u.last_login,
              r.status as rsvp_status,
              m.id as master_list_id,
              m.section,
              m.current_name,
              m.builder_tier,
              m.pledge_amount,
              m.builder_tier_set_at,
              m.recognition_public
       FROM users u
       LEFT JOIN rsvps r ON u.id = r.user_id
       LEFT JOIN invites i ON u.invite_id = i.id
       LEFT JOIN master_list m ON i.master_list_id = m.id
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if this user is also an admin
    let isAdmin = false;
    let isSuperAdmin = false;
    let hasNonRegistryPermissions = false;

    const adminCheck = await db.query(
      `SELECT id, is_super_admin FROM admins WHERE LOWER(email) = LOWER($1)`,
      [user.email]
    );

    if (adminCheck.rows.length > 0) {
      isAdmin = true;
      const adminData = adminCheck.rows[0];
      isSuperAdmin = adminData.is_super_admin || false;

      // Check for non-registry permissions
      const nonRegistryCheck = await db.query(
        `SELECT 1 FROM permissions WHERE admin_id = $1 AND enabled = true
         AND permission NOT LIKE 'invites_%'
         AND permission NOT LIKE 'registered_%'
         AND permission NOT LIKE 'masterlist_%'
         LIMIT 1`,
        [adminData.id]
      );
      hasNonRegistryPermissions = nonRegistryCheck.rows.length > 0;
    }

    res.json({
      ...user,
      is_graduate: user.section && user.section !== 'Non-Graduate',
      isAdmin,
      is_super_admin: isSuperAdmin,
      hasNonRegistryPermissions
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get batch-rep response stats by section (System Admin only - id=1)
router.get('/batch-rep/response-stats', authenticateAdmin, async (req, res) => {
  try {
    if (req.user.id !== 1) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get distinct respondents by section (1 person = 1 response regardless of positions)
    const respondedResult = await db.query(`
      SELECT m.section, COUNT(DISTINCT b.voter_id) as responded
      FROM batch_rep_submissions b
      JOIN users u ON u.id = b.voter_id
      JOIN invites i ON u.invite_id = i.id
      JOIN master_list m ON i.master_list_id = m.id
      WHERE m.section IN ('11-A', '11-B', '11-C', '11-D', '11-E')
      GROUP BY m.section
    `);

    // Get total grads per section
    const totalResult = await db.query(`
      SELECT section, COUNT(*) as total
      FROM master_list
      WHERE section IN ('11-A', '11-B', '11-C', '11-D', '11-E')
        AND in_memoriam = false
      GROUP BY section
    `);

    // Build section map
    const sections = ['11-A', '11-B', '11-C', '11-D', '11-E'];
    const respondedMap = {};
    const totalMap = {};

    respondedResult.rows.forEach(row => {
      respondedMap[row.section] = parseInt(row.responded) || 0;
    });

    totalResult.rows.forEach(row => {
      totalMap[row.section] = parseInt(row.total) || 0;
    });

    const sectionStats = sections.map(section => ({
      section,
      responded: respondedMap[section] || 0,
      total: totalMap[section] || 0
    }));

    // Calculate totals
    const totalResponded = sectionStats.reduce((sum, s) => sum + s.responded, 0);
    const totalGrads = sectionStats.reduce((sum, s) => sum + s.total, 0);

    res.json({
      sections: sectionStats,
      totalResponded,
      totalGrads
    });
  } catch (err) {
    console.error('Error fetching batch-rep response stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get engagement stats (System Admin only - id=1)
router.get('/engagement', authenticateAdmin, async (req, res) => {
  try {
    // Restrict to system admin (id=1)
    if (req.user.id !== 1) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(`
      SELECT
        COUNT(*) as total_registered,
        COUNT(CASE WHEN last_login >= NOW() - INTERVAL '30 days' THEN 1 END) as active_30d
      FROM users
    `);

    const totalRegistered = parseInt(result.rows[0].total_registered) || 0;
    const active30d = parseInt(result.rows[0].active_30d) || 0;
    const active30dPct = totalRegistered > 0
      ? Math.round((active30d / totalRegistered) * 1000) / 10
      : 0;

    res.json({
      total_registered: totalRegistered,
      active_30d: active30d,
      active_30d_pct: active30dPct
    });
  } catch (err) {
    console.error('Error fetching engagement stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
