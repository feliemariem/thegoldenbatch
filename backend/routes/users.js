const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { AMOUNT_DUE } = require('../config/constants');

// Helper function for text normalization
// Preserves short acronyms (3 chars or fewer, all caps) like JR, CEO, LA, IT, HR, VP, CPA, MD
const toTitleCase = (str) => {
  if (!str) return str;
  return str.trim().split(/\s+/).map(word => {
    // If word is 3 chars or fewer and all uppercase, keep it (likely an acronym)
    if (word.length <= 3 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
      return word;
    }
    // Otherwise, apply normal title case
    return word.toLowerCase().replace(/^\w/, char => char.toUpperCase());
  }).join(' ');
};

// Get current user's profile with RSVP, section, and payment status
router.get('/', authenticateToken, async (req, res) => {
  try {
    // First try users table
    const userResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.birthday,
              u.mobile, u.address, u.city, u.country, u.occupation, u.company,
              u.profile_photo, u.facebook_url, u.linkedin_url, u.instagram_url,
              u.shirt_size, u.jacket_size, u.has_alumni_card,
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
      [req.user.id]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      // Get payment totals if user is linked to master_list
      // Only verified (OK) deposits count toward pledge; pending shown separately
      let totalPaid = 0;
      let pendingPaid = 0;
      if (user.master_list_id) {
        const paymentResult = await db.query(
          `SELECT
            COALESCE(SUM(CASE WHEN verified = 'OK' THEN deposit ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN verified != 'OK' OR verified IS NULL THEN deposit ELSE 0 END), 0) as pending_paid
           FROM ledger
           WHERE master_list_id = $1 AND deposit > 0`,
          [user.master_list_id]
        );
        totalPaid = parseFloat(paymentResult.rows[0].total_paid) || 0;
        pendingPaid = parseFloat(paymentResult.rows[0].pending_paid) || 0;
      }

      // Determine amount_due based on builder tier
      let amountDue;
      if (user.builder_tier && user.builder_tier !== 'root') {
        amountDue = parseFloat(user.pledge_amount);
      } else if (user.builder_tier === 'root') {
        amountDue = null;
      } else {
        amountDue = AMOUNT_DUE; // Default fallback
      }

      // Check if this user is also an admin and get their admin details
      let isSuperAdmin = false;
      let hasPermissions = false;
      if (req.user.isAdmin) {
        const adminCheck = await db.query(
          `SELECT id, is_super_admin FROM admins WHERE LOWER(email) = LOWER($1)`,
          [user.email]
        );
        console.log('[/api/me] adminCheck for', user.email, ':', adminCheck.rows);
        if (adminCheck.rows.length > 0) {
          const adminData = adminCheck.rows[0];
          isSuperAdmin = adminData.is_super_admin || false;
          // Check if admin has at least one enabled permission
          const permsCheck = await db.query(
            `SELECT 1 FROM permissions WHERE admin_id = $1 AND enabled = true LIMIT 1`,
            [adminData.id]
          );
          hasPermissions = permsCheck.rows.length > 0;
          console.log('[/api/me] Result: is_super_admin=', isSuperAdmin, ', hasPermissions=', hasPermissions);
        } else {
          console.log('[/api/me] No admin entry found in admins table for', user.email);
        }
      }

      return res.json({
        ...user,
        total_paid: totalPaid,
        pending_paid: pendingPaid,
        amount_due: amountDue,
        builder_tier: user.builder_tier,
        pledge_amount: user.pledge_amount ? parseFloat(user.pledge_amount) : null,
        builder_tier_set_at: user.builder_tier_set_at,
        recognition_public: user.recognition_public !== false, // Default to true if null
        is_graduate: user.section && user.section !== 'Non-Graduate',
        isAdmin: req.user.isAdmin || false,
        is_super_admin: isSuperAdmin,
        hasPermissions: hasPermissions
      });
    }

    // If not found in users table, check admins table
    const adminResult = await db.query(
      `SELECT id, email, first_name, last_name, role_title, is_super_admin
       FROM admins WHERE id = $1`,
      [req.user.id]
    );

    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      // Check if admin has at least one enabled permission
      const permsCheck = await db.query(
        `SELECT 1 FROM permissions WHERE admin_id = $1 AND enabled = true LIMIT 1`,
        [admin.id]
      );
      const hasPermissions = permsCheck.rows.length > 0;

      return res.json({
        id: admin.id,
        email: admin.email,
        first_name: admin.first_name,
        last_name: admin.last_name,
        role_title: admin.role_title,
        is_super_admin: admin.is_super_admin || false,
        hasPermissions: hasPermissions,
        isAdmin: true
      });
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update builder tier
router.put('/builder-tier', authenticateToken, async (req, res) => {
  try {
    const { tier, pledge_amount, recognition_public } = req.body;
    const validTiers = ['cornerstone', 'pillar', 'anchor', 'root'];

    // Get user's master_list_id
    const linkResult = await db.query(
      `SELECT i.master_list_id FROM users u JOIN invites i ON u.invite_id = i.id WHERE u.id = $1`,
      [req.user.id]
    );

    if (linkResult.rows.length === 0 || !linkResult.rows[0].master_list_id) {
      return res.status(400).json({ error: 'Not linked to master list' });
    }

    const masterListId = linkResult.rows[0].master_list_id;

    // Handle tier removal (tier = null)
    if (tier === null) {
      const result = await db.query(
        `UPDATE master_list SET builder_tier = NULL, pledge_amount = NULL, builder_tier_set_at = NULL WHERE id = $1
         RETURNING builder_tier, pledge_amount, builder_tier_set_at`,
        [masterListId]
      );

      return res.json({
        builder_tier: null,
        pledge_amount: null,
        builder_tier_set_at: null
      });
    }

    // Validate tier
    if (!tier || !validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be one of: cornerstone, pillar, anchor, root' });
    }

    // Validate pledge_amount based on tier
    let finalPledgeAmount;
    if (tier === 'cornerstone') {
      if (pledge_amount === null || pledge_amount === undefined || pledge_amount < 25000) {
        return res.status(400).json({ error: 'Cornerstone tier requires pledge_amount >= 25000' });
      }
      finalPledgeAmount = pledge_amount;
    } else if (tier === 'pillar') {
      if (pledge_amount === null || pledge_amount === undefined || pledge_amount < 18000 || pledge_amount > 24000) {
        return res.status(400).json({ error: 'Pillar tier requires pledge_amount between 18000-24000' });
      }
      finalPledgeAmount = pledge_amount;
    } else if (tier === 'anchor') {
      if (pledge_amount === null || pledge_amount === undefined || pledge_amount < 10000 || pledge_amount > 17000) {
        return res.status(400).json({ error: 'Anchor tier requires pledge_amount between 10000-17000' });
      }
      finalPledgeAmount = pledge_amount;
    } else if (tier === 'root') {
      finalPledgeAmount = null;
    }

    // Update master_list (include recognition_public if provided, default to true)
    const recognitionValue = recognition_public !== undefined ? recognition_public : true;
    const result = await db.query(
      `UPDATE master_list SET builder_tier = $1, pledge_amount = $2, builder_tier_set_at = NOW(), recognition_public = $3 WHERE id = $4
       RETURNING builder_tier, pledge_amount, builder_tier_set_at, recognition_public`,
      [tier, finalPledgeAmount, recognitionValue, masterListId]
    );

    const row = result.rows[0];
    res.json({
      builder_tier: row.builder_tier,
      pledge_amount: row.pledge_amount ? parseFloat(row.pledge_amount) : null,
      builder_tier_set_at: row.builder_tier_set_at,
      recognition_public: row.recognition_public !== false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update recognition visibility independently
router.put('/recognition-visibility', authenticateToken, async (req, res) => {
  try {
    const { recognition_public } = req.body;

    if (typeof recognition_public !== 'boolean') {
      return res.status(400).json({ error: 'recognition_public must be a boolean' });
    }

    // Get user's master_list_id
    const linkResult = await db.query(
      `SELECT i.master_list_id FROM users u JOIN invites i ON u.invite_id = i.id WHERE u.id = $1`,
      [req.user.id]
    );

    if (linkResult.rows.length === 0 || !linkResult.rows[0].master_list_id) {
      return res.status(400).json({ error: 'Not linked to master list' });
    }

    const masterListId = linkResult.rows[0].master_list_id;

    // Update only recognition_public
    const result = await db.query(
      `UPDATE master_list SET recognition_public = $1 WHERE id = $2
       RETURNING recognition_public`,
      [recognition_public, masterListId]
    );

    res.json({ recognition_public: result.rows[0].recognition_public });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update current user's profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      birthday,
      mobile,
      address,
      city,
      country,
      occupation,
      company,
      facebook_url,
      linkedin_url,
      instagram_url,
      rsvp_status,
    } = req.body;

    const result = await db.query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        birthday = COALESCE($3, birthday),
        mobile = COALESCE($4, mobile),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        country = COALESCE($7, country),
        occupation = COALESCE($8, occupation),
        company = COALESCE($9, company),
        facebook_url = COALESCE($10, facebook_url),
        linkedin_url = COALESCE($11, linkedin_url),
        instagram_url = COALESCE($12, instagram_url),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING id, email, first_name, last_name, birthday, mobile, address, city, country, occupation, company, facebook_url, linkedin_url, instagram_url`,
      [
        toTitleCase(first_name),
        toTitleCase(last_name),
        birthday,
        mobile,
        toTitleCase(address),
        toTitleCase(city),
        toTitleCase(country),
        toTitleCase(occupation),
        toTitleCase(company),
        facebook_url,
        linkedin_url,
        instagram_url,
        req.user.id
      ]
    );

    // Cascade name changes to invites and master_list
    if (first_name || last_name) {
      console.log(`[Name Propagation] Triggered for user ${req.user.id}`);
      const updatedFirstName = toTitleCase(first_name) || result.rows[0].first_name;
      const updatedLastName = toTitleCase(last_name) || result.rows[0].last_name;

      // Get the user's invite_id
      const userInvite = await db.query(
        'SELECT invite_id FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userInvite.rows.length > 0 && userInvite.rows[0].invite_id) {
        const inviteId = userInvite.rows[0].invite_id;
        console.log(`[Name Propagation] Found invite_id: ${inviteId}`);

        // Update invites table
        await db.query(
          'UPDATE invites SET first_name = $1, last_name = $2 WHERE id = $3',
          [updatedFirstName, updatedLastName, inviteId]
        );
        console.log(`[Name Propagation] Updated invites table`);

        // Get master_list_id from invites
        const inviteRow = await db.query(
          'SELECT master_list_id FROM invites WHERE id = $1',
          [inviteId]
        );

        if (inviteRow.rows.length > 0 && inviteRow.rows[0].master_list_id) {
          const masterListId = inviteRow.rows[0].master_list_id;
          console.log(`[Name Propagation] Found master_list_id: ${masterListId}`);
          const currentName = `${updatedFirstName} ${updatedLastName}`;

          // Update ONLY current_name on master_list (never overwrite yearbook first_name/last_name)
          await db.query(
            'UPDATE master_list SET current_name = $1 WHERE id = $2',
            [currentName, masterListId]
          );
          console.log(`[Name Propagation] Updated master_list current_name to: ${currentName}`);
        } else {
          console.log(`[Name Propagation] Skipped: No master_list_id found for invite ${inviteId}`);
        }
      } else {
        console.log(`[Name Propagation] Skipped: No invite_id found for user ${req.user.id}`);
      }
    }

    // Update RSVP if provided
    if (rsvp_status && ['going', 'not_going', 'maybe'].includes(rsvp_status)) {
      await db.query(
        `INSERT INTO rsvps (user_id, status, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) 
         DO UPDATE SET status = $2, updated_at = CURRENT_TIMESTAMP`,
        [req.user.id, rsvp_status]
      );
    }

    res.json({ ...result.rows[0], rsvp_status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update RSVP only
router.put('/rsvp', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['going', 'not_going', 'maybe'].includes(status)) {
      return res.status(400).json({ error: 'Invalid RSVP status' });
    }

    await db.query(
      `INSERT INTO rsvps (user_id, status, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET status = $2, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, status]
    );

    res.json({ status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update merch preferences
router.put('/merch', authenticateToken, async (req, res) => {
  try {
    const { shirt_size, jacket_size } = req.body;
    const validSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '', null];

    if (shirt_size !== undefined && !validSizes.includes(shirt_size)) {
      return res.status(400).json({ error: 'Invalid shirt size' });
    }
    if (jacket_size !== undefined && !validSizes.includes(jacket_size)) {
      return res.status(400).json({ error: 'Invalid jacket size' });
    }

    const result = await db.query(
      `UPDATE users SET
        shirt_size = $1,
        jacket_size = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING shirt_size, jacket_size`,
      [shirt_size || null, jacket_size || null, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update alumni card status
router.put('/alumni-card', authenticateToken, async (req, res) => {
  try {
    const { has_alumni_card } = req.body;

    if (typeof has_alumni_card !== 'boolean') {
      return res.status(400).json({ error: 'has_alumni_card must be a boolean' });
    }

    const result = await db.query(
      `UPDATE users SET
        has_alumni_card = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING has_alumni_card`,
      [has_alumni_card, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload profile photo
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

router.post('/photo', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get current photo to delete if exists
    const current = await db.query(
      'SELECT profile_photo FROM users WHERE id = $1',
      [req.user.id]
    );

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, 'profile-photos');

    // Update database
    await db.query(
      'UPDATE users SET profile_photo = $1 WHERE id = $2',
      [result.secure_url, req.user.id]
    );

    res.json({ profile_photo: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// Delete profile photo
router.delete('/photo', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'UPDATE users SET profile_photo = NULL WHERE id = $1',
      [req.user.id]
    );

    res.json({ message: 'Photo removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove photo' });
  }
});

// Get today's birthdays
router.get('/birthdays/today', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, first_name, last_name, profile_photo, birthday
       FROM users
       WHERE EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
       ORDER BY first_name, last_name`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;