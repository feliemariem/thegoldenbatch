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

    // Check user's willingness answer
    const willingnessResult = await db.query(
      'SELECT willing FROM batch_rep_willingness WHERE user_id = $1',
      [userId]
    );
    const willingnessAnswer = willingnessResult.rows.length > 0
      ? willingnessResult.rows[0].willing
      : null;

    res.json({
      status,
      hasSubmitted,
      isGrad,
      isAdmin,
      hasAccess,
      willingnessAnswer
    });
  } catch (err) {
    console.error('Error fetching batch-rep status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/batch-rep/willingness
// Upsert willingness to serve (grad only)
router.post('/willingness', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { willing } = req.body;

    // Validate willing is boolean
    if (typeof willing !== 'boolean') {
      return res.status(400).json({ error: 'Invalid value. Must be true or false.' });
    }

    // Check user is a grad
    const isGrad = await checkIsGrad(userId);
    if (!isGrad) {
      return res.status(403).json({ error: 'Only graduates can submit willingness.' });
    }

    // Upsert willingness record
    await db.query(
      `INSERT INTO batch_rep_willingness (user_id, willing, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET willing = $2, updated_at = NOW()`,
      [userId, willing]
    );

    res.json({ willing });
  } catch (err) {
    console.error('Error submitting willingness:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/batch-rep/submit
// Submit or update confirmation/nomination (grad only)
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

    // Upsert submission (insert or update)
    await db.query(
      `INSERT INTO batch_rep_submissions (voter_id, selection, nominee_name, comments)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (voter_id) DO UPDATE SET
         selection = $2,
         nominee_name = $3,
         comments = $4`,
      [
        userId,
        selection,
        selection === 'nominate' ? nominee_name.trim() : null,
        comments?.trim() || null
      ]
    );

    res.json({ success: true, message: 'Your response has been recorded.' });
  } catch (err) {
    console.error('Error submitting batch-rep response:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/batch-rep/results
// System admin (id=1) only - returns aggregate results with willingness data
router.get('/results', authenticateAdmin, async (req, res) => {
  try {
    if (req.user.id !== 1) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Get total responses
    const totalResult = await db.query('SELECT COUNT(*) as total FROM batch_rep_submissions');
    const totalResponses = parseInt(totalResult.rows[0].total);

    // Get confirmations count
    const confirmsResult = await db.query(
      "SELECT COUNT(*) as count FROM batch_rep_submissions WHERE selection = 'confirm'"
    );
    const totalConfirmations = parseInt(confirmsResult.rows[0].count);

    // Get nominations count
    const totalNominations = totalResponses - totalConfirmations;

    // Calculate confirmation percentage
    const confirmationPct = totalResponses > 0
      ? Math.round((totalConfirmations / totalResponses) * 100 * 10) / 10
      : 0;

    // Get nominees with willingness status and comments
    const nomineesResult = await db.query(`
      SELECT
        brs.nominee_name,
        COUNT(*) as count,
        array_agg(brs.comments) FILTER (WHERE brs.comments IS NOT NULL) as comments,
        brw.willing
      FROM batch_rep_submissions brs
      LEFT JOIN users u ON u.id = (
        SELECT u2.id FROM users u2
        JOIN invites i ON i.id = u2.invite_id
        JOIN master_list ml ON ml.id = i.master_list_id
        WHERE LOWER(u2.first_name || ' ' || u2.last_name) = LOWER(brs.nominee_name)
        LIMIT 1
      )
      LEFT JOIN batch_rep_willingness brw ON brw.user_id = u.id
      WHERE brs.selection = 'nominate' AND brs.nominee_name IS NOT NULL
      GROUP BY brs.nominee_name, brw.willing
      ORDER BY count DESC
    `);

    const nominees = nomineesResult.rows.map(row => ({
      name: row.nominee_name,
      count: parseInt(row.count),
      pct: totalResponses > 0
        ? Math.round((parseInt(row.count) / totalResponses) * 100 * 10) / 10
        : 0,
      willing: row.willing,
      comments: row.comments || []
    }));

    // Get willingness stats
    const willingnessResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE willing = true) as yes_count,
        COUNT(*) FILTER (WHERE willing = false) as no_count
      FROM batch_rep_willingness
    `);

    const willingnessTotal = parseInt(willingnessResult.rows[0].total);
    const willingnessYes = parseInt(willingnessResult.rows[0].yes_count);
    const willingnessNo = parseInt(willingnessResult.rows[0].no_count);

    res.json({
      totalResponses,
      totalConfirmations,
      totalNominations,
      confirmationPct,
      nominees,
      willingnessTotal,
      willingnessYes,
      willingnessNo,
      willingnessYesPct: willingnessTotal > 0
        ? Math.round((willingnessYes / willingnessTotal) * 100 * 10) / 10
        : 0,
      willingnessNoPct: willingnessTotal > 0
        ? Math.round((willingnessNo / willingnessTotal) * 100 * 10) / 10
        : 0
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
// Typeahead search for willing graduates (for nomination field)
// Searches both user's registered name and master list name
router.get('/graduates/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const searchTerm = q.trim();

    const result = await db.query(`
      SELECT
        u.id,
        COALESCE(
          NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
          TRIM(ml.first_name || ' ' || ml.last_name)
        ) AS name
      FROM users u
      JOIN invites i ON i.id = u.invite_id
      JOIN master_list ml ON ml.id = i.master_list_id
      JOIN batch_rep_willingness brw ON brw.user_id = u.id AND brw.willing = TRUE
      WHERE (
        LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER('%' || $1 || '%')
        OR LOWER(ml.first_name || ' ' || ml.last_name) LIKE LOWER('%' || $1 || '%')
      )
      AND NOT (LOWER(u.first_name) = 'bianca' AND LOWER(u.last_name) = 'jison')
      AND ml.section != 'Non-Graduate'
      LIMIT 10
    `, [searchTerm]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error searching graduates:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
