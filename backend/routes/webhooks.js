const express = require('express');
const router = express.Router();
const db = require('../db');

// Priority order for email status (higher = more final)
const STATUS_PRIORITY = {
  'sent': 1,
  'deferred': 2,
  'delivered': 3,
  'bounced': 4,
  'failed': 5
};

// Map SendGrid events to our status
const EVENT_TO_STATUS = {
  'delivered': 'delivered',
  'bounce': 'bounced',
  'dropped': 'failed',
  'deferred': 'deferred'
};

// POST /api/webhooks/sendgrid - receives SendGrid Event Webhook payloads
router.post('/sendgrid', async (req, res) => {
  try {
    // Basic validation: request body must be an array
    if (!Array.isArray(req.body)) {
      console.error('[SendGrid Webhook] Invalid payload: not an array');
      return res.status(200).json({ error: 'Invalid payload' });
    }

    const events = req.body;

    for (const event of events) {
      const { email, event: eventType } = event;

      // Skip if no email or event type
      if (!email || !eventType) continue;

      // Map SendGrid event to our status
      const newStatus = EVENT_TO_STATUS[eventType];
      if (!newStatus) continue; // Skip events we don't track

      // Get current status
      const result = await db.query(
        'SELECT email_status FROM invites WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (result.rows.length === 0) continue; // Email not in invites

      const currentStatus = result.rows[0].email_status || 'sent';
      const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
      const newPriority = STATUS_PRIORITY[newStatus] || 0;

      // Only update if new status is "more final" than current
      if (newPriority > currentPriority) {
        await db.query(
          'UPDATE invites SET email_status = $1 WHERE LOWER(email) = LOWER($2)',
          [newStatus, email]
        );
        console.log(`[SendGrid Webhook] Updated invites ${email}: ${currentStatus} -> ${newStatus}`);
      }

      // Also update email_log table for matching recipient
      const logResult = await db.query(
        `UPDATE email_log
         SET status = $1, updated_at = NOW()
         WHERE LOWER(recipient_email) = LOWER($2)
           AND status NOT IN ('delivered', 'bounced', 'failed')
         RETURNING id`,
        [newStatus, email]
      );
      if (logResult.rows.length > 0) {
        console.log(`[SendGrid Webhook] Updated email_log ${email}: -> ${newStatus}`);
      }
    }

    // Always return 200 OK (SendGrid retries on non-2xx)
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[SendGrid Webhook] Error:', error);
    // Still return 200 to prevent SendGrid retries on our errors
    res.status(200).json({ error: 'Processing error' });
  }
});

module.exports = router;
