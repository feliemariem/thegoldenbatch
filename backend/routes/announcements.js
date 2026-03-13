const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');

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

    const { audience, subject, message, sendEmail, template, testMode, testEmail } = req.body;

    // Debug: log incoming request
    console.log('📩 Announcement request:', {
      audience,
      subject: subject?.substring(0, 30),
      sendEmail,
      template: template || 'standard',
      testMode,
      testEmail
    });

    // Validate audience - must be one of the allowed values
    const validAudiences = ['all', 'full_admins', 'registry_admins', 'graduates', 'going', 'maybe', 'not_going'];
    if (!audience || !validAudiences.includes(audience)) {
      console.error('Invalid audience received:', audience, 'Full body:', req.body);
      return res.status(400).json({ error: 'Invalid audience selection. Please select a valid audience.' });
    }

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    // Test mode validation (super admin only - id=1)
    const isSuperAdmin = req.user.id === 1;
    if (testMode && !isSuperAdmin) {
      return res.status(403).json({ error: 'Test mode is only available for super admins' });
    }

    // Test mode: validate testEmail and force sendEmail to true
    let actualSendEmail = sendEmail;
    if (testMode) {
      // Validate testEmail is provided and is a valid email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!testEmail || !emailRegex.test(testEmail)) {
        return res.status(400).json({ error: 'A valid test email address is required for test mode' });
      }
      // Always send email in test mode
      actualSendEmail = true;
    }

    // Get recipients based on audience
    let query;
    let recipients;

    if (audience === 'full_admins') {
      // Get users who are full admins (have non-registry permissions)
      query = `
        SELECT DISTINCT u.email, u.first_name, u.last_name
        FROM users u
        INNER JOIN admins a ON LOWER(u.email) = LOWER(a.email)
        INNER JOIN permissions p ON p.admin_id = a.id
        WHERE p.enabled = true
          AND p.permission NOT LIKE 'invites_%'
          AND p.permission NOT LIKE 'registered_%'
          AND p.permission NOT LIKE 'masterlist_%'
      `;
      const recipientsResult = await db.query(query);
      recipients = recipientsResult.rows;
    } else if (audience === 'registry_admins') {
      // Get users who are registry admins (no non-registry permissions)
      query = `
        SELECT DISTINCT u.email, u.first_name, u.last_name
        FROM users u
        INNER JOIN admins a ON LOWER(u.email) = LOWER(a.email)
        WHERE NOT EXISTS (
          SELECT 1 FROM permissions p
          WHERE p.admin_id = a.id
            AND p.enabled = true
            AND p.permission NOT LIKE 'invites_%'
            AND p.permission NOT LIKE 'registered_%'
            AND p.permission NOT LIKE 'masterlist_%'
        )
      `;
      const recipientsResult = await db.query(query);
      recipients = recipientsResult.rows;
    } else if (audience === 'graduates') {
      // Get registered graduates only
      query = `
        SELECT u.email, u.first_name, u.last_name
        FROM users u
        JOIN invites i ON i.id = u.invite_id
        JOIN master_list m ON m.id = i.master_list_id
        WHERE m.section != 'Non-Graduate'
          AND (m.in_memoriam IS NULL OR m.in_memoriam = false)
          AND (m.is_unreachable IS NULL OR m.is_unreachable = false)
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

    if (recipients.length === 0 && !testMode) {
      return res.status(400).json({ error: 'No recipients found for selected audience' });
    }

    // In test mode, override recipients with just the test email
    const actualRecipients = testMode
      ? [{ email: testEmail, first_name: 'Test' }]
      : recipients;

    let emailsSent = 0;
    let emailsFailed = 0;

    if (actualSendEmail) {
      // Send emails via SendGrid
      const siteUrl = process.env.SITE_URL || 'https://the-golden-batch.onrender.com';

      // Batch rep deadline (hardcoded - can be fetched from DB later)
      const batchRepDeadline = new Date('2026-03-21T23:59:00+08:00');
      const daysRemaining = Math.max(0, Math.ceil((batchRepDeadline - new Date()) / (1000 * 60 * 60 * 24)));
      const deadlineFormatted = batchRepDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      for (const recipient of actualRecipients) {
        try {
          let emailHtml, emailText, emailSubject;

          if (template === 'batchrep') {
            // Batch Rep Notification template
            emailSubject = 'The batch needs to hear from you';
            emailHtml = `
              <div style="margin: 0; padding: 0; background: #ffffff;">
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #1a1a1a;">

                  <!-- Header -->
                  <div style="background: #0d1a14; padding: 28px; text-align: center;">
                    <img src="${siteUrl}/images/lasalle.jpg" alt="The Golden Batch Logo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px;" />
                    <div style="color: #CFB53B; letter-spacing: 3px; font-weight: 700; font-size: 28px; font-family: Georgia, 'Times New Roman', serif; margin-bottom: 8px;">
                      THE GOLDEN BATCH 2003
                    </div>
                    <div style="color: #ffffff; font-size: 16px; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 2px; margin-bottom: 6px;">
                      UNIVERSITY OF ST. LA SALLE - IS
                    </div>
                    <div style="color: #CFB53B; font-size: 14px; font-family: Arial, sans-serif;">
                      25th Alumni Homecoming
                    </div>
                  </div>

                  <!-- Body -->
                  <div style="padding: 32px 28px; background: #ffffff;">
                    <p style="font-size: 18px; margin: 0 0 20px; font-family: Arial, sans-serif; color: #1a1a1a;">
                      Hi ${recipient.first_name || 'Batchmate'},
                    </p>

                    <p style="font-size: 15px; color: #444444; line-height: 1.6; margin: 0 0 20px 0;">
                      The organizing committee has been working behind the scenes to lay the groundwork. Now it's time for the batch to choose who will represent Batch 2003 for <strong>two official positions</strong>.
                    </p>

                    <!-- Nominee 1 -->
                    <div style="display: flex; align-items: center; background: #f0f9f4; border: 1px solid #c8e6d4; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;">
                      <img src="${siteUrl}/images/logo.png" alt="Nominee" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 12px;" />
                      <div>
                        <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #006633; margin-bottom: 2px;">Nominee · Alumni Assoc. Representative</div>
                        <div style="font-size: 15px; font-weight: 700; color: #1a1a1a;">Bianca Jison</div>
                      </div>
                    </div>

                    <!-- Nominee 2 -->
                    <div style="display: flex; align-items: center; background: #f0f9f4; border: 1px solid #c8e6d4; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
                      <img src="${siteUrl}/images/logo.png" alt="Nominee" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 12px;" />
                      <div>
                        <div style="font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #006633; margin-bottom: 2px;">Nominee · Batch Representative</div>
                        <div style="font-size: 15px; font-weight: 700; color: #1a1a1a;">Felie Magbanua</div>
                      </div>
                    </div>

                    <!-- Deadline -->
                    <p style="font-size: 13px; color: #666666; margin: 0 0 20px 0;">
                      ⏱ Feedback window closes <strong style="color: #c0392b;">${deadlineFormatted} at 11:59 PM PHT</strong>
                      <span style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 700; color: #856404; margin-left: 6px;">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left</span>
                    </p>

                    <!-- Button -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${siteUrl}/login?redirect=/profile&batchrep=1"
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
                        Submit My Response →
                      </a>
                    </div>

                    <p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">
                      You'll be asked to log in. The voting modal will open automatically.
                    </p>
                  </div>

                  <!-- Footer -->
                  <div style="background: #0d1a14; padding: 20px; text-align: center; font-size: 14px; font-family: Arial, sans-serif;">
                    <span style="color: #CFB53B;">© USLS-IS Golden Batch 2003</span><br/>
                    <span style="color: #ffffff;">Questions? Email us at</span>
                    <a href="mailto:uslsis.batch2003@gmail.com" style="color: #CFB53B; text-decoration: none;">
                      uslsis.batch2003@gmail.com
                    </a>
                  </div>

                </div>
              </div>
            `;
            emailText = `Hi ${recipient.first_name || 'Batchmate'},\n\nThe organizing committee has been working behind the scenes. Now it's time for the batch to choose who will represent Batch 2003 for two official positions.\n\nNominees:\n- Bianca Jison (Alumni Assoc. Representative)\n- Felie Magbanua (Batch Representative)\n\nFeedback window closes ${deadlineFormatted} at 11:59 PM PHT (${daysRemaining} days left)\n\nSubmit your response: ${siteUrl}/login?redirect=/profile&batchrep=1\n\n- The Organizing Committee\n\nUSLS-IS 2003\nQuestions? Email us at uslsis.batch2003@gmail.com`;
          } else {
            // Standard announcement template
            emailSubject = 'New message in your Inbox';
            emailHtml = `
              <div style="margin: 0; padding: 0; background: #ffffff;">
                <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #1a1a1a;">

                  <!-- Header -->
                  <div style="background: #0d1a14; padding: 28px; text-align: center;">
                    <img src="${siteUrl}/images/lasalle.jpg" alt="The Golden Batch Logo" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px;" />
                    <div style="color: #CFB53B; letter-spacing: 3px; font-weight: 700; font-size: 28px; font-family: Georgia, 'Times New Roman', serif; margin-bottom: 8px;">
                      THE GOLDEN BATCH 2003
                    </div>
                    <div style="color: #ffffff; font-size: 16px; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 2px; margin-bottom: 6px;">
                      UNIVERSITY OF ST. LA SALLE - IS
                    </div>
                    <div style="color: #CFB53B; font-size: 14px; font-family: Arial, sans-serif;">
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
                    <span style="color: #CFB53B;">© USLS-IS Golden Batch 2003</span><br/>
                    <span style="color: #ffffff;">Questions? Email us at</span>
                    <a href="mailto:uslsis.batch2003@gmail.com" style="color: #CFB53B; text-decoration: none;">
                      uslsis.batch2003@gmail.com
                    </a>
                  </div>

                </div>
              </div>
            `;
            emailText = `Hi ${recipient.first_name || 'Batchmate'},\n\nYou have a new message in your Inbox!\n\nSubject: ${subject}\n\nView it here: ${siteUrl}/inbox\n\n- The Organizing Committee\n\nUSLS-IS 2003\nQuestions? Email us at uslsis.batch2003@gmail.com`;
          }

          // Debug: confirm SendGrid call is reached
          console.log('📧 SendGrid send attempt:', {
            testMode,
            testEmail,
            template: template || 'standard',
            recipientEmail: recipient.email,
            subject: emailSubject
          });

          await sgMail.send({
            to: recipient.email,
            from: process.env.FROM_EMAIL || 'noreply@goldenbatch2003.com',
            subject: emailSubject,
            html: emailHtml,
            text: emailText
          });

          // Log to email_log table
          await db.query(
            `INSERT INTO email_log (recipient_email, recipient_name, subject, email_type, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [recipient.email, recipient.first_name || null, emailSubject, template === 'batchrep' ? 'batchrep' : 'announcement', 'sent']
          );

          emailsSent++;
        } catch (emailErr) {
          console.error(`Failed to send to ${recipient.email}:`, emailErr.message);
          emailsFailed++;
        }
      }
    }

    // Log the announcement (skip for test mode)
    if (!testMode) {
      await db.query(`
        INSERT INTO announcements (subject, message, audience, recipients_count, emails_sent, emails_failed, sent_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [subject, message, audience, recipients.length, emailsSent, emailsFailed, req.user.email]);
    }

    res.json({
      success: true,
      message: testMode
        ? `Test email sent to ${testEmail}`
        : actualSendEmail
          ? `Announcement sent to ${emailsSent} recipient${emailsSent !== 1 ? 's' : ''}${emailsFailed > 0 ? ` (${emailsFailed} failed)` : ''}`
          : `Announcement logged (${recipients.length} recipients, email not sent)`,
      stats: {
        total: testMode ? 1 : recipients.length,
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
    // 'full_admins'/'registry_admins' audience only applies to matching admin users
    // specific audience only if it matches user's RSVP
    let result;
    if (isAdmin) {
      // Check if user is a full admin or registry admin
      const adminData = adminCheck.rows[0];
      const nonRegistryCheck = await db.query(`
        SELECT 1 FROM permissions p
        WHERE p.admin_id = $1
          AND p.enabled = true
          AND p.permission NOT LIKE 'invites_%'
          AND p.permission NOT LIKE 'registered_%'
          AND p.permission NOT LIKE 'masterlist_%'
        LIMIT 1
      `, [adminData.id]);
      const isFullAdmin = nonRegistryCheck.rows.length > 0;

      if (isFullAdmin) {
        // Full admins see 'all', 'full_admins', and their RSVP-matched announcements
        result = await db.query(`
          SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
                 ar.read_at IS NOT NULL as is_read
          FROM announcements a
          LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
          WHERE a.audience = 'all'
             OR a.audience = 'full_admins'
             OR a.audience = $2
          ORDER BY a.created_at DESC
        `, [req.user.id, rsvpStatus]);
      } else {
        // Registry admins see 'all', 'registry_admins', and their RSVP-matched announcements
        result = await db.query(`
          SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
                 ar.read_at IS NOT NULL as is_read
          FROM announcements a
          LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
          WHERE a.audience = 'all'
             OR a.audience = 'registry_admins'
             OR a.audience = $2
          ORDER BY a.created_at DESC
        `, [req.user.id, rsvpStatus]);
      }
    } else {
      // Non-admins see 'all' and their RSVP-matched announcements (not admin-only)
      result = await db.query(`
        SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
               ar.read_at IS NOT NULL as is_read
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
        WHERE (a.audience = 'all' OR a.audience = $2)
           AND a.audience NOT IN ('full_admins', 'registry_admins')
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
      // Check if user is a full admin or registry admin
      const adminData = adminCheck.rows[0];
      const nonRegistryCheck = await db.query(`
        SELECT 1 FROM permissions p
        WHERE p.admin_id = $1
          AND p.enabled = true
          AND p.permission NOT LIKE 'invites_%'
          AND p.permission NOT LIKE 'registered_%'
          AND p.permission NOT LIKE 'masterlist_%'
        LIMIT 1
      `, [adminData.id]);
      const isFullAdmin = nonRegistryCheck.rows.length > 0;

      if (isFullAdmin) {
        // Full admins see 'all', 'full_admins', and their RSVP-matched announcements
        result = await db.query(`
          SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
                 ar.read_at IS NOT NULL as is_read
          FROM announcements a
          LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
          WHERE a.audience = 'all'
             OR a.audience = 'full_admins'
             OR a.audience = $2
          ORDER BY a.created_at DESC
        `, [userId, rsvpStatus]);
      } else {
        // Registry admins see 'all', 'registry_admins', and their RSVP-matched announcements
        result = await db.query(`
          SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
                 ar.read_at IS NOT NULL as is_read
          FROM announcements a
          LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
          WHERE a.audience = 'all'
             OR a.audience = 'registry_admins'
             OR a.audience = $2
          ORDER BY a.created_at DESC
        `, [userId, rsvpStatus]);
      }
    } else {
      // Non-admins see 'all' and their RSVP-matched announcements (not admin-only)
      result = await db.query(`
        SELECT a.id, a.subject, a.message, a.audience, a.created_at, a.sent_by,
               ar.read_at IS NOT NULL as is_read
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id AND ar.user_id = $1
        WHERE (a.audience = 'all' OR a.audience = $2)
           AND a.audience NOT IN ('full_admins', 'registry_admins')
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

// Get email log (deferred/failed emails in last 7 days) - super admin only (id=1)
router.get('/email-log', authenticateToken, async (req, res) => {
  console.log('[EmailLog] GET /email-log called by user:', req.user?.id, req.user?.email);
  try {
    // Only allow super admin (id=1)
    if (req.user.id !== 1) {
      console.log('[EmailLog] Access denied - user id:', req.user.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('[EmailLog] Querying email_log table...');
    const result = await db.query(`
      SELECT id, recipient_email, recipient_name, subject, email_type, status, created_at, updated_at
      FROM email_log
      WHERE status IN ('deferred', 'failed')
        AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
    `);

    console.log('[EmailLog] Query successful, rows:', result.rows.length);
    res.json({ emails: result.rows });
  } catch (err) {
    console.error('[EmailLog] Error fetching email log:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to fetch email log', detail: err.message });
  }
});

// Get email log count (for badge) - super admin only (id=1)
router.get('/email-log/count', authenticateToken, async (req, res) => {
  console.log('[EmailLog] GET /email-log/count called by user:', req.user?.id);
  try {
    // Only allow super admin (id=1)
    if (req.user.id !== 1) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM email_log
      WHERE status IN ('deferred', 'failed')
        AND created_at >= NOW() - INTERVAL '7 days'
    `);

    console.log('[EmailLog] Count result:', result.rows[0].count);
    res.json({ count: parseInt(result.rows[0].count) || 0 });
  } catch (err) {
    console.error('[EmailLog] Error fetching email log count:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ error: 'Failed to fetch email log count', detail: err.message });
  }
});

module.exports = router;