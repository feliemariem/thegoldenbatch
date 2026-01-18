const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper to check minutes_view permission
const checkMinutesViewPermission = async (userEmail) => {
  // Check if super admin
  const superAdminCheck = await db.query(
    'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );

  if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].is_super_admin) {
    return true;
  }

  // Check specific minutes_view permission
  const adminResult = await db.query(
    'SELECT id FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );

  if (adminResult.rows.length === 0) {
    return false;
  }

  const permResult = await db.query(
    'SELECT enabled FROM permissions WHERE admin_id = $1 AND permission = $2',
    [adminResult.rows[0].id, 'minutes_view']
  );

  return permResult.rows.length > 0 && permResult.rows[0].enabled;
};

// Helper to check minutes_edit permission
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

// Helper to get admin ID from email
const getAdminId = async (userEmail) => {
  const result = await db.query(
    'SELECT id FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
};

// GET /api/action-items/my-tasks - Get all action items assigned to logged-in admin
router.get('/my-tasks', authenticateToken, async (req, res) => {
  try {
    const adminId = await getAdminId(req.user.email);

    if (!adminId) {
      return res.status(403).json({ error: 'You must be an admin to view your tasks' });
    }

    const result = await db.query(`
      SELECT ai.*,
             m.title as meeting_title,
             m.meeting_date,
             m.id as meeting_id
      FROM action_items ai
      JOIN meeting_minutes m ON ai.meeting_id = m.id
      WHERE ai.assignee_id = $1
      ORDER BY
        ai.due_date ASC NULLS LAST,
        CASE ai.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        ai.created_at DESC
    `, [adminId]);

    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Failed to fetch my tasks:', err);
    res.status(500).json({ error: 'Failed to fetch your tasks' });
  }
});

// GET /api/action-items/meeting/:meetingId - Get all action items for a meeting
router.get('/meeting/:meetingId', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesViewPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view action items' });
    }

    const { meetingId } = req.params;

    const result = await db.query(`
      SELECT ai.*,
             a.email as assignee_email,
             COALESCE(u.first_name || ' ' || u.last_name, a.first_name || ' ' || COALESCE(a.last_name, '')) as assignee_name
      FROM action_items ai
      LEFT JOIN admins a ON ai.assignee_id = a.id
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE ai.meeting_id = $1
      ORDER BY
        CASE ai.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        ai.due_date ASC NULLS LAST,
        ai.created_at ASC
    `, [meetingId]);

    res.json({ actionItems: result.rows });
  } catch (err) {
    console.error('Failed to fetch action items:', err);
    res.status(500).json({ error: 'Failed to fetch action items' });
  }
});

// POST /api/action-items - Create new action item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to create action items' });
    }

    const { meeting_id, task, assignee_id, due_date, status, priority } = req.body;

    if (!meeting_id) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    if (!task) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    // Check meeting exists
    const meeting = await db.query('SELECT id FROM meeting_minutes WHERE id = $1', [meeting_id]);
    if (meeting.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const result = await db.query(`
      INSERT INTO action_items (meeting_id, task, assignee_id, due_date, status, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [meeting_id, task, assignee_id || null, due_date || null, status || 'not_started', priority || 'medium']);

    // Fetch the full action item with assignee info
    const fullResult = await db.query(`
      SELECT ai.*,
             a.email as assignee_email,
             COALESCE(u.first_name || ' ' || u.last_name, a.first_name || ' ' || COALESCE(a.last_name, '')) as assignee_name
      FROM action_items ai
      LEFT JOIN admins a ON ai.assignee_id = a.id
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE ai.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(fullResult.rows[0]);
  } catch (err) {
    console.error('Failed to create action item:', err);
    res.status(500).json({ error: 'Failed to create action item' });
  }
});

// PUT /api/action-items/:id - Update action item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { task, assignee_id, due_date, status, priority } = req.body;

    // Get current action item to check assignee
    const currentItem = await db.query('SELECT * FROM action_items WHERE id = $1', [id]);
    if (currentItem.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    const adminId = await getAdminId(req.user.email);
    const isAssignee = adminId && currentItem.rows[0].assignee_id === adminId;

    // Check permissions: either has minutes_edit OR is the assignee (can only update status)
    const hasEditPermission = await checkMinutesEditPermission(req.user.email);

    if (!hasEditPermission && !isAssignee) {
      return res.status(403).json({ error: 'You do not have permission to edit this action item' });
    }

    // If user is only assignee (not editor), they can only update status
    if (!hasEditPermission && isAssignee) {
      // Only update status
      const result = await db.query(`
        UPDATE action_items
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [status || currentItem.rows[0].status, id]);

      // Fetch the full action item with assignee info
      const fullResult = await db.query(`
        SELECT ai.*,
               a.email as assignee_email,
               COALESCE(u.first_name || ' ' || u.last_name, a.first_name || ' ' || COALESCE(a.last_name, '')) as assignee_name
        FROM action_items ai
        LEFT JOIN admins a ON ai.assignee_id = a.id
        LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
        WHERE ai.id = $1
      `, [id]);

      return res.json(fullResult.rows[0]);
    }

    // Full update for editors
    const result = await db.query(`
      UPDATE action_items
      SET task = $1, assignee_id = $2, due_date = $3, status = $4, priority = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      task || currentItem.rows[0].task,
      assignee_id !== undefined ? (assignee_id || null) : currentItem.rows[0].assignee_id,
      due_date !== undefined ? (due_date || null) : currentItem.rows[0].due_date,
      status || currentItem.rows[0].status,
      priority || currentItem.rows[0].priority,
      id
    ]);

    // Fetch the full action item with assignee info
    const fullResult = await db.query(`
      SELECT ai.*,
             a.email as assignee_email,
             COALESCE(u.first_name || ' ' || u.last_name, a.first_name || ' ' || COALESCE(a.last_name, '')) as assignee_name
      FROM action_items ai
      LEFT JOIN admins a ON ai.assignee_id = a.id
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE ai.id = $1
    `, [id]);

    res.json(fullResult.rows[0]);
  } catch (err) {
    console.error('Failed to update action item:', err);
    res.status(500).json({ error: 'Failed to update action item' });
  }
});

// DELETE /api/action-items/:id - Delete action item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete action items' });
    }

    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM action_items WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    res.json({ message: 'Action item deleted' });
  } catch (err) {
    console.error('Failed to delete action item:', err);
    res.status(500).json({ error: 'Failed to delete action item' });
  }
});

module.exports = router;
