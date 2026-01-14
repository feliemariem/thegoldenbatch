const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper function for text normalization
const toTitleCase = (str) => {
  if (!str) return str;
  return str.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

// Get current user's profile with RSVP
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.birthday, 
              u.mobile, u.address, u.city, u.country, u.occupation, u.company,
              r.status as rsvp_status
       FROM users u
       LEFT JOIN rsvps r ON u.id = r.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.rows[0]);
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

module.exports = router;