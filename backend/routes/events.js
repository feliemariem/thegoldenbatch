const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');

// Get all published events with RSVP counts and attendee names
router.get('/', authenticateToken, async (req, res) => {
  try {
    const eventsResult = await db.query(`
      SELECT 
        e.*,
        a.first_name as creator_first_name,
        a.last_name as creator_last_name
      FROM events e
      LEFT JOIN admins a ON e.created_by = a.id
      WHERE e.is_published = true
      ORDER BY e.event_date ASC
    `);

    const events = [];

    for (const event of eventsResult.rows) {
      // Get RSVP counts
      const countsResult = await db.query(`
        SELECT 
          COUNT(CASE WHEN status = 'going' THEN 1 END) as going_count,
          COUNT(CASE WHEN status = 'interested' THEN 1 END) as interested_count,
          COUNT(CASE WHEN status = 'not_going' THEN 1 END) as not_going_count
        FROM event_rsvps
        WHERE event_id = $1
      `, [event.id]);

      // Get attendees (going and interested)
      const attendeesResult = await db.query(`
        SELECT 
          er.status,
          u.id as user_id,
          u.first_name,
          u.last_name,
          u.profile_photo
        FROM event_rsvps er
        JOIN users u ON er.user_id = u.id
        WHERE er.event_id = $1 AND er.status IN ('going', 'interested')
        ORDER BY er.created_at ASC
      `, [event.id]);

      // Get current user's RSVP
      const userRsvpResult = await db.query(`
        SELECT status FROM event_rsvps
        WHERE event_id = $1 AND user_id = (
          SELECT id FROM users WHERE LOWER(email) = $2
        )
      `, [event.id, req.user.email.toLowerCase()]);

      events.push({
        ...event,
        going_count: parseInt(countsResult.rows[0].going_count) || 0,
        interested_count: parseInt(countsResult.rows[0].interested_count) || 0,
        not_going_count: parseInt(countsResult.rows[0].not_going_count) || 0,
        attendees: attendeesResult.rows,
        user_rsvp: userRsvpResult.rows[0]?.status || null
      });
    }

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's event RSVPs (for profile page)
router.get('/my-rsvps', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.id,
        e.title,
        e.event_date,
        e.event_time,
        e.location,
        e.type,
        e.is_main_event,
        er.status
      FROM event_rsvps er
      JOIN events e ON er.event_id = e.id
      JOIN users u ON er.user_id = u.id
      WHERE LOWER(u.email) = $1 
        AND er.status IN ('going', 'interested')
        AND e.is_published = true
        AND e.event_date >= CURRENT_DATE
      ORDER BY e.event_date ASC
    `, [req.user.email.toLowerCase()]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// RSVP to an event
router.post('/:id/rsvp', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['going', 'interested', 'not_going'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get user ID
    const userResult = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    // Upsert RSVP
    const result = await db.query(`
      INSERT INTO event_rsvps (event_id, user_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, user_id)
      DO UPDATE SET status = $3, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [id, userId, status]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove RSVP from an event
router.delete('/:id/rsvp', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get user ID
    const userResult = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    await db.query(
      'DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ message: 'RSVP removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

// Get all events (including unpublished) - Admin only
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        a.first_name as creator_first_name,
        a.last_name as creator_last_name,
        (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND status = 'going') as going_count,
        (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id AND status = 'interested') as interested_count
      FROM events e
      LEFT JOIN admins a ON e.created_by = a.id
      ORDER BY e.event_date ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create event - Admin only
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, event_date, event_time, location, type, is_main_event, is_published, send_announcement } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Get admin ID and name
    const adminResult = await db.query(
      'SELECT id, first_name, last_name FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );

    const admin = adminResult.rows[0];
    const adminId = admin?.id || null;
    const adminName = admin ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim() : 'Admin';

    const result = await db.query(`
      INSERT INTO events (title, description, event_date, event_time, location, type, is_main_event, is_published, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      title,
      description || null,
      event_date,
      event_time || null,
      location || null,
      type || 'in-person',
      is_main_event || false,
      is_published !== false,
      adminId
    ]);

    const event = result.rows[0];

    // Send announcement if requested
    if (send_announcement && is_published !== false) {
      try {
        // Format date for announcement
        const eventDateFormatted = new Date(event_date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });

        // Build announcement message
        let message = `${title}\n\n`;
        message += `📅 ${eventDateFormatted}`;
        if (event_time) message += ` • ${event_time}`;
        message += '\n';
        if (location) message += `📍 ${location}\n`;
        if (description) message += `\n${description}\n`;
        message += '\nCheck it out and let us know if you\'re going!\n\n';
        message += '👉 View Event: ' + (process.env.FRONTEND_URL || 'https://the-golden-batch.onrender.com') + '/events';

        // Get all registered users
        const usersResult = await db.query('SELECT id, email, first_name FROM users');
        const users = usersResult.rows;

        // Create announcement record
        const announcementResult = await db.query(`
          INSERT INTO announcements (subject, message, audience, recipients_count, sent_by)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          `🎉 New Event: ${title}`,
          message,
          'all',
          users.length,
          adminName
        ]);

        // Send emails via SendGrid if available
        if (process.env.SENDGRID_API_KEY && users.length > 0) {
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(process.env.SENDGRID_API_KEY);

          const emailPromises = users.map(user => {
            const htmlContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #006633 0%, #004d26 100%); padding: 20px; text-align: center;">
                  <h1 style="color: #CFB53B; margin: 0;">THE GOLDEN BATCH</h1>
                  <p style="color: #ffffff; margin: 5px 0 0 0;">25th Alumni Homecoming</p>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                  <h2 style="color: #006633; margin-top: 0;">🎉 New Event: ${title}</h2>
                  <p style="font-size: 16px; color: #333;"><strong>${title}</strong></p>
                  <p style="font-size: 14px; color: #555;">
                    📅 ${eventDateFormatted}${event_time ? ` • ${event_time}` : ''}
                  </p>
                  ${location ? `<p style="font-size: 14px; color: #555;">📍 ${location}</p>` : ''}
                  ${description ? `<p style="font-size: 14px; color: #555;">${description}</p>` : ''}
                  <p style="font-size: 14px; color: #CFB53B; font-style: italic; margin-top: 20px;">
                    Check it out and let us know if you're going!
                  </p>
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.FRONTEND_URL || 'https://the-golden-batch.onrender.com'}/events" 
                       style="background: #CFB53B; color: #1a1a2e; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                      View Event
                    </a>
                  </div>
                </div>
                <div style="padding: 20px; text-align: center; color: #888; font-size: 12px;">
                  <p>USLS-IS Batch 2003 - The Golden Batch</p>
                </div>
              </div>
            `;

            return sgMail.send({
              to: user.email,
              from: process.env.SENDGRID_FROM_EMAIL || 'noreply@thegoldenbatch.com',
              subject: `🎉 New Event: ${title}`,
              html: htmlContent
            }).catch(err => {
              console.error(`Failed to send to ${user.email}:`, err.message);
              return null;
            });
          });

          const results = await Promise.all(emailPromises);
          const successCount = results.filter(r => r !== null).length;

          // Update announcement with email stats
          await db.query(
            'UPDATE announcements SET emails_sent = $1, emails_failed = $2 WHERE id = $3',
            [successCount, users.length - successCount, announcementResult.rows[0].id]
          );
        }
      } catch (announcementErr) {
        console.error('Failed to send announcement:', announcementErr);
        // Don't fail the event creation if announcement fails
      }
    }

    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update event - Admin only
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, event_date, event_time, location, type, is_main_event, is_published } = req.body;

    const result = await db.query(`
      UPDATE events SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        event_date = COALESCE($3, event_date),
        event_time = COALESCE($4, event_time),
        location = COALESCE($5, location),
        type = COALESCE($6, type),
        is_main_event = COALESCE($7, is_main_event),
        is_published = COALESCE($8, is_published),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [title, description, event_date, event_time, location, type, is_main_event, is_published, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete event - Admin only
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM events WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;