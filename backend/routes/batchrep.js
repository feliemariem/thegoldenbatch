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

    // Check if user has submitted for each position
    const submissionResult = await db.query(
      'SELECT position FROM batch_rep_submissions WHERE voter_id = $1',
      [userId]
    );
    const submittedPositions = submissionResult.rows.map(r => r.position);
    const hasSubmittedPos1 = submittedPositions.includes(1);
    const hasSubmittedPos2 = submittedPositions.includes(2);

    // Check if user is a grad
    const isGrad = await checkIsGrad(userId);

    // Check if user has access
    const hasAccess = await checkEmailAccess(userEmail);

    // Check user's willingness answers for both positions
    const willingnessResult = await db.query(
      'SELECT willing_batch_rep, willing_aa_rep FROM batch_rep_willingness WHERE user_id = $1',
      [userId]
    );
    let willingnessPos1 = null;
    let willingnessPos2 = null;
    if (willingnessResult.rows.length > 0) {
      willingnessPos1 = willingnessResult.rows[0].willing_batch_rep;
      willingnessPos2 = willingnessResult.rows[0].willing_aa_rep;
    }

    // Include hasSubmitted for backwards compatibility with ProfileNew.js modal
    const hasSubmitted = hasSubmittedPos1 || hasSubmittedPos2;

    res.json({
      status,
      hasSubmitted,       // backwards compat for profile modal
      hasSubmittedPos1,
      hasSubmittedPos2,
      isGrad,
      isAdmin,
      hasAccess,
      willingnessPos1,
      willingnessPos2
    });
  } catch (err) {
    console.error('Error fetching batch-rep status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/batch-rep/willingness
// Upsert willingness to serve for both positions (grad only)
router.post('/willingness', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { position1, position2, willing } = req.body;

    // Check user is a grad
    const isGrad = await checkIsGrad(userId);
    if (!isGrad) {
      return res.status(403).json({ error: 'Only graduates can submit willingness.' });
    }

    // Support both old single-willingness format and new two-position format
    if (typeof willing === 'boolean') {
      // Old format: single willingness (for backwards compatibility) - applies to batch rep position
      await db.query(
        `INSERT INTO batch_rep_willingness (user_id, willing_batch_rep, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET willing_batch_rep = $2, updated_at = NOW()`,
        [userId, willing]
      );
      return res.json({ willing });
    }

    // New format: two positions - upsert both columns in one query
    // position1 = AA Rep, position2 = Batch Rep
    await db.query(
      `INSERT INTO batch_rep_willingness (user_id, willing_aa_rep, willing_batch_rep, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         willing_aa_rep = COALESCE($2, batch_rep_willingness.willing_aa_rep),
         willing_batch_rep = COALESCE($3, batch_rep_willingness.willing_batch_rep),
         updated_at = NOW()`,
      [userId, position1, position2]
    );

    res.json({ position1, position2 });
  } catch (err) {
    console.error('Error submitting willingness:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/batch-rep/submit
// Submit or update confirmation/nomination for a position (grad only)
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { position, selection, nominee_name, nominee_master_list_id, comments, willing_to_serve } = req.body;

    // Validate position
    const positionNum = parseInt(position) || 1;
    if (positionNum !== 1 && positionNum !== 2) {
      return res.status(400).json({ error: 'Invalid position. Must be 1 or 2.' });
    }

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

    // Upsert submission (insert or update) - now with position and willing_to_serve
    await db.query(
      `INSERT INTO batch_rep_submissions (voter_id, position, selection, nominee_name, nominee_master_list_id, comments, willing_to_serve)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (voter_id, position) DO UPDATE SET
         selection = $3,
         nominee_name = $4,
         nominee_master_list_id = $5,
         comments = $6,
         willing_to_serve = COALESCE($7, batch_rep_submissions.willing_to_serve)`,
      [
        userId,
        positionNum,
        selection,
        selection === 'nominate' ? nominee_name.trim() : null,
        selection === 'nominate' ? nominee_master_list_id : null,
        comments?.trim() || null,
        typeof willing_to_serve === 'boolean' ? willing_to_serve : null
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

    // Get total unique voters (distinct voter_ids across both positions)
    const totalResult = await db.query('SELECT COUNT(DISTINCT voter_id) as total FROM batch_rep_submissions');
    const totalUniqueVoters = parseInt(totalResult.rows[0].total);

    // Get confirmations count for Position 1 (AA Rep - Bianca)
    const confirmsPos1Result = await db.query(
      "SELECT COUNT(*) as count FROM batch_rep_submissions WHERE selection = 'confirm' AND position = 1"
    );
    const confirmationsPos1 = parseInt(confirmsPos1Result.rows[0].count);

    // Get confirmations count for Position 2 (Batch Rep - Felie)
    const confirmsPos2Result = await db.query(
      "SELECT COUNT(*) as count FROM batch_rep_submissions WHERE selection = 'confirm' AND position = 2"
    );
    const confirmationsPos2 = parseInt(confirmsPos2Result.rows[0].count);

    // Total confirmations (backwards compat)
    const totalConfirmations = confirmationsPos1 + confirmationsPos2;

    // Get total responses per position for percentage calculation
    const responsesPos1Result = await db.query(
      "SELECT COUNT(*) as count FROM batch_rep_submissions WHERE position = 1"
    );
    const totalResponsesPos1 = parseInt(responsesPos1Result.rows[0].count);

    const responsesPos2Result = await db.query(
      "SELECT COUNT(*) as count FROM batch_rep_submissions WHERE position = 2"
    );
    const totalResponsesPos2 = parseInt(responsesPos2Result.rows[0].count);

    // Calculate confirmation percentages per position
    const confirmationPos1Pct = totalResponsesPos1 > 0
      ? Math.round((confirmationsPos1 / totalResponsesPos1) * 100 * 10) / 10
      : 0;
    const confirmationPos2Pct = totalResponsesPos2 > 0
      ? Math.round((confirmationsPos2 / totalResponsesPos2) * 100 * 10) / 10
      : 0;

    // Get nominations count
    const totalNominations = (totalResponsesPos1 - confirmationsPos1) + (totalResponsesPos2 - confirmationsPos2);

    // Get nominees with willingness status, registration, city, country, and comments
    const nomineesResult = await db.query(`
      SELECT
        brs.nominee_name,
        brs.nominee_master_list_id,
        brs.position,
        COUNT(*) as count,
        array_agg(brs.comments) FILTER (WHERE brs.comments IS NOT NULL) as comments,
        CASE
          WHEN brs.position = 1 THEN brw.willing_aa_rep
          WHEN brs.position = 2 THEN brw.willing_batch_rep
          ELSE NULL
        END as willing,
        CASE WHEN u.id IS NOT NULL THEN true ELSE false END as registered,
        u.city,
        u.country
      FROM batch_rep_submissions brs
      LEFT JOIN master_list ml ON ml.id = brs.nominee_master_list_id
      LEFT JOIN invites i ON i.master_list_id = ml.id
      LEFT JOIN users u ON u.invite_id = i.id
      LEFT JOIN batch_rep_willingness brw ON brw.user_id = u.id
      WHERE brs.selection = 'nominate' AND brs.nominee_name IS NOT NULL
      GROUP BY brs.nominee_name, brs.nominee_master_list_id, brs.position, brw.willing_aa_rep, brw.willing_batch_rep, u.id, u.city, u.country
      ORDER BY brs.position ASC, count DESC
    `);

    const nominees = nomineesResult.rows.map(row => {
      const positionTotal = row.position === 1 ? totalResponsesPos1 : totalResponsesPos2;
      return {
        name: row.nominee_name,
        masterListId: row.nominee_master_list_id,
        position: row.position || 1,
        count: parseInt(row.count),
        pct: positionTotal > 0
          ? Math.round((parseInt(row.count) / positionTotal) * 100 * 10) / 10
          : 0,
        willing: row.willing,
        registered: row.registered,
        city: row.city,
        country: row.country,
        comments: row.comments || []
      };
    });

    // Get willingness stats per position
    const willingnessResult = await db.query(`
      SELECT
        COUNT(*) as total_respondents,
        COUNT(*) FILTER (WHERE willing_aa_rep = true) as aa_rep_yes,
        COUNT(*) FILTER (WHERE willing_aa_rep = false) as aa_rep_no,
        COUNT(*) FILTER (WHERE willing_batch_rep = true) as batch_rep_yes,
        COUNT(*) FILTER (WHERE willing_batch_rep = false) as batch_rep_no
      FROM batch_rep_willingness
    `);

    const willingnessTotal = parseInt(willingnessResult.rows[0].total_respondents);
    const willingnessPos1Yes = parseInt(willingnessResult.rows[0].aa_rep_yes);
    const willingnessPos1No = parseInt(willingnessResult.rows[0].aa_rep_no);
    const willingnessPos2Yes = parseInt(willingnessResult.rows[0].batch_rep_yes);
    const willingnessPos2No = parseInt(willingnessResult.rows[0].batch_rep_no);

    // Total willing (at least one yes)
    const willingnessYes = willingnessPos1Yes + willingnessPos2Yes;
    const willingnessNo = willingnessPos1No + willingnessPos2No;

    res.json({
      totalUniqueVoters,
      totalResponses: totalUniqueVoters, // backwards compat
      totalConfirmations,
      totalNominations,
      confirmationsPos1,
      confirmationsPos2,
      confirmationPos1Pct,
      confirmationPos2Pct,
      totalResponsesPos1,
      totalResponsesPos2,
      nominees,
      willingnessTotal,
      willingnessYes,
      willingnessNo,
      willingnessPos1Yes,
      willingnessPos1No,
      willingnessPos2Yes,
      willingnessPos2No,
      willingnessYesPct: willingnessTotal > 0
        ? Math.round((willingnessYes / (willingnessTotal * 2)) * 100 * 10) / 10
        : 0,
      willingnessNoPct: willingnessTotal > 0
        ? Math.round((willingnessNo / (willingnessTotal * 2)) * 100 * 10) / 10
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
// Typeahead search for graduates only (for nomination field)
// Fuzzy partial name match - each token must appear somewhere in the name
// Excludes committee nominees based on position parameter
router.get('/graduates/search', authenticateToken, async (req, res) => {
  try {
    const { q, position } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    // Split search term into tokens for fuzzy matching
    const tokens = q.trim().toLowerCase().split(/\s+/);

    // Build conditions: each token must appear in the combined name string
    const conditions = tokens.map((_, i) =>
      `LOWER(COALESCE(ml.current_name, '') || ' ' || ml.first_name || ' ' || ml.last_name) LIKE $${i + 1}`
    );
    const values = tokens.map(t => `%${t}%`);

    // Exclude committee nominees based on position using users.id
    let excludeCondition = '';
    if (position === '1') {
      excludeCondition = `AND (u.id IS NULL OR u.id != 85)`;  // Exclude Bianca (AA Rep nominee)
    } else if (position === '2') {
      excludeCondition = `AND (u.id IS NULL OR u.id != 71)`;  // Exclude Felie (Batch Rep nominee)
    }

    const result = await db.query(`
      SELECT
        ml.id,
        COALESCE(
          NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
          NULLIF(ml.current_name, ''),
          TRIM(ml.first_name || ' ' || ml.last_name)
        ) AS display_name,
        ml.section,
        (u.id IS NOT NULL) AS is_registered
      FROM master_list ml
      LEFT JOIN invites i ON i.master_list_id = ml.id
      LEFT JOIN users u ON u.invite_id = i.id
      WHERE ml.section != 'Non-Graduate'
        AND ml.in_memoriam = FALSE
        AND (ml.is_unreachable IS NULL OR ml.is_unreachable = FALSE)
        AND (${conditions.join(' AND ')})
        ${excludeCondition}
      ORDER BY display_name
      LIMIT 10
    `, values);

    res.json(result.rows);
  } catch (err) {
    console.error('Error searching graduates:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
