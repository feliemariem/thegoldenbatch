const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Movie screening admin IDs (Felie and Coycoy)
const MOVIE_SCREENING_ADMIN_IDS = [75, 53];

// Middleware to check if user is a movie screening admin
const requireMovieScreeningAdmin = (req, res, next) => {
  if (!MOVIE_SCREENING_ADMIN_IDS.includes(req.user.id)) {
    return res.status(403).json({ error: 'Access denied. Movie screening admin required.' });
  }
  next();
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
        mobile ? mobile.trim() : null,
        email ? email.trim().toLowerCase() : null,
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

// GET /api/movie-screening/admin/reservations
// List all reservations for an event
router.get('/admin/reservations', authenticateToken, requireMovieScreeningAdmin, async (req, res) => {
  try {
    const { event_id } = req.query;

    if (!event_id) {
      return res.status(400).json({ error: 'event_id is required' });
    }

    const result = await db.query(
      `SELECT r.*, ec.label as cinema_label, ec.showtime
       FROM reservations r
       JOIN event_cinemas ec ON ec.event_id = r.event_id AND ec.code = r.cinema_code
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
        total_amount: parseFloat(r.total_amount)
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
router.post('/admin/:id/confirm', authenticateToken, requireMovieScreeningAdmin, async (req, res) => {
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
router.post('/admin/:id/cancel', authenticateToken, requireMovieScreeningAdmin, async (req, res) => {
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

// PATCH /api/movie-screening/admin/:id/seats
// Set chosen_seats for a reservation (for 20+ orders)
router.patch('/admin/:id/seats', authenticateToken, requireMovieScreeningAdmin, async (req, res) => {
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
