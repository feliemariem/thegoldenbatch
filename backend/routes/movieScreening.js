const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Normalize and validate Philippine mobile number
// Strips spaces, dashes, leading +63 or 63, then checks for 09XXXXXXXXX pattern
const normalizePHMobile = (mobile) => {
  if (!mobile) return null;

  // Remove spaces, dashes, parentheses
  let normalized = mobile.replace(/[\s\-()]/g, '');

  // Strip leading +63 or 63
  if (normalized.startsWith('+63')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('63') && normalized.length === 12) {
    normalized = '0' + normalized.slice(2);
  }

  // Validate: must be 11 digits starting with 09
  if (/^09\d{9}$/.test(normalized)) {
    return normalized;
  }

  return false; // Invalid
};

// Basic email format validation
const isValidEmail = (email) => {
  if (!email) return false;
  // Simple regex for basic email format
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

// ============================================
// PERMISSION HELPERS (uses admins table, same as other permissions)
// ============================================

// Check a specific screening permission for a user by email
const checkScreeningPermission = async (email, requiredPermission) => {
  const adminResult = await db.query(
    'SELECT id, is_super_admin FROM admins WHERE LOWER(email) = $1',
    [email.toLowerCase()]
  );

  if (adminResult.rows.length === 0) return false;

  const admin = adminResult.rows[0];
  if (admin.is_super_admin) return true; // Super admin bypasses all

  const permResult = await db.query(
    'SELECT enabled FROM permissions WHERE admin_id = $1 AND permission = $2',
    [admin.id, requiredPermission]
  );

  return permResult.rows.length > 0 && permResult.rows[0].enabled;
};

// Check if user can view stats (needs view + stats/tracker/edit)
const canViewStats = async (email) => {
  const hasView = await checkScreeningPermission(email, 'screenings_view');
  if (!hasView) return false;

  return await checkScreeningPermission(email, 'screenings_stats') ||
         await checkScreeningPermission(email, 'screenings_tracker') ||
         await checkScreeningPermission(email, 'screenings_edit');
};

// Check if user can view full tracker with contact info
const canViewTracker = async (email) => {
  const hasView = await checkScreeningPermission(email, 'screenings_view');
  if (!hasView) return false;

  return await checkScreeningPermission(email, 'screenings_tracker') ||
         await checkScreeningPermission(email, 'screenings_edit');
};

// Check if user can edit (confirm, cancel, assign seats, export)
const canEditTracker = async (email) => {
  const hasView = await checkScreeningPermission(email, 'screenings_view');
  if (!hasView) return false;

  return await checkScreeningPermission(email, 'screenings_edit');
};

// ============================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================

// GET /api/movie-screening/active
// Returns the active screening event with cinemas and remaining seats
router.get('/active', async (req, res) => {
  try {
    // Get the active screening event
    const eventResult = await db.query(
      `SELECT id, slug, title, subtitle, event_date, venue, gcash_number, gcash_name, status
       FROM screening_events
       WHERE status = 'active'
       LIMIT 1`
    );

    if (eventResult.rows.length === 0) {
      return res.json({ event: null, cinemas: [] });
    }

    const event = eventResult.rows[0];

    // Get cinemas with remaining seats
    const cinemasResult = await db.query(
      `SELECT
         ec.id,
         ec.code,
         ec.label,
         ec.showtime,
         ec.unit_price,
         ec.capacity,
         ec.capacity - COALESCE(
           (SELECT SUM(r.quantity)
            FROM reservations r
            WHERE r.event_id = ec.event_id
              AND r.cinema_code = ec.code
              AND r.status IN ('pending', 'confirmed')
           ), 0
         ) as seats_left
       FROM event_cinemas ec
       WHERE ec.event_id = $1
       ORDER BY ec.code ASC`,
      [event.id]
    );

    res.json({
      event,
      cinemas: cinemasResult.rows.map(c => ({
        ...c,
        unit_price: parseFloat(c.unit_price),
        seats_left: parseInt(c.seats_left)
      }))
    });
  } catch (err) {
    console.error('Error fetching active screening:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/movie-screening/reserve
// Create a new reservation (public endpoint)
router.post('/reserve', async (req, res) => {
  const { cinema_code, buyer_name, mobile, email, quantity, gcash_ref } = req.body;

  // Validation
  if (!cinema_code) {
    return res.status(400).json({ error: 'Cinema selection is required' });
  }
  if (!buyer_name || !buyer_name.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }
  if (!mobile && !email) {
    return res.status(400).json({ error: 'Please provide either a mobile number or email address' });
  }

  // Validate and normalize mobile if provided
  let normalizedMobile = null;
  if (mobile && mobile.trim()) {
    normalizedMobile = normalizePHMobile(mobile);
    if (normalizedMobile === false) {
      return res.status(400).json({ error: 'Enter a valid PH mobile, e.g. 09171234567' });
    }
  }

  // Validate email if provided
  let normalizedEmail = null;
  if (email && email.trim()) {
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    normalizedEmail = email.trim().toLowerCase();
  }

  // Ensure at least one valid contact method
  if (!normalizedMobile && !normalizedEmail) {
    return res.status(400).json({ error: 'Please provide a valid mobile number or email address' });
  }

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }
  if (!gcash_ref || !gcash_ref.trim()) {
    return res.status(400).json({ error: 'GCash reference number is required' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Get the active event
    const eventResult = await client.query(
      `SELECT id FROM screening_events WHERE status = 'active' LIMIT 1`
    );

    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active screening event found' });
    }

    const eventId = eventResult.rows[0].id;

    // Lock the cinema row and get capacity + unit price
    const cinemaResult = await client.query(
      `SELECT id, unit_price, capacity
       FROM event_cinemas
       WHERE event_id = $1 AND code = $2
       FOR UPDATE`,
      [eventId, cinema_code]
    );

    if (cinemaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid cinema selection' });
    }

    const cinema = cinemaResult.rows[0];
    const unitPrice = parseFloat(cinema.unit_price);
    const capacity = parseInt(cinema.capacity);

    // Calculate held seats (pending + confirmed)
    const heldResult = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) as held
       FROM reservations
       WHERE event_id = $1 AND cinema_code = $2 AND status IN ('pending', 'confirmed')`,
      [eventId, cinema_code]
    );

    const heldSeats = parseInt(heldResult.rows[0].held);
    const requestedQty = parseInt(quantity);

    if (heldSeats + requestedQty > capacity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough seats left' });
    }

    // Calculate total amount
    const totalAmount = unitPrice * requestedQty;

    // Insert the reservation
    const insertResult = await client.query(
      `INSERT INTO reservations (
         event_id, cinema_code, buyer_name, mobile, email,
         quantity, unit_price, total_amount, gcash_ref, status, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
       RETURNING *`,
      [
        eventId,
        cinema_code,
        buyer_name.trim(),
        normalizedMobile,
        normalizedEmail,
        requestedQty,
        unitPrice,
        totalAmount,
        gcash_ref.trim()
      ]
    );

    await client.query('COMMIT');

    const reservation = insertResult.rows[0];
    res.status(201).json({
      ...reservation,
      unit_price: parseFloat(reservation.unit_price),
      total_amount: parseFloat(reservation.total_amount)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating reservation:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ============================================
// ADMIN ENDPOINTS (auth + movie screening admin check)
// ============================================

// GET /api/movie-screening/admin/stats
// Stats-only endpoint for VIEW STATS users (no contact info)
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    // Permission check: must have screenings_view + (screenings_stats OR screenings_tracker OR screenings_edit)
    const hasAccess = await canViewStats(req.user.email);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied. Screenings stats permission required.' });
    }

    const { event_id } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'event_id is required' });
    }

    // Get stats only (no buyer details)
    const statsResult = await db.query(
      `SELECT
         COUNT(*) as total_reservations,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
         COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'confirmed'), 0) as total_collected,
         COALESCE(SUM(quantity) FILTER (WHERE status IN ('pending', 'confirmed')), 0) as total_tickets_held
       FROM reservations
       WHERE event_id = $1`,
      [event_id]
    );

    // Get cinema capacity stats
    const cinemaStatsResult = await db.query(
      `SELECT
         ec.code,
         ec.label,
         ec.capacity,
         COALESCE(
           (SELECT SUM(r.quantity)
            FROM reservations r
            WHERE r.event_id = ec.event_id
              AND r.cinema_code = ec.code
              AND r.status IN ('pending', 'confirmed')
           ), 0
         ) as held_seats
       FROM event_cinemas ec
       WHERE ec.event_id = $1
       ORDER BY ec.code ASC`,
      [event_id]
    );

    res.json({
      stats: {
        ...statsResult.rows[0],
        total_collected: parseFloat(statsResult.rows[0].total_collected),
        total_tickets_held: parseInt(statsResult.rows[0].total_tickets_held)
      },
      cinemaStats: cinemaStatsResult.rows.map(c => ({
        ...c,
        capacity: parseInt(c.capacity),
        held_seats: parseInt(c.held_seats)
      }))
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/movie-screening/admin/reservations
// List all reservations for an event (requires tracker permission - includes contact info)
router.get('/admin/reservations', authenticateToken, async (req, res) => {
  try {
    // Permission check: must have screenings_view + (screenings_tracker OR screenings_edit)
    const hasAccess = await canViewTracker(req.user.email);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied. Screenings tracker permission required.' });
    }

    const { event_id } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'event_id is required' });
    }

    // Join with admins table to get claimed_by admin name
    const result = await db.query(
      `SELECT r.*, ec.label as cinema_label, ec.showtime,
              a.first_name as claimed_by_first_name, a.last_name as claimed_by_last_name
       FROM reservations r
       JOIN event_cinemas ec ON ec.event_id = r.event_id AND ec.code = r.cinema_code
       LEFT JOIN admins a ON r.claimed_by = a.id
       WHERE r.event_id = $1
       ORDER BY r.created_at DESC`,
      [event_id]
    );

    // Get stats
    const statsResult = await db.query(
      `SELECT
         COUNT(*) as total_reservations,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
         COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'confirmed'), 0) as total_collected,
         COALESCE(SUM(quantity) FILTER (WHERE status IN ('pending', 'confirmed')), 0) as total_tickets_held
       FROM reservations
       WHERE event_id = $1`,
      [event_id]
    );

    // Get cinema capacity stats
    const cinemaStatsResult = await db.query(
      `SELECT
         ec.code,
         ec.label,
         ec.capacity,
         COALESCE(
           (SELECT SUM(r.quantity)
            FROM reservations r
            WHERE r.event_id = ec.event_id
              AND r.cinema_code = ec.code
              AND r.status IN ('pending', 'confirmed')
           ), 0
         ) as held_seats
       FROM event_cinemas ec
       WHERE ec.event_id = $1
       ORDER BY ec.code ASC`,
      [event_id]
    );

    res.json({
      reservations: result.rows.map(r => ({
        ...r,
        unit_price: parseFloat(r.unit_price),
        total_amount: parseFloat(r.total_amount),
        claimed_by_name: r.claimed_by_first_name && r.claimed_by_last_name
          ? `${r.claimed_by_first_name} ${r.claimed_by_last_name}`
          : (r.claimed_by_first_name || r.claimed_by_last_name || null)
      })),
      stats: {
        ...statsResult.rows[0],
        total_collected: parseFloat(statsResult.rows[0].total_collected),
        total_tickets_held: parseInt(statsResult.rows[0].total_tickets_held)
      },
      cinemaStats: cinemaStatsResult.rows.map(c => ({
        ...c,
        capacity: parseInt(c.capacity),
        held_seats: parseInt(c.held_seats)
      }))
    });
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/movie-screening/admin/:id/confirm
// Confirm a reservation and assign ticket numbers
router.post('/admin/:id/confirm', authenticateToken, async (req, res) => {
  // Permission check: must have screenings_view + screenings_edit
  const hasAccess = await canEditTracker(req.user.email);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied. Screenings edit permission required.' });
  }

  const { id } = req.params;
  const adminId = req.user.id;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Get the reservation
    const reservationResult = await client.query(
      `SELECT id, event_id, cinema_code, quantity, status
       FROM reservations
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = reservationResult.rows[0];

    if (reservation.status === 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reservation is already confirmed' });
    }

    if (reservation.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot confirm a cancelled reservation' });
    }

    // Get the max serial_end for this event and cinema
    const maxSerialResult = await client.query(
      `SELECT COALESCE(MAX(serial_end), 0) as max_serial
       FROM reservations
       WHERE event_id = $1 AND cinema_code = $2 AND status = 'confirmed'`,
      [reservation.event_id, reservation.cinema_code]
    );

    const serialStart = parseInt(maxSerialResult.rows[0].max_serial) + 1;
    const serialEnd = serialStart + parseInt(reservation.quantity) - 1;

    // Update the reservation
    const updateResult = await client.query(
      `UPDATE reservations
       SET status = 'confirmed',
           gcash_verified = true,
           serial_start = $1,
           serial_end = $2,
           confirmed_by = $3,
           confirmed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [serialStart, serialEnd, adminId, id]
    );

    await client.query('COMMIT');

    res.json({
      ...updateResult.rows[0],
      unit_price: parseFloat(updateResult.rows[0].unit_price),
      total_amount: parseFloat(updateResult.rows[0].total_amount)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error confirming reservation:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/movie-screening/admin/:id/cancel
// Cancel a reservation
router.post('/admin/:id/cancel', authenticateToken, async (req, res) => {
  // Permission check: must have screenings_view + screenings_edit
  const hasAccess = await canEditTracker(req.user.email);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied. Screenings edit permission required.' });
  }

  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE reservations
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json({
      ...result.rows[0],
      unit_price: parseFloat(result.rows[0].unit_price),
      total_amount: parseFloat(result.rows[0].total_amount)
    });
  } catch (err) {
    console.error('Error cancelling reservation:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/movie-screening/admin/:id/claim
// Toggle claimed status for a reservation (for physical ticket pickup tracking)
router.post('/admin/:id/claim', authenticateToken, async (req, res) => {
  // Permission check: must have screenings_view + screenings_edit
  const hasAccess = await canEditTracker(req.user.email);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied. Screenings edit permission required.' });
  }

  const { id } = req.params;

  try {
    // Get current claimed status
    const current = await db.query(
      'SELECT claimed FROM reservations WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const isClaimed = current.rows[0].claimed;

    // Get admin ID from admins table using user's email
    const adminResult = await db.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );

    const adminId = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;

    // Toggle claimed status
    const result = await db.query(
      `UPDATE reservations
       SET claimed = $1,
           claimed_by = $2,
           claimed_at = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        !isClaimed,
        !isClaimed ? adminId : null,
        !isClaimed ? new Date() : null,
        id
      ]
    );

    // Get admin name for response
    let claimed_by_name = null;
    if (!isClaimed && adminId) {
      const nameResult = await db.query(
        'SELECT first_name, last_name FROM admins WHERE id = $1',
        [adminId]
      );
      if (nameResult.rows.length > 0) {
        const { first_name, last_name } = nameResult.rows[0];
        claimed_by_name = first_name && last_name
          ? `${first_name} ${last_name}`
          : (first_name || last_name || null);
      }
    }

    res.json({
      ...result.rows[0],
      unit_price: parseFloat(result.rows[0].unit_price),
      total_amount: parseFloat(result.rows[0].total_amount),
      claimed_by_name
    });
  } catch (err) {
    console.error('Error toggling claim status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/movie-screening/admin/:id/seats
// Set chosen_seats for a reservation (for 20+ orders)
router.patch('/admin/:id/seats', authenticateToken, async (req, res) => {
  // Permission check: must have screenings_view + screenings_edit
  const hasAccess = await canEditTracker(req.user.email);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied. Screenings edit permission required.' });
  }

  const { id } = req.params;
  const { chosen_seats } = req.body;

  try {
    const result = await db.query(
      `UPDATE reservations
       SET chosen_seats = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [chosen_seats, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json({
      ...result.rows[0],
      unit_price: parseFloat(result.rows[0].unit_price),
      total_amount: parseFloat(result.rows[0].total_amount)
    });
  } catch (err) {
    console.error('Error updating seats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
