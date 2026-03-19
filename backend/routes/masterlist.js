const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin, authenticateToken } = require('../middleware/auth');

// Helper function for text normalization
const toTitleCase = (str) => {
  if (!str) return str;
  return str.trim().replace(/\b\w/g, (char) => char.toUpperCase());
};

const toLowerEmail = (email) => {
  if (!email) return email;
  return email.trim().toLowerCase();
};

// Get all master list entries with status (supports pagination and filtering)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      section,
      page = 1,
      limit = 45,
      status: statusFilter,
      paymentStatus: paymentStatusFilter,
      tier: tierFilter,
      search
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 45;
    const offset = (pageNum - 1) * limitNum;

    // Base query with computed columns
    const baseSelect = `
      SELECT
        m.id,
        m.section,
        m.last_name,
        m.first_name,
        m.current_name,
        m.email,
        m.in_memoriam,
        m.is_unreachable,
        m.is_admin,
        m.builder_tier,
        m.pledge_amount,
        m.recognition_public,
        m.created_at,
        CASE
          WHEN m.in_memoriam = true THEN 'In Memoriam'
          WHEN m.is_unreachable = true THEN 'Unreachable'
          ELSE COALESCE(m.status, 'Not Invited')
        END as status,
        CASE
          WHEN m.section = 'Non-Graduate' OR m.in_memoriam = true THEN NULL
          ELSE COALESCE(ledger_totals.total_paid, 0)
        END as total_paid,
        CASE
          WHEN m.section = 'Non-Graduate' OR m.in_memoriam = true THEN NULL
          WHEN m.builder_tier = 'root' THEN NULL
          WHEN m.builder_tier IS NOT NULL THEN m.pledge_amount - COALESCE(ledger_totals.total_paid, 0)
          ELSE NULL
        END as balance,
        CASE
          WHEN m.section = 'Non-Graduate' OR m.in_memoriam = true THEN NULL
          WHEN m.builder_tier = 'root' THEN 'Root'
          WHEN m.builder_tier IS NOT NULL AND COALESCE(ledger_totals.total_paid, 0) >= m.pledge_amount THEN 'Full'
          WHEN m.builder_tier IS NOT NULL AND COALESCE(ledger_totals.total_paid, 0) > 0 THEN 'Partial'
          WHEN m.builder_tier IS NOT NULL THEN 'Unpaid'
          ELSE NULL
        END as payment_status,
        EXISTS(SELECT 1 FROM invites WHERE invites.master_list_id = m.id) as linked_to_invite
      FROM master_list m
      LEFT JOIN (
        SELECT master_list_id, SUM(deposit) as total_paid
        FROM ledger
        WHERE master_list_id IS NOT NULL AND deposit > 0 AND verified = 'OK'
        GROUP BY master_list_id
      ) ledger_totals ON m.id = ledger_totals.master_list_id
    `;

    // Build WHERE conditions
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Section filter
    if (section && section !== 'all') {
      if (section === 'graduates') {
        conditions.push(`m.section != 'Non-Graduate'`);
      } else {
        conditions.push(`m.section = $${paramIndex}`);
        params.push(section);
        paramIndex++;
      }
    }

    // Status filter (server-side)
    if (statusFilter && statusFilter !== 'all') {
      const statusLower = statusFilter.toLowerCase();
      if (statusLower === 'in memoriam') {
        conditions.push(`m.in_memoriam = true`);
      } else if (statusLower === 'unreachable') {
        conditions.push(`m.is_unreachable = true AND (m.in_memoriam IS NULL OR m.in_memoriam = false)`);
      } else if (statusLower === 'registered') {
        conditions.push(`m.status = 'Registered' AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false)`);
      } else if (statusLower === 'pending') {
        conditions.push(`m.status = 'Pending' AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false)`);
      } else if (statusLower === 'not invited') {
        conditions.push(`(m.status = 'Not Invited' OR m.status IS NULL) AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false)`);
      }
    }

    // Tier filter
    if (tierFilter && tierFilter !== 'all') {
      if (tierFilter === 'none') {
        conditions.push(`m.builder_tier IS NULL`);
      } else {
        conditions.push(`m.builder_tier = $${paramIndex}`);
        params.push(tierFilter);
        paramIndex++;
      }
    }

    // Search filter (by name)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(m.last_name || ' ' || m.first_name) LIKE $${paramIndex} OR LOWER(COALESCE(m.current_name, '')) LIKE $${paramIndex})`);
      params.push(searchTerm);
      paramIndex++;
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    // For payment filter, we need to wrap in a subquery since it's a computed column
    let query;
    let countQuery;
    let queryParams;
    let countParams;

    if (paymentStatusFilter && paymentStatusFilter !== 'all') {
      // Use subquery to filter by computed payment_status
      // Capitalize first letter for payment status match
      const paymentValue = paymentStatusFilter.charAt(0).toUpperCase() + paymentStatusFilter.slice(1).toLowerCase();

      query = `
        SELECT * FROM (${baseSelect}${whereClause}) as subq
        WHERE payment_status = $${paramIndex}
        ORDER BY last_name, first_name
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `;
      countQuery = `
        SELECT COUNT(*) FROM (${baseSelect}${whereClause}) as subq
        WHERE payment_status = $${paramIndex}
      `;

      queryParams = [...params, paymentValue, limitNum, offset];
      countParams = [...params, paymentValue];
    } else {
      query = `${baseSelect}${whereClause} ORDER BY m.last_name, m.first_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      // For count query without payment filter, we can use a simpler query
      countQuery = `SELECT COUNT(*) FROM (${baseSelect}${whereClause}) as subq`;

      queryParams = [...params, limitNum, offset];
      countParams = [...params];
    }

    // Execute paginated query
    const result = await db.query(query, queryParams);

    // Get total count for pagination
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Run all stat queries in parallel
    const [statsResult, paymentStatsResult, tierStatsResult, tierDetailResult, sectionStatsResult, sectionsResult] = await Promise.all([
      // Get stats (using stored status column)
      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN m.status = 'Registered' AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false) THEN 1 END) as registered,
          COUNT(CASE WHEN m.status = 'Registered' AND m.section != 'Non-Graduate' AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false) THEN 1 END) as registered_graduates,
          COUNT(CASE WHEN m.status = 'Registered' AND m.section = 'Non-Graduate' AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false) THEN 1 END) as registered_non_graduates,
          COUNT(CASE WHEN m.status = 'Pending' AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false) THEN 1 END) as pending,
          COUNT(CASE WHEN m.status = 'Not Invited' AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false) THEN 1 END) as not_invited,
          COUNT(CASE WHEN m.in_memoriam = true THEN 1 END) as in_memoriam,
          COUNT(CASE WHEN m.is_unreachable = true THEN 1 END) as unreachable
        FROM master_list m
      `),
      // Get payment stats (graduates with builder tier, excluding in memoriam)
      // Only verified (OK) deposits count toward pledge calculations
      db.query(`
        SELECT
          COUNT(CASE WHEN m.builder_tier IS NOT NULL THEN 1 END) as total_builders,
          COUNT(CASE WHEN m.builder_tier IS NOT NULL AND m.builder_tier != 'root' AND COALESCE(ledger_totals.total_paid, 0) >= m.pledge_amount THEN 1 END) as full_paid,
          COUNT(CASE WHEN m.builder_tier IS NOT NULL AND m.builder_tier != 'root' AND COALESCE(ledger_totals.total_paid, 0) > 0 AND COALESCE(ledger_totals.total_paid, 0) < m.pledge_amount THEN 1 END) as partial_paid,
          COUNT(CASE WHEN m.builder_tier IS NOT NULL AND m.builder_tier != 'root' AND COALESCE(ledger_totals.total_paid, 0) = 0 THEN 1 END) as unpaid,
          COUNT(CASE WHEN m.builder_tier = 'root' THEN 1 END) as root_count
        FROM master_list m
        LEFT JOIN (
          SELECT master_list_id, SUM(deposit) as total_paid
          FROM ledger
          WHERE master_list_id IS NOT NULL AND deposit > 0 AND verified = 'OK'
          GROUP BY master_list_id
        ) ledger_totals ON m.id = ledger_totals.master_list_id
        WHERE m.section != 'Non-Graduate' AND (m.in_memoriam IS NULL OR m.in_memoriam = false)
      `),
      // Get tier breakdown stats
      // Only verified (OK) deposits count toward collected totals
      db.query(`
        SELECT
          COUNT(CASE WHEN m.builder_tier = 'cornerstone' THEN 1 END) as cornerstone_count,
          COUNT(CASE WHEN m.builder_tier = 'pillar' THEN 1 END) as pillar_count,
          COUNT(CASE WHEN m.builder_tier = 'anchor' THEN 1 END) as anchor_count,
          COUNT(CASE WHEN m.builder_tier = 'root' THEN 1 END) as root_count,
          COUNT(CASE WHEN m.builder_tier IS NOT NULL THEN 1 END) as total_builders,
          COUNT(CASE WHEN m.builder_tier IS NULL AND m.section != 'Non-Graduate' AND (m.in_memoriam IS NULL OR m.in_memoriam = false) THEN 1 END) as no_tier,
          COALESCE(SUM(CASE WHEN m.builder_tier IS NOT NULL AND m.builder_tier != 'root' THEN m.pledge_amount ELSE 0 END), 0) as total_pledged,
          COALESCE(SUM(CASE WHEN m.builder_tier IS NOT NULL THEN ledger_totals.total_paid ELSE 0 END), 0) as total_collected
        FROM master_list m
        LEFT JOIN (
          SELECT master_list_id, SUM(deposit) as total_paid
          FROM ledger
          WHERE master_list_id IS NOT NULL AND deposit > 0 AND verified = 'OK'
          GROUP BY master_list_id
        ) ledger_totals ON m.id = ledger_totals.master_list_id
        WHERE m.section != 'Non-Graduate' AND (m.in_memoriam IS NULL OR m.in_memoriam = false)
      `),
      // Get per-tier detail stats (for Funding Reality Engine)
      db.query(`
        SELECT
          m.builder_tier,
          COUNT(*) as count,
          COALESCE(AVG(CASE WHEN m.builder_tier != 'root' THEN m.pledge_amount END), 0) as avg_pledge,
          COALESCE(SUM(CASE WHEN m.builder_tier != 'root' THEN m.pledge_amount ELSE 0 END), 0) as total_tier_pledged,
          COALESCE(SUM(ledger_totals.total_paid), 0) as total_tier_collected
        FROM master_list m
        LEFT JOIN (
          SELECT master_list_id, SUM(deposit) as total_paid
          FROM ledger
          WHERE master_list_id IS NOT NULL AND deposit > 0 AND verified = 'OK'
          GROUP BY master_list_id
        ) ledger_totals ON m.id = ledger_totals.master_list_id
        WHERE m.builder_tier IS NOT NULL
          AND m.section != 'Non-Graduate'
          AND (m.in_memoriam IS NULL OR m.in_memoriam = false)
        GROUP BY m.builder_tier
      `),
      // Get per-section registration stats (for section stat cards)
      // Excludes in_memoriam members from both total and registered counts
      db.query(`
        SELECT
          m.section,
          COUNT(*) as total,
          COUNT(CASE WHEN m.status = 'Registered' AND (m.is_unreachable IS NULL OR m.is_unreachable = false) THEN 1 END) as registered
        FROM master_list m
        WHERE m.section IN ('11A', '11B', '11C', '11D', '11E')
          AND (m.in_memoriam IS NULL OR m.in_memoriam = false)
        GROUP BY m.section
        ORDER BY m.section
      `),
      // Get sections for dropdown
      db.query(`
        SELECT DISTINCT section FROM master_list ORDER BY section
      `)
    ]);

    const tierDetails = {};
    tierDetailResult.rows.forEach(row => {
      tierDetails[row.builder_tier] = {
        count: parseInt(row.count),
        avg_pledge: parseFloat(row.avg_pledge),
        total_pledged: parseFloat(row.total_tier_pledged),
        total_collected: parseFloat(row.total_tier_collected)
      };
    });

    const sectionStats = sectionStatsResult.rows.map(row => ({
      section: row.section,
      total: parseInt(row.total),
      registered: parseInt(row.registered),
      percentage: row.total > 0 ? Math.round((parseInt(row.registered) / parseInt(row.total)) * 100) : 0
    }));

    res.json({
      entries: result.rows,
      stats: {
        ...statsResult.rows[0],
        ...paymentStatsResult.rows[0],
        ...tierStatsResult.rows[0],
        tier_details: tierDetails,
        section_stats: sectionStats
      },
      sections: sectionsResult.rows.map(r => r.section),
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

// Bulk upload master list (CSV data)
router.post('/bulk', authenticateAdmin, async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array is required' });
    }

    const results = {
      success: 0,
      errors: []
    };

    for (const entry of entries) {
      try {
        await db.query(
          `INSERT INTO master_list (section, last_name, first_name, email, in_memoriam)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            entry.section || 'Unknown',
            toTitleCase(entry.last_name),
            toTitleCase(entry.first_name),
            toLowerEmail(entry.email) || null,
            entry.in_memoriam === 'true' || entry.in_memoriam === true
          ]
        );
        results.success++;
      } catch (err) {
        results.errors.push({ name: `${entry.last_name}, ${entry.first_name}`, error: err.message });
      }
    }

    res.status(201).json({
      message: `Added ${results.success} entries`,
      ...results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a master list entry
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { last_name, first_name, current_name, email, section, in_memoriam, is_unreachable, is_admin, builder_tier, pledge_amount, recognition_public } = req.body;

    // Check if requester is super admin and get their admin id
    const superAdminCheck = await db.query(
      'SELECT id, is_super_admin FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );
    const isSuperAdmin = superAdminCheck.rows[0]?.is_super_admin === true;
    const isSystemAdmin = isSuperAdmin && superAdminCheck.rows[0]?.id === 1;

    // Only super admins can change is_admin, in_memoriam, or builder_tier/pledge_amount
    const wantsToChangeProtectedFields =
      typeof req.body.is_admin === 'boolean' || typeof req.body.in_memoriam === 'boolean' ||
      req.body.builder_tier !== undefined || req.body.pledge_amount !== undefined;

    if (wantsToChangeProtectedFields && !isSuperAdmin) {
      return res.status(403).json({ error: 'Super Admin access required' });
    }

    // Validate builder_tier and pledge_amount if provided
    let validatedTier = undefined;
    let validatedPledge = undefined;
    if (isSuperAdmin && builder_tier !== undefined) {
      const validTiers = ['cornerstone', 'pillar', 'anchor', 'root', null];
      if (!validTiers.includes(builder_tier)) {
        return res.status(400).json({ error: 'Invalid tier' });
      }
      validatedTier = builder_tier;

      // Validate pledge_amount - only check range if amount is actually provided
      if (builder_tier === 'root') {
        // Root accepts any amount including null
        if (pledge_amount !== undefined && pledge_amount !== null && pledge_amount !== '') {
          const pledgeNum = parseFloat(pledge_amount);
          if (isNaN(pledgeNum) || pledgeNum < 0) {
            return res.status(400).json({ error: 'Invalid pledge amount' });
          }
          validatedPledge = pledgeNum;
        } else {
          validatedPledge = null;
        }
      } else if (builder_tier === null) {
        validatedPledge = null;
      } else if (pledge_amount !== undefined && pledge_amount !== null && pledge_amount !== '') {
        const pledgeNum = parseFloat(pledge_amount);
        if (isNaN(pledgeNum) || pledgeNum < 0) {
          return res.status(400).json({ error: 'Invalid pledge amount' });
        }
        // Check range based on tier
        const tierRanges = {
          cornerstone: { min: 25000, max: null },
          pillar: { min: 18000, max: 24000 },
          anchor: { min: 10000, max: 17000 }
        };
        const range = tierRanges[builder_tier];
        if (range) {
          if (pledgeNum < range.min) {
            return res.status(400).json({ error: `${builder_tier.charAt(0).toUpperCase() + builder_tier.slice(1)} tier requires minimum ₱${range.min.toLocaleString()}` });
          }
          if (range.max && pledgeNum > range.max) {
            return res.status(400).json({ error: `${builder_tier.charAt(0).toUpperCase() + builder_tier.slice(1)} tier maximum is ₱${range.max.toLocaleString()}` });
          }
        }
        validatedPledge = pledgeNum;
      } else {
        // Pledge amount is null/empty - this is allowed (tier without pledge)
        validatedPledge = null;
      }
    }

    // Only System Admin (admin id=1) can change name fields - strip them for everyone else
    let allowedLastName = last_name;
    let allowedFirstName = first_name;
    let allowedCurrentName = current_name;
    if (!isSystemAdmin) {
      allowedLastName = null;
      allowedFirstName = null;
      allowedCurrentName = null;
    }


    // Get the current entry to check if is_admin is changing
    const currentEntry = await db.query('SELECT * FROM master_list WHERE id = $1', [id]);
    if (currentEntry.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const entry = currentEntry.rows[0];
    const wasAdmin = entry.is_admin;
    const willBeAdmin = is_admin;
    const entryEmail = toLowerEmail(email) || entry.email;
    const entryFirstName = toTitleCase(first_name) || entry.first_name;
    const entryLastName = toTitleCase(last_name) || entry.last_name;
    const entryCurrentName = toTitleCase(current_name) || entry.current_name;

    // If becoming admin and has email, validate and create admin entry
    if (willBeAdmin && !wasAdmin) {
      // Validate: user must have an email and be registered
      if (!entryEmail) {
        return res.status(400).json({ error: 'Cannot assign admin role: user has no email address' });
      }

      // Check if user has completed registration (exists in users table)
      const registeredUser = await db.query(
        'SELECT id FROM users WHERE LOWER(email) = $1',
        [entryEmail]
      );

      if (registeredUser.rows.length === 0) {
        return res.status(400).json({ error: 'Cannot assign admin role: user has not completed registration' });
      }

      // Check if admin already exists with this email
      const existingAdmin = await db.query('SELECT id FROM admins WHERE LOWER(email) = $1', [entryEmail]);

      if (existingAdmin.rows.length === 0) {
        // Create admin entry (no password - they'll use forgot password to set one)
        // Use current_name if available, otherwise fall back to first_name/last_name
        const adminFirstName = entryCurrentName || entryFirstName;
        const adminLastName = entryCurrentName ? '' : entryLastName;
        await db.query(
          `INSERT INTO admins (email, first_name, last_name, password_hash, is_super_admin)
           VALUES ($1, $2, $3, $4, $5)`,
          [entryEmail, adminFirstName, adminLastName, '', false]
        );
      }
    }

    // If removing admin status, fully remove from admins + permissions
    if (!willBeAdmin && wasAdmin && entry.email) {
      const adminEmail = entry.email.toLowerCase();

      // Delete permissions first
      await db.query(
        `DELETE FROM permissions
         WHERE admin_id IN (
           SELECT id FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false
         )`,
        [adminEmail]
      );

      // Then delete admin row
      await db.query(
        `DELETE FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false`,
        [adminEmail]
      );
    }

    // Build dynamic update for tier/pledge (need special handling for null values)
    let updateFields = `
        last_name = COALESCE($1, last_name),
        first_name = COALESCE($2, first_name),
        current_name = COALESCE($3, current_name),
        email = COALESCE($4, email),
        section = COALESCE($5, section),
        in_memoriam = COALESCE($6, in_memoriam),
        is_unreachable = COALESCE($7, is_unreachable),
        is_admin = COALESCE($8, is_admin),
        updated_at = CURRENT_TIMESTAMP`;

    let queryParams = [
      toTitleCase(allowedLastName),
      toTitleCase(allowedFirstName),
      toTitleCase(allowedCurrentName),
      toLowerEmail(email),
      section,
      in_memoriam,
      is_unreachable,
      is_admin
    ];
    let paramIndex = 9;

    // Add tier update if provided by super admin
    if (isSuperAdmin && validatedTier !== undefined) {
      updateFields += `, builder_tier = $${paramIndex}`;
      queryParams.push(validatedTier);
      paramIndex++;

      updateFields += `, pledge_amount = $${paramIndex}`;
      queryParams.push(validatedPledge);
      paramIndex++;

      // Set builder_tier_set_at when tier changes
      if (validatedTier !== null) {
        updateFields += `, builder_tier_set_at = NOW()`;
      } else {
        updateFields += `, builder_tier_set_at = NULL`;
      }
    }

    // Add recognition_public update if provided (any admin can toggle this)
    if (recognition_public !== undefined) {
      updateFields += `, recognition_public = $${paramIndex}`;
      queryParams.push(recognition_public);
      paramIndex++;
    }

    queryParams.push(id);

    const result = await db.query(
      `UPDATE master_list SET ${updateFields} WHERE id = $${paramIndex} RETURNING *`,
      queryParams
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a master list entry
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the entry first to check if admin
    const entry = await db.query('SELECT email, is_admin FROM master_list WHERE id = $1', [id]);

    if (entry.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // If was admin, remove from permissions and admins tables (but not super admins)
    if (entry.rows[0].is_admin && entry.rows[0].email) {
      const adminEmail = entry.rows[0].email.toLowerCase();

      // Delete permissions first
      await db.query(
        `DELETE FROM permissions
         WHERE admin_id IN (
           SELECT id FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false
         )`,
        [adminEmail]
      );

      // Then delete admin row
      await db.query('DELETE FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false', [adminEmail]);
    }

    const result = await db.query(
      'DELETE FROM master_list WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({ message: 'Entry deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear all master list entries
router.delete('/', authenticateAdmin, async (req, res) => {
  try {
    // Delete permissions for non-super admins first
    await db.query(
      `DELETE FROM permissions
       WHERE admin_id IN (
         SELECT id FROM admins WHERE is_super_admin = false
       )`
    );
    // Remove all non-super admins
    await db.query('DELETE FROM admins WHERE is_super_admin = false');
    // Then clear master list
    await db.query('DELETE FROM master_list');
    res.json({ message: 'Master list cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public directory for logged-in users
router.get('/directory', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        m.id,
        m.section,
        m.last_name,
        m.first_name,
        m.current_name,
        m.in_memoriam,
        m.status,
        u.birthday,
        u.mobile,
        u.address,
        u.city,
        u.country,
        u.profile_photo,
        u.occupation,
        u.company,
        u.facebook_url,
        u.linkedin_url,
        u.instagram_url,
        u.visibility,
        r.status as rsvp_status
      FROM master_list m
      LEFT JOIN invites i ON i.master_list_id = m.id
      LEFT JOIN users u ON u.invite_id = i.id
      LEFT JOIN rsvps r ON r.user_id = u.id
      ORDER BY m.last_name, m.first_name
    `);

    // Apply visibility filtering - name, section, city, country always shown
    const defaultVisibility = { birthday: false, mobile: false, address: false, occupation: false, company: false, social: false };
    const entries = result.rows.map(row => {
      const vis = row.visibility || defaultVisibility;
      return {
        id: row.id,
        section: row.section,
        last_name: row.last_name,
        first_name: row.first_name,
        current_name: row.current_name,
        in_memoriam: row.in_memoriam,
        status: row.status,
        profile_photo: row.profile_photo,
        // City and country always shown
        city: row.city,
        country: row.country,
        // Apply visibility rules for other fields
        birthday: vis.birthday ? row.birthday : null,
        mobile: vis.mobile ? row.mobile : null,
        address: vis.address ? row.address : null,
        occupation: vis.occupation ? row.occupation : null,
        company: vis.company ? row.company : null,
        facebook_url: vis.social ? row.facebook_url : null,
        linkedin_url: vis.social ? row.linkedin_url : null,
        instagram_url: vis.social ? row.instagram_url : null,
        rsvp_status: row.rsvp_status
      };
    });

    res.json({ entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public search for graduation self-identification (registration form)
// Returns graduates only (section NOT NULL and != 'Non-Graduate')
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.trim().toLowerCase()}%`;

    const result = await db.query(
      `SELECT id, first_name, last_name, current_name, section
       FROM master_list
       WHERE section IS NOT NULL
         AND section != 'Non-Graduate'
         AND in_memoriam = FALSE
         AND (
           LOWER(first_name) LIKE $1
           OR LOWER(last_name) LIKE $1
           OR LOWER(current_name) LIKE $1
           OR LOWER(first_name || ' ' || last_name) LIKE $1
         )
       ORDER BY last_name, first_name
       LIMIT 10`,
      [searchTerm]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error searching master list:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;