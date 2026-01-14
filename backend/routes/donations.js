const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

// Get all donations + total
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM donations ORDER BY donation_date DESC, created_at DESC`
    );

    const totalResult = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM donations`
    );

    res.json({
      donations: result.rows,
      total: parseFloat(totalResult.rows[0].total)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a donation
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { donor_name, amount, donation_date, method, notes } = req.body;

    if (!donor_name || !amount) {
      return res.status(400).json({ error: 'Donor name and amount are required' });
    }

    // Get first name from users or admins table
    let recorderName = null;
    const userResult = await db.query('SELECT first_name FROM users WHERE LOWER(email) = $1', [req.user.email.toLowerCase()]);
    if (userResult.rows.length > 0) {
      recorderName = userResult.rows[0].first_name;
    } else {
      const adminResult = await db.query('SELECT first_name FROM admins WHERE LOWER(email) = $1', [req.user.email.toLowerCase()]);
      if (adminResult.rows.length > 0) {
        recorderName = adminResult.rows[0].first_name;
      }
    }

    const result = await db.query(
      `INSERT INTO donations (donor_name, amount, donation_date, method, notes, recorded_by_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        donor_name,
        parseFloat(amount),
        donation_date || new Date(),
        method || null,
        notes || null,
        recorderName
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a donation
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { donor_name, amount, donation_date, method, notes } = req.body;

    const result = await db.query(
      `UPDATE donations SET
        donor_name = COALESCE($1, donor_name),
        amount = COALESCE($2, amount),
        donation_date = COALESCE($3, donation_date),
        method = COALESCE($4, method),
        notes = COALESCE($5, notes)
       WHERE id = $6
       RETURNING *`,
      [donor_name, amount ? parseFloat(amount) : null, donation_date, method, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a donation
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM donations WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    res.json({ message: 'Donation deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public route - get total only (for public funds page)
router.get('/total', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM donations`
    );

    res.json({
      total: parseFloat(result.rows[0].total),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;