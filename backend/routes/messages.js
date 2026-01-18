const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Helper to send email notification
const sendMessageNotification = async (to, senderName, subject, messagePreview, isAdminInbox = false) => {
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

  try {
    await sgMail.send({
      to,
      from: process.env.FROM_EMAIL || 'noreply@goldenbatch2003.com',
      subject: isAdminInbox
        ? `New message from ${senderName} — check Admin Dashboard`
        : `USLS-IS 2003 [The Golden Batch]: New message from Committee`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <div style="background: #1a2520; padding: 25px 30px; text-align: center;">
            <span style="color: #CFB53B; font-size: 20px; font-weight: 600; letter-spacing: 3px;">THE GOLDEN BATCH</span>
          </div>

          <div style="background: #006633; color: white; padding: 25px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700;">University of St. La Salle - IS 2003</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">25th Alumni Homecoming</p>
          </div>

          <div style="padding: 40px 30px; background: #f9f9f9;">
            <p style="color: #333; font-size: 16px; margin: 0 0 25px 0;">Hi,</p>

            <div style="background: white; padding: 25px; border-radius: 8px; margin: 0 0 25px 0; border-left: 4px solid #CFB53B; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <p style="color: #333; margin: 0 0 15px 0; font-size: 16px;">
                ${isAdminInbox ? `New message from <strong>${senderName}</strong>` : 'You have a new message from the Committee!'}
              </p>
              ${subject ? `<p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">Subject: <strong style="color: #006633;">${subject}</strong></p>` : ''}
              <p style="color: #888; margin: 0; font-size: 13px; font-style: italic;">"${messagePreview}..."</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${isAdminInbox ? `${siteUrl}/admin` : `${siteUrl}/inbox`}" style="display: inline-block; background: #006633; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                ${isAdminInbox ? 'View in Admin Dashboard' : 'View Message'}
              </a>
            </div>

            <p style="color: #666; font-size: 14px; margin: 30px 0 0 0;">
              - The Organizing Committee
            </p>
          </div>

          <div style="background: #333; color: #999; padding: 25px 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0; color: #ccc;">USLS-IS 2003</p>
            <p style="margin: 8px 0 0 0;">Questions? Email us at <a href="mailto:uslsis.batch2003@gmail.com" style="color: #CFB53B;">uslsis.batch2003@gmail.com</a></p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Email error:', error.response?.body || error);
    return { success: false, error: error.message };
  }
};

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
        ml.current_name as sender_current_name
      FROM messages m
      LEFT JOIN users u ON m.from_user_id = u.id
      LEFT JOIN master_list ml ON LOWER(u.email) = LOWER(ml.email)
      WHERE m.to_user_id IS NULL
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
        'Committee' as sender_display
      FROM messages m
      LEFT JOIN admins a ON m.from_admin_id = a.id
      WHERE m.to_user_id = $1
      ORDER BY m.created_at DESC
    `, [req.user.id]);

    res.json({ messages: result.rows });
  } catch (err) {
    console.error('Failed to fetch user inbox:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// User sends message to committee (to_user_id = NULL)
router.post('/to-committee', authenticateToken, async (req, res) => {
  try {
    const { subject, message, parent_id } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get user info for email notification
    const userResult = await db.query(`
      SELECT u.first_name, u.last_name, u.email, ml.current_name
      FROM users u
      LEFT JOIN master_list ml ON LOWER(u.email) = LOWER(ml.email)
      WHERE u.id = $1
    `, [req.user.id]);

    const user = userResult.rows[0];
    const senderName = user.current_name || `${user.first_name} ${user.last_name}`;

    // Insert message (to_user_id = NULL means it's for admin inbox)
    const result = await db.query(`
      INSERT INTO messages (from_user_id, to_user_id, subject, message, parent_id)
      VALUES ($1, NULL, $2, $3, $4)
      RETURNING id
    `, [req.user.id, subject || null, message.trim(), parent_id || null]);

    // Send email notification to committee email
    const preview = message.substring(0, 100);
    await sendMessageNotification(
      'uslsis.batch2003@gmail.com',
      senderName,
      subject,
      preview,
      true // isAdminInbox
    );

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

    // Get user info for email notification
    const userResult = await db.query(
      'SELECT email, first_name FROM users WHERE id = $1',
      [to_user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Insert reply message
    const result = await db.query(`
      INSERT INTO messages (from_admin_id, to_user_id, subject, message, parent_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [adminId, to_user_id, subject || null, message.trim(), parent_id || null]);

    // Send email notification to user
    const preview = message.substring(0, 100);
    await sendMessageNotification(
      user.email,
      'Committee',
      subject,
      preview,
      false // not admin inbox
    );

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

    // Send email notification to committee
    await sendMessageNotification(
      'uslsis.batch2003@gmail.com',
      userName,
      `Volunteer Interest: ${role}`,
      message,
      true
    );

    return { success: true };
  } catch (err) {
    console.error('Failed to create volunteer interest message:', err);
    return { success: false, error: err.message };
  }
};

module.exports = router;
module.exports.createVolunteerInterestMessage = createVolunteerInterestMessage;
