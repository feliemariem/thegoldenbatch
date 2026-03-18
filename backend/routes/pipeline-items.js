const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper to check if user is an admin
const isAdmin = async (userEmail) => {
  const result = await db.query(
    'SELECT id FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );
  return result.rows.length > 0;
};

// Helper to check minutes_edit permission (canEdit)
const checkMinutesEditPermission = async (userEmail) => {
  // Check if super admin
  const superAdminCheck = await db.query(
    'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );

  if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].is_super_admin) {
    return true;
  }

  // Check specific minutes_edit permission
  const adminResult = await db.query(
    'SELECT id FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );

  if (adminResult.rows.length === 0) {
    return false;
  }

  const permResult = await db.query(
    'SELECT enabled FROM permissions WHERE admin_id = $1 AND permission = $2',
    [adminResult.rows[0].id, 'minutes_edit']
  );

  return permResult.rows.length > 0 && permResult.rows[0].enabled;
};

// GET /api/pipeline-items - Get all pipeline items
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if admin
    const adminCheck = await isAdmin(req.user.email);
    if (!adminCheck) {
      return res.status(403).json({ error: 'Admins only' });
    }

    const result = await db.query(`
      SELECT ai.*,
             m.title as meeting_title,
             a.first_name, a.last_name,
             COALESCE(u.first_name, a.first_name) as assignee_first_name,
             COALESCE(u.last_name, a.last_name) as assignee_last_name
      FROM action_items ai
      LEFT JOIN meeting_minutes m ON ai.meeting_id = m.id
      LEFT JOIN admins a ON ai.assignee_id = a.id
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE ai.show_in_pipeline = true
      ORDER BY
        (ai.status = 'done') ASC,
        CASE WHEN ai.status = 'done' THEN ai.updated_at END DESC,
        ai.due_date ASC NULLS LAST
    `);

    res.json({ items: result.rows });
  } catch (err) {
    console.error('Failed to fetch pipeline items:', err);
    res.status(500).json({ error: 'Failed to fetch pipeline items' });
  }
});

// POST /api/pipeline-items - Create a standalone pipeline item
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check if admin
    const adminCheck = await isAdmin(req.user.email);
    if (!adminCheck) {
      return res.status(403).json({ error: 'Admins only' });
    }

    const { task, due_date, priority, assignee_id } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    const result = await db.query(`
      INSERT INTO action_items (meeting_id, task, due_date, priority, assignee_id, show_in_pipeline)
      VALUES (NULL, $1, $2, $3, $4, true)
      RETURNING *
    `, [task, due_date || null, priority || 'Medium', assignee_id || null]);

    // Fetch the full item with assignee info
    const fullResult = await db.query(`
      SELECT ai.*,
             m.title as meeting_title,
             COALESCE(u.first_name, a.first_name) as assignee_first_name,
             COALESCE(u.last_name, a.last_name) as assignee_last_name
      FROM action_items ai
      LEFT JOIN meeting_minutes m ON ai.meeting_id = m.id
      LEFT JOIN admins a ON ai.assignee_id = a.id
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE ai.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(fullResult.rows[0]);
  } catch (err) {
    console.error('Failed to create pipeline item:', err);
    res.status(500).json({ error: 'Failed to create pipeline item' });
  }
});

// PATCH /api/pipeline-items/:id/toggle-pin - Toggle show_in_pipeline
router.patch('/:id/toggle-pin', authenticateToken, async (req, res) => {
  try {
    // Check canEdit permission
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to toggle pipeline items' });
    }

    const { id } = req.params;

    const result = await db.query(`
      UPDATE action_items
      SET show_in_pipeline = NOT show_in_pipeline
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to toggle pipeline item:', err);
    res.status(500).json({ error: 'Failed to toggle pipeline item' });
  }
});

module.exports = router;
