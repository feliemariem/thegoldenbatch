const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

// Helper function for text normalization
const toTitleCase = (str) => {
  if (!str) return str;
  return str.trim().replace(/\b\w/g, (char) => char.toUpperCase());
};

const toLowerEmail = (email) => {
  if (!email) return email;
  return email.trim().toLowerCase();
};

// Get all master list entries with status
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { section } = req.query;

    let query = `
      SELECT 
        m.id,
        m.section,
        m.last_name,
        m.first_name,
        m.nickname,
        m.email,
        m.in_memoriam,
        m.is_unreachable,
        m.is_admin,
        m.created_at,
        CASE 
          WHEN m.in_memoriam = true THEN 'In Memoriam'
          WHEN m.is_unreachable = true THEN 'Unreachable'
          WHEN u.id IS NOT NULL THEN 'Registered'
          WHEN i.id IS NOT NULL THEN 'Invited'
          ELSE 'Not Invited'
        END as status,
        CASE 
          WHEN m.section = 'Non-Graduate' OR m.in_memoriam = true THEN NULL
          ELSE COALESCE(ledger_totals.total_paid, 0)
        END as total_paid,
        CASE 
          WHEN m.section = 'Non-Graduate' OR m.in_memoriam = true THEN NULL
          ELSE 25000 - COALESCE(ledger_totals.total_paid, 0)
        END as balance,
        CASE
          WHEN m.section = 'Non-Graduate' OR m.in_memoriam = true THEN NULL
          WHEN COALESCE(ledger_totals.total_paid, 0) >= 25000 THEN 'Full'
          WHEN COALESCE(ledger_totals.total_paid, 0) > 0 THEN 'Partial'
          ELSE 'Unpaid'
        END as payment_status
      FROM master_list m
      LEFT JOIN invites i ON LOWER(m.email) = LOWER(i.email)
      LEFT JOIN users u ON LOWER(m.email) = LOWER(u.email)
      LEFT JOIN (
        SELECT master_list_id, SUM(deposit) as total_paid
        FROM ledger
        WHERE master_list_id IS NOT NULL AND deposit > 0
        GROUP BY master_list_id
      ) ledger_totals ON m.id = ledger_totals.master_list_id
    `;

    const params = [];

    if (section && section !== 'all') {
      if (section === 'graduates') {
        query += ` WHERE m.section != 'Non-Graduate'`;
      } else {
        query += ` WHERE m.section = $1`;
        params.push(section);
      }
    }

    // Sort by last name only for 'all', otherwise by section then last name
    if (section && section !== 'all') {
      query += ` ORDER BY m.last_name, m.first_name`;
    } else {
      query += ` ORDER BY m.last_name, m.first_name`;
    }

    const result = await db.query(query, params);

    // Get stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN u.id IS NOT NULL THEN 1 END) as registered,
        COUNT(CASE WHEN i.id IS NOT NULL AND u.id IS NULL AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false) THEN 1 END) as invited,
        COUNT(CASE WHEN i.id IS NULL AND u.id IS NULL AND (m.in_memoriam IS NULL OR m.in_memoriam = false) AND (m.is_unreachable IS NULL OR m.is_unreachable = false) THEN 1 END) as not_invited,
        COUNT(CASE WHEN m.in_memoriam = true THEN 1 END) as in_memoriam,
        COUNT(CASE WHEN m.is_unreachable = true THEN 1 END) as unreachable
      FROM master_list m
      LEFT JOIN invites i ON LOWER(m.email) = LOWER(i.email)
      LEFT JOIN users u ON LOWER(m.email) = LOWER(u.email)
    `);

    // Get payment stats (graduates only, excluding in memoriam)
    const paymentStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total_graduates,
        COUNT(CASE WHEN COALESCE(ledger_totals.total_paid, 0) >= 25000 THEN 1 END) as full_paid,
        COUNT(CASE WHEN COALESCE(ledger_totals.total_paid, 0) > 0 AND COALESCE(ledger_totals.total_paid, 0) < 25000 THEN 1 END) as partial_paid,
        COUNT(CASE WHEN COALESCE(ledger_totals.total_paid, 0) = 0 THEN 1 END) as unpaid
      FROM master_list m
      LEFT JOIN (
        SELECT master_list_id, SUM(deposit) as total_paid
        FROM ledger
        WHERE master_list_id IS NOT NULL AND deposit > 0
        GROUP BY master_list_id
      ) ledger_totals ON m.id = ledger_totals.master_list_id
      WHERE m.section != 'Non-Graduate' AND (m.in_memoriam IS NULL OR m.in_memoriam = false)
    `);

    // Get sections for dropdown
    const sectionsResult = await db.query(`
      SELECT DISTINCT section FROM master_list ORDER BY section
    `);

    res.json({
      entries: result.rows,
      stats: {
        ...statsResult.rows[0],
        ...paymentStatsResult.rows[0]
      },
      sections: sectionsResult.rows.map(r => r.section)
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
  console.log('=== Master List Update ===');
  console.log('ID:', req.params.id);
  console.log('Body:', req.body);
  console.log('User:', req.user.email);
  try {
    const { id } = req.params;
    const { last_name, first_name, nickname, email, section, in_memoriam, is_unreachable, is_admin } = req.body;

    // Only super admins can change is_admin or in_memoriam
    const wantsToChangeProtectedFields =
      typeof req.body.is_admin === 'boolean' || typeof req.body.in_memoriam === 'boolean';

    if (wantsToChangeProtectedFields) {
      const superAdminCheck = await db.query(
        'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
        [req.user.email.toLowerCase()]
      );

      if (!superAdminCheck.rows[0]?.is_super_admin) {
        return res.status(403).json({ error: 'Super Admin access required' });
      }
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

    // If becoming admin and has email, create admin entry
    if (willBeAdmin && !wasAdmin && entryEmail) {
      // Check if admin already exists with this email
      const existingAdmin = await db.query('SELECT id FROM admins WHERE email = $1', [entryEmail]);

      if (existingAdmin.rows.length === 0) {
        // Create admin entry (no password - they'll use forgot password to set one)
        await db.query(
          `INSERT INTO admins (email, first_name, last_name, password_hash, is_super_admin)
           VALUES ($1, $2, $3, $4, $5)`,
          [entryEmail, entryFirstName, entryLastName, '', false]
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

    const result = await db.query(
      `UPDATE master_list SET
        last_name = COALESCE($1, last_name),
        first_name = COALESCE($2, first_name),
        nickname = COALESCE($3, nickname),
        email = COALESCE($4, email),
        section = COALESCE($5, section),
        in_memoriam = COALESCE($6, in_memoriam),
        is_unreachable = COALESCE($7, is_unreachable),
        is_admin = COALESCE($8, is_admin),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        toTitleCase(last_name),
        toTitleCase(first_name),
        toTitleCase(nickname),
        toLowerEmail(email),
        section,
        in_memoriam,
        is_unreachable,
        is_admin,
        id
      ]
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

    // If was admin, remove from admins table (but not super admins)
    if (entry.rows[0].is_admin && entry.rows[0].email) {
      await db.query('DELETE FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false', [entry.rows[0].email.toLowerCase()]);
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
    // Remove all non-super admins first
    await db.query('DELETE FROM admins WHERE is_super_admin = false');
    // Then clear master list
    await db.query('DELETE FROM master_list');
    res.json({ message: 'Master list cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;