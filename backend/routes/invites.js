const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { sendInviteEmail } = require('../utils/email');

// Get frontend URL from environment or fallback to localhost
const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

// Create a new invite (admin only)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { email, first_name, last_name } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await db.query(
      'INSERT INTO invites (email, first_name, last_name) VALUES ($1, $2, $3) RETURNING id, email, first_name, last_name, invite_token, created_at',
      [email.toLowerCase(), first_name || null, last_name || null]
    );

    const invite = result.rows[0];
    
    // Return the full registration URL
    const registrationUrl = `${getFrontendUrl()}/register/${invite.invite_token}`;

    // Send email
    const emailResult = await sendInviteEmail(email, first_name, registrationUrl);
    
    // Update email_sent status
    if (emailResult.success) {
      await db.query('UPDATE invites SET email_sent = true WHERE id = $1', [invite.id]);
    }
    
    res.status(201).json({
      ...invite,
      registrationUrl,
    });
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Email already invited' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk upload invites (admin only)
router.post('/bulk', authenticateAdmin, async (req, res) => {
  try {
    const { invites } = req.body;
    
    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      return res.status(400).json({ error: 'Invites array is required' });
    }

    const results = {
      success: [],
      duplicates: [],
      errors: []
    };

    for (const invite of invites) {
      try {
        const result = await db.query(
          'INSERT INTO invites (email, first_name, last_name) VALUES ($1, $2, $3) RETURNING id, email, first_name, last_name, invite_token',
          [invite.email.toLowerCase(), invite.first_name || null, invite.last_name || null]
        );
        
        const newInvite = result.rows[0];
        const registrationUrl = `${getFrontendUrl()}/register/${newInvite.invite_token}`;
        
        // Send email
        const emailResult = await sendInviteEmail(invite.email, invite.first_name, registrationUrl);
        
        // Update email_sent status
        if (emailResult.success) {
          await db.query('UPDATE invites SET email_sent = true WHERE id = $1', [newInvite.id]);
        }
        
        results.success.push({
          ...newInvite,
          emailSent: emailResult.success,
          registrationUrl
        });
      } catch (err) {
        if (err.code === '23505') {
          results.duplicates.push(invite.email);
        } else {
          results.errors.push({ email: invite.email, error: err.message });
        }
      }
    }

    res.status(201).json({
      message: `Created ${results.success.length} invites`,
      ...results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate an invite token (public)
router.get('/:token/validate', async (req, res) => {
  try {
    const { token } = req.params;
    
    const result = await db.query(
      'SELECT id, email, first_name, last_name, used FROM invites WHERE invite_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Invalid invite token' });
    }

    const invite = result.rows[0];
    
    if (invite.used) {
      return res.status(400).json({ valid: false, error: 'Invite already used' });
    }

    res.json({ 
      valid: true, 
      email: invite.email,
      first_name: invite.first_name,
      last_name: invite.last_name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all invites (admin only) - with pagination
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 45, search, status } = req.query;

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
        LOWER(i.first_name || ' ' || i.last_name) LIKE $${paramIndex}
        OR LOWER(i.email) LIKE $${paramIndex}
      )`);
      params.push(searchTerm);
      paramIndex++;
    }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'registered') {
        conditions.push(`i.used = true`);
      } else if (status === 'pending') {
        conditions.push(`i.used = false`);
      }
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    // Get paginated results
    const result = await db.query(`
      SELECT
        i.id, i.email, i.first_name, i.last_name, i.invite_token, i.used, i.email_sent, i.created_at, i.master_list_id,
        m.first_name as ml_first_name, m.last_name as ml_last_name
      FROM invites i
      LEFT JOIN master_list m ON i.master_list_id = m.id
      ${whereClause}
      ORDER BY i.last_name ASC NULLS LAST, i.first_name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limitNum, offset]);

    // Get total count for pagination
    const countResult = await db.query(`
      SELECT COUNT(*) FROM invites i ${whereClause}
    `, params);
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN used = true THEN 1 END) as registered,
        COUNT(CASE WHEN used = false THEN 1 END) as pending
      FROM invites
    `);

    res.json({
      invites: result.rows,
      stats: statsResult.rows[0],
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

// Update an invite (admin only) - only for pending invites
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email } = req.body;
    
    // Check if invite exists and is not used
    const checkResult = await db.query('SELECT used FROM invites WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (checkResult.rows[0].used) {
      return res.status(400).json({ error: 'Cannot edit a used invite' });
    }
    
    const result = await db.query(
      `UPDATE invites SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email)
       WHERE id = $4
       RETURNING *`,
      [first_name, last_name, email?.toLowerCase(), id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete an invite (admin only) - only for pending invites
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if invite exists and is not used
    const checkResult = await db.query('SELECT email, used, master_list_id FROM invites WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (checkResult.rows[0].used) {
      return res.status(400).json({ error: 'Cannot delete a used invite' });
    }

    const inviteEmail = checkResult.rows[0].email?.toLowerCase();
    const masterListId = checkResult.rows[0].master_list_id;

    // If linked to master list, check if they were an admin and clean up
    if (masterListId) {
      const masterListEntry = await db.query(
        'SELECT is_admin FROM master_list WHERE id = $1',
        [masterListId]
      );

      // If they were an admin, remove from permissions and admins tables
      if (masterListEntry.rows[0]?.is_admin && inviteEmail) {
        // Delete permissions first
        await db.query(
          `DELETE FROM permissions
           WHERE admin_id IN (
             SELECT id FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false
           )`,
          [inviteEmail]
        );

        // Then delete admin row
        await db.query(
          'DELETE FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false',
          [inviteEmail]
        );
      }

      // Clear current_name, email, admin status, and reset status to 'Not Invited'
      await db.query(
        `UPDATE master_list SET
          current_name = NULL,
          email = NULL,
          status = 'Not Invited',
          is_admin = false,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [masterListId]
      );
    }

    await db.query('DELETE FROM invites WHERE id = $1', [id]);

    res.json({ message: 'Invite deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Link invite to master list entry (admin only)
router.put('/:id/link', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { master_list_id } = req.body;

    // Get invite details including used status
    const inviteResult = await db.query('SELECT email, first_name, last_name, used FROM invites WHERE id = $1', [id]);
    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    const { email, first_name, last_name, used } = inviteResult.rows[0];

    // Build current_name from invite's first_name and last_name
    const currentName = [first_name, last_name].filter(Boolean).join(' ') || null;

    // Set status based on whether invite is already used (user already registered)
    const status = used ? 'Registered' : 'Pending';

    // Update master list entry with email, current_name, and appropriate status
    await db.query(
      `UPDATE master_list SET
        email = $1,
        current_name = $2,
        status = $3,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [email, currentName, status, master_list_id]
    );

    // Update invite with master_list_id
    await db.query('UPDATE invites SET master_list_id = $1 WHERE id = $2', [master_list_id, id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unlink invite from master list entry (admin only)
router.put('/:id/unlink', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the current master_list_id and invite email
    const inviteResult = await db.query('SELECT email, master_list_id FROM invites WHERE id = $1', [id]);
    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    const masterListId = inviteResult.rows[0].master_list_id;
    const inviteEmail = inviteResult.rows[0].email?.toLowerCase();

    // If linked to master list, check if they were an admin and clean up
    if (masterListId) {
      const masterListEntry = await db.query(
        'SELECT is_admin FROM master_list WHERE id = $1',
        [masterListId]
      );

      // If they were an admin, remove from permissions and admins tables
      if (masterListEntry.rows[0]?.is_admin && inviteEmail) {
        // Delete permissions first
        await db.query(
          `DELETE FROM permissions
           WHERE admin_id IN (
             SELECT id FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false
           )`,
          [inviteEmail]
        );

        // Then delete admin row
        await db.query(
          'DELETE FROM admins WHERE LOWER(email) = $1 AND is_super_admin = false',
          [inviteEmail]
        );
      }

      // Clear current_name, email, admin status, and reset status to 'Not Invited'
      await db.query(
        `UPDATE master_list SET
          current_name = NULL,
          email = NULL,
          status = 'Not Invited',
          is_admin = false,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [masterListId]
      );
    }

    // Remove link from invite
    await db.query('UPDATE invites SET master_list_id = NULL WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;