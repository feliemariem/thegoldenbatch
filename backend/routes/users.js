const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper function for text normalization
const toTitleCase = (str) => {
  if (!str) return str;
  return str.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

// Get current user's profile with RSVP, section, and payment status
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.birthday,
              u.mobile, u.address, u.city, u.country, u.occupation, u.company,
              u.profile_photo,
              r.status as rsvp_status,
              m.id as master_list_id,
              m.section,
              m.current_name
       FROM users u
       LEFT JOIN rsvps r ON u.id = r.user_id
       LEFT JOIN invites i ON u.invite_id = i.id
       LEFT JOIN master_list m ON i.master_list_id = m.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get payment total if user is linked to master_list
    let totalPaid = 0;
    if (user.master_list_id) {
      const paymentResult = await db.query(
        `SELECT COALESCE(SUM(deposit), 0) as total_paid
         FROM ledger
         WHERE master_list_id = $1`,
        [user.master_list_id]
      );
      totalPaid = parseFloat(paymentResult.rows[0].total_paid) || 0;
    }

    res.json({
      ...user,
      total_paid: totalPaid,
      amount_due: 25000,
      is_graduate: user.section && user.section !== 'Non-Graduate'
    });
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
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING id, email, first_name, last_name, birthday, mobile, address, city, country, occupation, company`,
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
        req.user.id
      ]
    );

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