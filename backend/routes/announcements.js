const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');

console.log('[ROUTES] announcements.js loaded - registering /api/announcements routes');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Helper to check announce permission
const checkAnnouncePermission = async (userEmail) => {
  // Check if super admin
  const superAdminCheck = await db.query(
    'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );
  
  if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].is_super_admin) {
    return true;
  }

  // Check specific announce permission
  const adminResult = await db.query(
    'SELECT id FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );

  if (adminResult.rows.length === 0) {
    return false;
  }

  const permResult = await db.query(
    'SELECT enabled FROM permissions WHERE admin_id = $1 AND permission = $2',
    [adminResult.rows[0].id, 'announce']
  );

  return permResult.rows.length > 0 && permResult.rows[0].enabled;
};

// Send announcement
router.post('/', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkAnnouncePermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to send announcements' });
    }

    const { audience, subject, message, sendEmail } = req.body;

    // Validate audience - must be one of the allowed values
    const validAudiences = ['all', 'admins', 'going', 'maybe', 'not_going'];
    if (!audience || !validAudiences.includes(audience)) {
      console.error('Invalid audience received:', audience, 'Full body:', req.body);
      return res.status(400).json({ error: 'Invalid audience selection. Please select a valid audience.' });
    }

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    console.log('Processing announcement - audience:', audience, 'subject:', subject);

    // Get recipients based on audience
    let query;
    let recipients;

    if (audience === 'admins') {
      // Get users who are also admins (their email exists in both users and admins tables)
      query = `
        SELECT u.email, u.first_name, u.last_name
        FROM users u
        INNER JOIN admins a ON LOWER(u.email) = LOWER(a.email)
      `;
      const recipientsResult = await db.query(query);
      recipients = recipientsResult.rows;
    } else {
      query = `
        SELECT u.email, u.first_name, u.last_name
        FROM users u
        LEFT JOIN rsvps r ON u.id = r.user_id
      `;

      if (audience === 'going') {
        query += ` WHERE r.status = 'going'`;
      } else if (audience === 'maybe') {
        query += ` WHERE r.status = 'maybe'`;
      } else if (audience === 'not_going') {
        query += ` WHERE r.status = 'not_going'`;
      }
      // 'all' = no filter, gets all registered users

      const recipientsResult = await db.query(query);
      recipients = recipientsResult.rows;
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found for selected audience' });
    }

    let emailsSent = 0;
    let emailsFailed = 0;

    if (sendEmail) {
      // Send emails via SendGrid
      const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
      
      for (const recipient of recipients) {
        try {
          await sgMail.send({
            to: recipient.email,
            from: process.env.FROM_EMAIL || 'noreply@goldenbatch2003.com',
            subject: `USLS-IS 2003 [The Golden Batch]: New message in your Inbox`,
            html: `
              <div style="margin: 0; padding: 0; background: #ffffff;">
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #1a1a1a;">

                  <!-- Header -->
                  <div style="background: #0d1a14; padding: 28px; text-align: center;">
                    <div style="color: #B8960C; letter-spacing: 3px; font-weight: 700; font-size: 28px; font-family: Georgia, serif; margin-bottom: 8px;">
                      THE GOLDEN BATCH
                    </div>
                    <div style="color: #ffffff; font-size: 16px; font-family: Arial, sans-serif; margin-bottom: 6px;">
                      UNIVERSITY OF ST. LA SALLE - IS
                    </div>
                    <div style="color: #B8960C; font-size: 14px; font-family: Arial, sans-serif;">
                      25th Alumni Homecoming
                    </div>
                  </div>

                  <!-- Body -->
                  <div style="padding: 32px 28px; background: #ffffff;">
                    <p style="font-size: 18px; margin: 0 0 20px; font-family: Arial, sans-serif; color: #1a1a1a;">
                      Hi ${recipient.first_name || 'Batchmate'},
                    </p>

                    <div style="background: #fafafa; padding: 25px; border-radius: 8px; margin: 0 0 25px 0; border-left: 4px solid #B8960C;">
                      <p style="color: #1a1a1a; margin: 0 0 15px 0; font-size: 16px; font-family: Arial, sans-serif;">You have a new message in your Inbox!</p>
                      <p style="color: #666666; margin: 0; font-size: 14px; font-family: Arial, sans-serif;">Subject: <strong style="color: #006633;">${subject}</strong></p>
                    </div>

                    <!-- Button -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${siteUrl}/inbox"
                         style="
                           background: #006633;
                           color: #ffffff;
                           padding: 16px 42px;
                           font-size: 18px;
                           font-weight: 700;
                           text-decoration: none;
                           border-radius: 8px;
                           display: inline-block;
                           font-family: Arial, sans-serif;
                         ">
                        View Message
                      </a>
                    </div>

                    <p style="font-size: 14px; color: #666666; margin: 30px 0 0 0; font-family: Arial, sans-serif;">
                      — USLS-IS 2003 Organizing Committee
                    </p>
                  </div>

                  <!-- Footer -->
                  <div style="background: #0d1a14; padding: 20px; text-align: center; font-size: 14px; font-family: Arial, sans-serif;">
                    <span style="color: #B8960C;">USLS-IS 2003</span><br/>
                    <span style="color: #cccccc;">Questions? Email us at</span>
                    <a href="mailto:uslsis.batch2003@gmail.com" style="color: #B8960C; text-decoration: none;">
                      uslsis.batch2003@gmail.com
                    </a>
                  </div>

                </div>
              </div>
            `,
            text: `Hi ${recipient.first_name || 'Batchmate'},\n\nYou have a new message in your Inbox!\n\nSubject: ${subject}\n\nView it here: ${siteUrl}/inbox\n\n- The Organizing Committee\n\nUSLS-IS 2003\nQuestions? Email us at uslsis.batch2003@gmail.com`
          });
          emailsSent++;
        } catch (emailErr) {
          console.error(`Failed to send to ${recipient.email}:`, emailErr.message);
          emailsFailed++;
        }
      }
    }

    // Log the announcement
    await db.query(`
      INSERT INTO announcements (subject, message, audience, recipients_count, emails_sent, emails_failed, sent_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [subject, message, audience, recipients.length, emailsSent, emailsFailed, req.user.email]);

    res.json({
      success: true,
      message: sendEmail 
        ? `Announcement sent to ${emailsSent} recipient${emailsSent !== 1 ? 's' : ''}${emailsFailed > 0 ? ` (${emailsFailed} failed)` : ''}`
        : `Announcement logged (${recipients.length} recipients, email not sent)`,
      stats: {
        total: recipients.length,
        sent: emailsSent,
        failed: emailsFailed
      }
    });

  } catch (err) {
    console.error('Failed to send announcement:', err);
    res.status(500).json({ error: 'Failed to send announcement' });
  }
});

// Get announcement history - any authenticated admin can view
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM announcements
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json({ announcements: result.rows });
  } catch (err) {
    console.error('Failed to fetch announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Get announcements for inbox (regular users)
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    // Get user's RSVP status and check if they're an admin
    const userResult = await db.query(
      `SELECT u.id, u.email, r.status as rsvp_status
       FROM users u
       LEFT JOIN rsvps r ON u.id = r.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const rsvpStatus = user.rsvp_status || null;

    // Check if user is an admin
    const adminCheck = await db.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [user.email?.toLowerCase()]
    );
    const isAdmin = adminCheck.rows.length > 0;

    // Get announcements that apply to this user
    // 'all' audience applies to everyone
    // 'admins' audience only applies to admin users
    // specific audience only if it matches user's RSVP
    let result;
    if (isAdmin) {
      // Admins can see 'all', 'admins', and their RSVP-matched announcements
      result = await db.query(`
        SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
               ar.read_at IS NOT NULL as is_read
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
        WHERE a.audience = 'all'
           OR a.audience = 'admins'
           OR a.audience = $2
        ORDER BY a.created_at DESC
      `, [req.user.id, rsvpStatus]);
    } else {
      // Non-admins see 'all' and their RSVP-matched announcements (not 'admins')
      result = await db.query(`
        SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
               ar.read_at IS NOT NULL as is_read
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
        WHERE (a.audience = 'all' OR a.audience = $2)
           AND a.audience != 'admins'
        ORDER BY a.created_at DESC
      `, [req.user.id, rsvpStatus]);
    }

    res.json({ announcements: result.rows });
  } catch (err) {
    console.error('Failed to fetch inbox:', err);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

// Preview inbox for a specific user (super admin only)
// Only accessible to uslsis.batch2003@gmail.com
router.get('/preview-inbox/:userId', authenticateToken, async (req, res) => {
  try {
    const superAdminEmail = 'uslsis.batch2003@gmail.com';

    // Only allow super admin with specific email
    if (req.user.email?.toLowerCase() !== superAdminEmail) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { userId } = req.params;

    // Get the target user's RSVP status and check if they're an admin
    const userResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, r.status as rsvp_status
       FROM users u
       LEFT JOIN rsvps r ON u.id = r.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userResult.rows[0];
    const rsvpStatus = targetUser.rsvp_status || null;

    // Check if target user is an admin
    const adminCheck = await db.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [targetUser.email?.toLowerCase()]
    );
    const isAdmin = adminCheck.rows.length > 0;

    // Get announcements that would apply to this user
    let result;
    if (isAdmin) {
      // Admins can see 'all', 'admins', and their RSVP-matched announcements
      result = await db.query(`
        SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
               ar.read_at IS NOT NULL as is_read
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
        WHERE a.audience = 'all'
           OR a.audience = 'admins'
           OR a.audience = $2
        ORDER BY a.created_at DESC
      `, [userId, rsvpStatus]);
    } else {
      // Non-admins see 'all' and their RSVP-matched announcements (not 'admins')
      result = await db.query(`
        SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
               ar.read_at IS NOT NULL as is_read
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
        WHERE (a.audience = 'all' OR a.audience = $2)
           AND a.audience != 'admins'
        ORDER BY a.created_at DESC
      `, [userId, rsvpStatus]);
    }

    res.json({
      announcements: result.rows,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        first_name: targetUser.first_name,
        last_name: targetUser.last_name,
        rsvp_status: rsvpStatus,
        is_admin: isAdmin
      }
    });
  } catch (err) {
    console.error('Failed to preview inbox:', err);
    res.status(500).json({ error: 'Failed to preview inbox' });
  }
});

// Mark announcement as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(`
      INSERT INTO announcement_reads (announcement_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (announcement_id, user_id) DO NOTHING
    `, [id, req.user.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to mark as read:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

module.exports = router;