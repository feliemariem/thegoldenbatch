const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

// Helper: Check if user is a grad (has invite_id)
const checkIsGrad = async (userId) => {
  const result = await db.query('SELECT invite_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.invite_id != null;
};

// Helper: Check if email has access to batch-rep feature
const checkEmailAccess = async (email) => {
  const configResult = await db.query(
    "SELECT value FROM site_config WHERE key = 'batch_rep_enabled_emails'"
  );
  if (configResult.rows.length === 0) return false;

  const enabledValue = configResult.rows[0].value;
  if (enabledValue === 'all') return true;

  const enabledEmails = enabledValue.split(',').map(e => e.trim().toLowerCase());
  return enabledEmails.includes(email.toLowerCase());
};

// GET /api/batch-rep/status
// Returns current status and whether user has access/submitted
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const isAdmin = req.user.isAdmin;

    // Get batch_rep_status
    const statusResult = await db.query(
      "SELECT value FROM site_config WHERE key = 'batch_rep_status'"
    );
    const status = statusResult.rows[0]?.value || 'active';

    // Check if user has already submitted
    const submissionResult = await db.query(
      'SELECT id FROM batch_rep_submissions WHERE voter_id = $1',
      [userId]
    );
    const hasSubmitted = submissionResult.rows.length > 0;

    // Check if user is a grad
    const isGrad = await checkIsGrad(userId);

    // Check if user has access
    const hasAccess = await checkEmailAccess(userEmail);

    res.json({
      status,
      hasSubmitted,
      isGrad,
      isAdmin,
      hasAccess
    });
  } catch (err) {
    console.error('Error fetching batch-rep status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/batch-rep/submit
// Submit confirmation or nomination (grad only, one per user)
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { selection, nominee_name, comments } = req.body;

    // Validate selection
    if (!selection || !['confirm', 'nominate'].includes(selection)) {
      return res.status(400).json({ error: 'Invalid selection. Must be "confirm" or "nominate".' });
    }

    // If nominating, require nominee_name
    if (selection === 'nominate' && !nominee_name?.trim()) {
      return res.status(400).json({ error: 'Nominee name is required when nominating.' });
    }

    // Check user is a grad
    const isGrad = await checkIsGrad(userId);
    if (!isGrad) {
      return res.status(403).json({ error: 'Only graduates can submit responses.' });
    }

    // Check status is active
    const statusResult = await db.query(
      "SELECT value FROM site_config WHERE key = 'batch_rep_status'"
    );
    if (statusResult.rows[0]?.value !== 'active') {
      return res.status(400).json({ error: 'Submissions are currently closed.' });
    }

    // Check if already submitted
    const existingResult = await db.query(
      'SELECT id FROM batch_rep_submissions WHERE voter_id = $1',
      [userId]
    );
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have already submitted your response.' });
    }

    // Insert submission
    await db.query(
      `INSERT INTO batch_rep_submissions (voter_id, selection, nominee_name, comments)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        selection,
        selection === 'nominate' ? nominee_name.trim() : null,
        comments?.trim() || null
      ]
    );

    res.json({ success: true, message: 'Your response has been recorded.' });
  } catch (err) {
    // Handle unique constraint violation
    if (err.code === '23505') {
      return res.status(400).json({ error: 'You have already submitted your response.' });
    }
    console.error('Error submitting batch-rep response:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/batch-rep/results
// Admin only - returns aggregate results
router.get('/results', authenticateAdmin, async (req, res) => {
  try {
    // Get total submissions
    const totalResult = await db.query('SELECT COUNT(*) as total FROM batch_rep_submissions');
    const totalSubmissions = parseInt(totalResult.rows[0].total);

    // Get confirmations count
    const confirmsResult = await db.query(
      "SELECT COUNT(*) as count FROM batch_rep_submissions WHERE selection = 'confirm'"
    );
    const totalConfirms = parseInt(confirmsResult.rows[0].count);

    // Get nominations with counts (only those with 2+ votes shown by name)
    const nominationsResult = await db.query(`
      SELECT nominee_name, COUNT(*) as count
      FROM batch_rep_submissions
      WHERE selection = 'nominate' AND nominee_name IS NOT NULL
      GROUP BY nominee_name
      ORDER BY count DESC
    `);

    // Process nominations: show names for 2+ votes, aggregate singles into "Other"
    const topNominees = [];
    let otherCount = 0;

    for (const row of nominationsResult.rows) {
      if (parseInt(row.count) >= 2) {
        topNominees.push({
          name: row.nominee_name,
          count: parseInt(row.count)
        });
      } else {
        otherCount += parseInt(row.count);
      }
    }

    // Add "Other" if there are single-vote nominees
    if (otherCount > 0) {
      topNominees.push({
        name: 'Other',
        count: otherCount
      });
    }

    res.json({
      totalSubmissions,
      totalConfirms,
      totalNominations: totalSubmissions - totalConfirms,
      topNominees
    });
  } catch (err) {
    console.error('Error fetching batch-rep results:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/batch-rep/status
// System admin (id=1) only - update batch_rep_status
router.patch('/status', authenticateAdmin, async (req, res) => {
  try {
    // Check if system admin (id=1)
    if (req.user.id !== 1) {
      return res.status(403).json({ error: 'Only the system administrator can update this setting.' });
    }

    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'closed', 'published'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "active", "closed", or "published".' });
    }

    // Update site_config
    await db.query(
      `UPDATE site_config SET value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE key = 'batch_rep_status'`,
      [status]
    );

    res.json({ success: true, status });
  } catch (err) {
    console.error('Error updating batch-rep status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/batch-rep/graduates/search
// Typeahead search for graduates (for nomination field)
router.get('/graduates/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q.trim()}%`;

    // Search users who are graduates (have invite_id)
    const result = await db.query(`
      SELECT u.id, u.first_name, u.last_name
      FROM users u
      WHERE u.invite_id IS NOT NULL
        AND (
          u.first_name ILIKE $1
          OR u.last_name ILIKE $1
          OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $1
        )
      ORDER BY u.last_name, u.first_name
      LIMIT 10
    `, [searchTerm]);

    res.json(result.rows.map(r => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`
    })));
  } catch (err) {
    console.error('Error searching graduates:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
