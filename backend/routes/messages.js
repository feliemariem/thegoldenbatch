const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

// Get all messages for admin inbox (messages where to_user_id IS NULL)
router.get('/admin-inbox', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        m.id,
        m.subject,
        m.message,
        m.is_read,
        m.created_at,
        m.parent_id,
        m.from_user_id,
        m.from_admin_id,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name,
        u.email as sender_email,
        ml.current_name as sender_current_name,
        CASE WHEN EXISTS (
          SELECT 1 FROM messages r WHERE r.parent_id = m.id
        ) THEN true ELSE false END as has_reply
      FROM messages m
      LEFT JOIN users u ON m.from_user_id = u.id
      LEFT JOIN master_list ml ON LOWER(u.email) = LOWER(ml.email)
      WHERE m.to_user_id IS NULL AND m.parent_id IS NULL
      ORDER BY m.created_at DESC
    `);

    res.json({ messages: result.rows });
  } catch (err) {
    console.error('Failed to fetch admin inbox:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get user's messages (both sent and received)
router.get('/user-inbox', authenticateToken, async (req, res) => {
  try {
    // Get messages sent TO this user (from admins/committee)
    // Only show root messages (admin-initiated conversations), not replies to user's messages
    // Replies to user's messages will show up in the thread view of sent messages
    const result = await db.query(`
      SELECT
        m.id,
        m.subject,
        m.message,
        m.is_read,
        m.created_at,
        m.parent_id,
        m.from_admin_id,
        a.first_name as sender_first_name,
        a.last_name as sender_last_name,
        'Committee' as sender_display,
        CASE WHEN EXISTS (
          SELECT 1 FROM messages r WHERE r.parent_id = m.id
        ) THEN true ELSE false END as has_reply
      FROM messages m
      LEFT JOIN admins a ON m.from_admin_id = a.id
      WHERE m.to_user_id = $1 AND m.parent_id IS NULL
      ORDER BY m.created_at DESC
    `, [req.user.id]);

    res.json({ messages: result.rows });
  } catch (err) {
    console.error('Failed to fetch user inbox:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get messages sent BY user to committee
router.get('/user-sent', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        m.id,
        m.subject,
        m.message,
        m.is_read,
        m.created_at,
        m.parent_id,
        m.from_user_id,
        CASE WHEN EXISTS (
          SELECT 1 FROM messages r WHERE r.parent_id = m.id
        ) THEN true ELSE false END as has_reply
      FROM messages m
      WHERE m.from_user_id = $1 AND m.to_user_id IS NULL AND m.parent_id IS NULL
      ORDER BY m.created_at DESC
    `, [req.user.id]);

    res.json({ messages: result.rows });
  } catch (err) {
    console.error('Failed to fetch user sent messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get full thread for a message
router.get('/thread/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // First get the root message (either the message itself or find its root)
    // Traverse up the parent chain to find the message with parent_id IS NULL
    const rootResult = await db.query(`
      WITH RECURSIVE thread AS (
        SELECT id, parent_id
        FROM messages
        WHERE id = $1
        UNION ALL
        SELECT m.id, m.parent_id
        FROM messages m
        JOIN thread t ON m.id = t.parent_id
      )
      SELECT id as root_id FROM thread WHERE parent_id IS NULL
    `, [id]);

    const rootId = rootResult.rows[0]?.root_id || id;

    // Now get all messages in the thread (root + all descendants)
    const result = await db.query(`
      WITH RECURSIVE thread AS (
        SELECT id FROM messages WHERE id = $1
        UNION ALL
        SELECT m.id FROM messages m JOIN thread t ON m.parent_id = t.id
      )
      SELECT
        m.id,
        m.subject,
        m.message,
        m.is_read,
        m.created_at,
        m.parent_id,
        m.from_user_id,
        m.from_admin_id,
        m.to_user_id,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        ml.current_name as user_current_name,
        a.first_name as admin_first_name,
        a.last_name as admin_last_name
      FROM messages m
      JOIN thread t ON m.id = t.id
      LEFT JOIN users u ON m.from_user_id = u.id
      LEFT JOIN master_list ml ON LOWER(u.email) = LOWER(ml.email)
      LEFT JOIN admins a ON m.from_admin_id = a.id
      ORDER BY m.created_at ASC
    `, [rootId]);

    res.json({ thread: result.rows, rootId });
  } catch (err) {
    console.error('Failed to fetch thread:', err);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// User sends message to committee (to_user_id = NULL)
router.post('/to-committee', authenticateToken, async (req, res) => {
  try {
    const { subject, message, parent_id } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Insert message (to_user_id = NULL means it's for admin inbox)
    const result = await db.query(`
      INSERT INTO messages (from_user_id, to_user_id, subject, message, parent_id)
      VALUES ($1, NULL, $2, $3, $4)
      RETURNING id
    `, [req.user.id, subject || null, message.trim(), parent_id || null]);

    res.status(201).json({
      success: true,
      message: 'Message sent to the committee',
      id: result.rows[0].id
    });
  } catch (err) {
    console.error('Failed to send message to committee:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Admin replies to user message
router.post('/reply', authenticateAdmin, async (req, res) => {
  try {
    const { to_user_id, subject, message, parent_id } = req.body;

    if (!to_user_id) {
      return res.status(400).json({ error: 'Recipient user ID is required' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get admin ID
    const adminResult = await db.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [req.user.email?.toLowerCase()]
    );

    if (adminResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin not found' });
    }

    const adminId = adminResult.rows[0].id;

    // Verify user exists
    const userResult = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [to_user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert reply message
    const result = await db.query(`
      INSERT INTO messages (from_admin_id, to_user_id, subject, message, parent_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [adminId, to_user_id, subject || null, message.trim(), parent_id || null]);

    res.status(201).json({
      success: true,
      message: 'Reply sent',
      id: result.rows[0].id
    });
  } catch (err) {
    console.error('Failed to send reply:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Mark message as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'UPDATE messages SET is_read = TRUE WHERE id = $1',
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to mark message as read:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Get single message with thread
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        m.id,
        m.subject,
        m.message,
        m.is_read,
        m.created_at,
        m.parent_id,
        m.from_user_id,
        m.from_admin_id,
        m.to_user_id,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        ml.current_name as user_current_name,
        a.first_name as admin_first_name,
        a.last_name as admin_last_name
      FROM messages m
      LEFT JOIN users u ON m.from_user_id = u.id
      LEFT JOIN master_list ml ON LOWER(u.email) = LOWER(ml.email)
      LEFT JOIN admins a ON m.from_admin_id = a.id
      WHERE m.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: result.rows[0] });
  } catch (err) {
    console.error('Failed to fetch message:', err);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// Create volunteer interest message (called internally)
const createVolunteerInterestMessage = async (userId, role) => {
  try {
    // Get user info
    const userResult = await db.query(`
      SELECT u.first_name, u.last_name, u.email, ml.current_name
      FROM users u
      LEFT JOIN master_list ml ON LOWER(u.email) = LOWER(ml.email)
      WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return { success: false, error: 'User not found' };
    }

    const user = userResult.rows[0];
    const userName = user.current_name || `${user.first_name} ${user.last_name}`;
    const message = `${userName} is interested in helping with ${role}`;

    // Insert message to admin inbox
    await db.query(`
      INSERT INTO messages (from_user_id, to_user_id, subject, message)
      VALUES ($1, NULL, $2, $3)
    `, [userId, `Volunteer Interest: ${role}`, message]);

    return { success: true };
  } catch (err) {
    console.error('Failed to create volunteer interest message:', err);
    return { success: false, error: err.message };
  }
};

module.exports = router;
module.exports.createVolunteerInterestMessage = createVolunteerInterestMessage;
