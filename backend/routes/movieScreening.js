const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const SPONSOR_CAP = 40;
const SPONSOR_CINEMA = 'C3';

// Brute-force protection for physical sale passcode
const passcodeAttempts = new Map(); // IP -> { count, lockedUntil }
const PASSCODE_MAX_ATTEMPTS = 5;
const PASSCODE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const checkPasscodeBruteForce = (ip) => {
  const now = Date.now();
  const record = passcodeAttempts.get(ip);

  if (record && record.lockedUntil && now < record.lockedUntil) {
    return false; // Still locked out
  }

  if (record && record.lockedUntil && now >= record.lockedUntil) {
    // Lockout expired, reset
    passcodeAttempts.delete(ip);
  }

  return true; // Allowed
};

const recordPasscodeFailure = (ip) => {
  const now = Date.now();
  const record = passcodeAttempts.get(ip) || { count: 0, lockedUntil: null };

  record.count += 1;

  if (record.count >= PASSCODE_MAX_ATTEMPTS) {
    record.lockedUntil = now + PASSCODE_LOCKOUT_MS;
  }

  passcodeAttempts.set(ip, record);
};

const clearPasscodeAttempts = (ip) => {
  passcodeAttempts.delete(ip);
};

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

    const sponsorHeldResult = await db.query(
      `SELECT COALESCE(SUM(quantity), 0) as held
       FROM reservations
       WHERE event_id = $1 AND is_sponsor = true AND status IN ('pending', 'confirmed')`,
      [event.id]
    );
    const sponsorHeld = parseInt(sponsorHeldResult.rows[0].held);

    res.json({
      event,
      cinemas: cinemasResult.rows.map(c => ({
        ...c,
        unit_price: parseFloat(c.unit_price),
        seats_left: parseInt(c.seats_left)
      })),
      sponsor: {
        cinema_code: SPONSOR_CINEMA,
        cap: SPONSOR_CAP,
        held: sponsorHeld,
        seats_left: Math.max(0, SPONSOR_CAP - sponsorHeld)
      }
    });
  } catch (err) {
    console.error('Error fetching active screening:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/movie-screening/reserve
// Create a new reservation (public endpoint)
router.post('/reserve', async (req, res) => {
  const { cinema_code: rawCinema, buyer_name, mobile, email, quantity, gcash_ref, is_sponsor, is_anonymous } = req.body;
  const isSponsor = is_sponsor === true || is_sponsor === 'true';
  const isAnonymous = isSponsor && (is_anonymous === true || is_anonymous === 'true');
  const cinema_code = isSponsor ? SPONSOR_CINEMA : rawCinema;

  // Validation
  if (!cinema_code) {
    return res.status(400).json({ error: 'Cinema selection is required' });
  }
  if (!buyer_name || !buyer_name.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }
  if (!isSponsor && !mobile && !email) {
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
  if (!isSponsor && !normalizedMobile && !normalizedEmail) {
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

    if (isSponsor) {
      const sponsorHeldRes = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) as held
         FROM reservations
         WHERE event_id = $1 AND is_sponsor = true AND status IN ('pending', 'confirmed')`,
        [eventId]
      );
      const sponsorHeld = parseInt(sponsorHeldRes.rows[0].held);
      if (sponsorHeld + requestedQty > SPONSOR_CAP) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Only ${Math.max(0, SPONSOR_CAP - sponsorHeld)} sponsored stubs left` });
      }
    }

    // Calculate total amount
    const totalAmount = unitPrice * requestedQty;

    // Insert the reservation
    const insertResult = await client.query(
      `INSERT INTO reservations (
         event_id, cinema_code, buyer_name, mobile, email,
         quantity, unit_price, total_amount, gcash_ref, is_sponsor, is_anonymous, status, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', NOW())
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
        gcash_ref.trim(),
        isSponsor,
        isAnonymous
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

// GET /api/movie-screening/seats/:token
// Load seat picker for a buyer by their seat_token (public, no auth)
router.get('/seats/:token', async (req, res) => {
  const { token } = req.params;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Look up the reservation by seat_token with row lock
    const reservationResult = await client.query(
      `SELECT id, event_id, cinema_code, buyer_name, quantity, status,
              chosen_seats, seats_selected_at, gcash_ref
       FROM reservations
       WHERE seat_token = $1
       FOR UPDATE`,
      [token]
    );

    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    const reservation = reservationResult.rows[0];

    // Check if reservation is cancelled
    if (reservation.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This reservation is no longer active' });
    }

    // Check if seats already selected (token is spent)
    if (reservation.seats_selected_at) {
      await client.query('ROLLBACK');
      return res.json({
        alreadyReserved: true,
        buyer_name: reservation.buyer_name,
        cinema_code: reservation.cinema_code,
        quantity: reservation.quantity,
        chosen_seats: reservation.chosen_seats,
        gcash_ref: reservation.gcash_ref
      });
    }

    // Get all taken seats in this cinema for this event (excluding this reservation)
    const takenResult = await client.query(
      `SELECT chosen_seats
       FROM reservations
       WHERE event_id = $1
         AND cinema_code = $2
         AND status IN ('pending', 'confirmed')
         AND chosen_seats IS NOT NULL
         AND id != $3`,
      [reservation.event_id, reservation.cinema_code, reservation.id]
    );

    // Flatten all chosen_seats into a single array
    const takenSeats = [];
    for (const row of takenResult.rows) {
      if (row.chosen_seats) {
        const seats = row.chosen_seats.split(',').map(s => s.trim()).filter(Boolean);
        takenSeats.push(...seats);
      }
    }

    await client.query('COMMIT');

    res.json({
      buyer_name: reservation.buyer_name,
      cinema_code: reservation.cinema_code,
      quantity: reservation.quantity,
      taken_seats: takenSeats
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error loading seat picker:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/movie-screening/seats/:token/confirm
// Save a buyer's chosen seats (public, no auth)
router.post('/seats/:token/confirm', async (req, res) => {
  const { token } = req.params;
  const { seats } = req.body;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Look up the reservation by seat_token with row lock
    const reservationResult = await client.query(
      `SELECT id, event_id, cinema_code, buyer_name, quantity, status,
              gcash_ref, chosen_seats, seats_selected_at
       FROM reservations
       WHERE seat_token = $1
       FOR UPDATE`,
      [token]
    );

    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    const reservation = reservationResult.rows[0];

    // 2. Check if reservation is cancelled
    if (reservation.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This reservation is no longer active' });
    }

    // 3. Check if seats already selected (token is spent)
    if (reservation.seats_selected_at) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Seats have already been selected for this link.' });
    }

    // 4. Validate seats is a non-empty array of strings
    if (!Array.isArray(seats) || seats.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Seats must be a non-empty array.' });
    }

    const trimmedSeats = [];
    for (const seat of seats) {
      if (typeof seat !== 'string') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Each seat must be a string.' });
      }
      const trimmed = seat.trim();
      if (!trimmed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Seat labels cannot be empty.' });
      }
      trimmedSeats.push(trimmed);
    }

    // 5. Check seats count matches quantity exactly
    if (trimmedSeats.length !== reservation.quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `You must select exactly ${reservation.quantity} seat${reservation.quantity === 1 ? '' : 's'}.`
      });
    }

    // 6. Check for duplicate seats in submission
    const seatSet = new Set(trimmedSeats);
    if (seatSet.size !== trimmedSeats.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Duplicate seats selected.' });
    }

    // 7. Concurrency backstop: check for seats taken by others
    const takenResult = await client.query(
      `SELECT chosen_seats
       FROM reservations
       WHERE event_id = $1
         AND cinema_code = $2
         AND status IN ('pending', 'confirmed')
         AND chosen_seats IS NOT NULL
         AND id != $3`,
      [reservation.event_id, reservation.cinema_code, reservation.id]
    );

    const takenSet = new Set();
    for (const row of takenResult.rows) {
      if (row.chosen_seats) {
        const existingSeats = row.chosen_seats.split(',').map(s => s.trim()).filter(Boolean);
        existingSeats.forEach(s => takenSet.add(s));
      }
    }

    for (const seat of trimmedSeats) {
      if (takenSet.has(seat)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'One or more of those seats were just taken. Please refresh and pick again.'
        });
      }
    }

    // All validations passed - save the seats
    const chosenSeatsStr = trimmedSeats.join(', ');

    await client.query(
      `UPDATE reservations
       SET chosen_seats = $1,
           seats_selected_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [chosenSeatsStr, reservation.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      buyer_name: reservation.buyer_name,
      cinema_code: reservation.cinema_code,
      quantity: reservation.quantity,
      chosen_seats: chosenSeatsStr,
      gcash_ref: reservation.gcash_ref
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error confirming seat selection:', err);
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
         COALESCE(SUM(quantity) FILTER (WHERE status IN ('pending', 'confirmed')), 0) as total_tickets_held,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed'), 0) as tickets_sold,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND cinema_code = 'C3'), 0) as tickets_sold_c3,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND cinema_code = 'C4'), 0) as tickets_sold_c4,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true), 0) as sponsored_sold,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true AND sponsor_type = 'boys_home'), 0) as sponsored_boys_home,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true AND sponsor_type = 'teacher'), 0) as sponsored_teacher,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true AND sponsor_type = 'vacant'), 0) as sponsored_vacant,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true AND sponsor_type IS NULL), 0) as sponsored_other
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
        total_tickets_held: parseInt(statsResult.rows[0].total_tickets_held),
        tickets_sold: parseInt(statsResult.rows[0].tickets_sold),
        tickets_sold_c3: parseInt(statsResult.rows[0].tickets_sold_c3),
        tickets_sold_c4: parseInt(statsResult.rows[0].tickets_sold_c4),
        sponsored_sold: parseInt(statsResult.rows[0].sponsored_sold),
        sponsored_boys_home: parseInt(statsResult.rows[0].sponsored_boys_home),
        sponsored_teacher: parseInt(statsResult.rows[0].sponsored_teacher),
        sponsored_vacant: parseInt(statsResult.rows[0].sponsored_vacant),
        sponsored_other: parseInt(statsResult.rows[0].sponsored_other)
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
         COALESCE(SUM(quantity) FILTER (WHERE status IN ('pending', 'confirmed')), 0) as total_tickets_held,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed'), 0) as tickets_sold,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND cinema_code = 'C3'), 0) as tickets_sold_c3,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND cinema_code = 'C4'), 0) as tickets_sold_c4,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true), 0) as sponsored_sold,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true AND sponsor_type = 'boys_home'), 0) as sponsored_boys_home,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true AND sponsor_type = 'teacher'), 0) as sponsored_teacher,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true AND sponsor_type = 'vacant'), 0) as sponsored_vacant,
         COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed' AND is_sponsor = true AND sponsor_type IS NULL), 0) as sponsored_other
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
        total_tickets_held: parseInt(statsResult.rows[0].total_tickets_held),
        tickets_sold: parseInt(statsResult.rows[0].tickets_sold),
        tickets_sold_c3: parseInt(statsResult.rows[0].tickets_sold_c3),
        tickets_sold_c4: parseInt(statsResult.rows[0].tickets_sold_c4),
        sponsored_sold: parseInt(statsResult.rows[0].sponsored_sold),
        sponsored_boys_home: parseInt(statsResult.rows[0].sponsored_boys_home),
        sponsored_teacher: parseInt(statsResult.rows[0].sponsored_teacher),
        sponsored_vacant: parseInt(statsResult.rows[0].sponsored_vacant),
        sponsored_other: parseInt(statsResult.rows[0].sponsored_other)
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

    // Get cinema capacity (lock row to serialize concurrent confirms per cinema)
    const cinemaResult = await client.query(
      `SELECT capacity FROM event_cinemas WHERE event_id = $1 AND code = $2 FOR UPDATE`,
      [reservation.event_id, reservation.cinema_code]
    );

    if (cinemaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cinema not found' });
    }

    const cinemaCapacity = parseInt(cinemaResult.rows[0].capacity);

    // Get the max serial_end for this event and cinema (excluding physical sales)
    const maxSerialResult = await client.query(
      `SELECT COALESCE(MAX(serial_end), 0) as max_serial
       FROM reservations
       WHERE event_id = $1 AND cinema_code = $2 AND status = 'confirmed'
         AND source IS DISTINCT FROM 'physical'`,
      [reservation.event_id, reservation.cinema_code]
    );

    const serialStart = parseInt(maxSerialResult.rows[0].max_serial) + 1;
    const serialEnd = serialStart + parseInt(reservation.quantity) - 1;

    // Guard: check capacity overflow
    if (serialEnd > cinemaCapacity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Not enough remaining serials. Requested ${reservation.quantity} but only ${cinemaCapacity - serialStart + 1} available.`
      });
    }

    // Guard: check for overlap with any existing pending or confirmed reservation
    const overlapResult = await client.query(
      `SELECT id, serial_start, serial_end
       FROM reservations
       WHERE event_id = $1 AND cinema_code = $2
         AND status IN ('pending', 'confirmed')
         AND serial_start IS NOT NULL
         AND serial_end IS NOT NULL
         AND serial_start <= $4
         AND serial_end >= $3`,
      [reservation.event_id, reservation.cinema_code, serialStart, serialEnd]
    );

    if (overlapResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Not enough remaining serials. The requested range overlaps with existing reservations.'
      });
    }

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

// POST /api/movie-screening/admin/:id/mark-audited
// Mark a physical sale as audited (set gcash_verified = true)
router.post('/admin/:id/mark-audited', authenticateToken, async (req, res) => {
  // Permission check: must have screenings_view + screenings_edit
  const hasAccess = await canEditTracker(req.user.email);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied. Screenings edit permission required.' });
  }

  const { id } = req.params;

  try {
    // Get current reservation
    const current = await db.query(
      'SELECT source, status, gcash_verified FROM reservations WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = current.rows[0];

    // Only valid for physical sales that are confirmed
    if (reservation.source !== 'physical') {
      return res.status(400).json({ error: 'Only physical sales can be marked as audited' });
    }

    if (reservation.status !== 'confirmed') {
      return res.status(400).json({ error: 'Only confirmed reservations can be marked as audited' });
    }

    // Idempotent: if already audited, just return current state
    if (reservation.gcash_verified) {
      const result = await db.query(
        'SELECT * FROM reservations WHERE id = $1',
        [id]
      );
      return res.json({
        ...result.rows[0],
        unit_price: parseFloat(result.rows[0].unit_price),
        total_amount: parseFloat(result.rows[0].total_amount)
      });
    }

    // Mark as audited
    const result = await db.query(
      `UPDATE reservations
       SET gcash_verified = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      ...result.rows[0],
      unit_price: parseFloat(result.rows[0].unit_price),
      total_amount: parseFloat(result.rows[0].total_amount)
    });
  } catch (err) {
    console.error('Error marking reservation as audited:', err);
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

// POST /api/movie-screening/admin/:id/generate-seat-link
// Generate a seat picker link for a reservation (resets timer if re-generating)
router.post('/admin/:id/generate-seat-link', authenticateToken, async (req, res) => {
  // Permission check: must have screenings_view + screenings_edit
  const hasAccess = await canEditTracker(req.user.email);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied. Screenings edit permission required.' });
  }

  const { id } = req.params;

  try {
    // Load the reservation
    const reservationResult = await db.query(
      'SELECT id, seat_token FROM reservations WHERE id = $1',
      [id]
    );

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // If a token already exists, return it (don't regenerate)
    const existingToken = reservationResult.rows[0].seat_token;
    if (existingToken) {
      const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL;
      const path = `/seats/${existingToken}`;
      const url = baseUrl ? `${baseUrl}${path}` : path;
      return res.json({ token: existingToken, url });
    }

    // Generate a unique URL-safe token (~24 chars)
    let token;
    let collision = true;

    while (collision) {
      // 18 bytes -> 24 base64url chars
      token = crypto.randomBytes(18).toString('base64url');

      // Check for collision
      const existing = await db.query(
        'SELECT id FROM reservations WHERE seat_token = $1',
        [token]
      );
      collision = existing.rows.length > 0;
    }

    // Update reservation: set token, reset timer fields for fresh 15-minute window
    await db.query(
      `UPDATE reservations
       SET seat_token = $1,
           seat_selection_started_at = NULL,
           seats_selected_at = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [token, id]
    );

    // Build URL
    const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL;
    const path = `/seats/${token}`;
    const url = baseUrl ? `${baseUrl}${path}` : path;

    res.json({ token, url });
  } catch (err) {
    console.error('Error generating seat link:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// PHYSICAL SALE ENDPOINTS (passcode protected)
// ============================================

// GET /api/movie-screening/physical-sale/lowest
// Returns the lowest serial_start among physical sales for a cinema (no auth needed)
router.get('/physical-sale/lowest', async (req, res) => {
  const { cinema_code } = req.query;

  if (!cinema_code) {
    return res.status(400).json({ error: 'cinema_code is required' });
  }

  try {
    // Get active event
    const eventResult = await db.query(
      `SELECT id FROM screening_events WHERE status = 'active' LIMIT 1`
    );

    if (eventResult.rows.length === 0) {
      return res.json({ lowest_serial: null });
    }

    const eventId = eventResult.rows[0].id;

    // Get lowest serial_start among physical sales
    const result = await db.query(
      `SELECT MIN(serial_start) as lowest_serial
       FROM reservations
       WHERE event_id = $1 AND cinema_code = $2
         AND source = 'physical'
         AND status IN ('pending', 'confirmed')
         AND serial_start IS NOT NULL`,
      [eventId, cinema_code]
    );

    const lowestSerial = result.rows[0].lowest_serial;
    res.json({ lowest_serial: lowestSerial ? parseInt(lowestSerial) : null });
  } catch (err) {
    console.error('Error fetching lowest physical serial:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/movie-screening/physical-sale/verify
// Verify passcode for committee access (uses same brute-force protection)
router.post('/physical-sale/verify', async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

  // Brute-force check
  if (!checkPasscodeBruteForce(clientIp)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const { passcode } = req.body;

  // Validate passcode
  if (!passcode || passcode !== process.env.PHYSICAL_SALE_PASSCODE) {
    recordPasscodeFailure(clientIp);
    return res.status(403).json({ error: 'Invalid passcode' });
  }

  // Passcode correct, clear attempts
  clearPasscodeAttempts(clientIp);

  res.json({ ok: true });
});

// POST /api/movie-screening/physical-sale
// Record a physical ticket sale (passcode protected)
router.post('/physical-sale', async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';

  // Brute-force check
  if (!checkPasscodeBruteForce(clientIp)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const { passcode, cinema_code, quantity, highest_serial, buyer_name, mobile, email, sold_by, payment_method, payment_ref } = req.body;

  // Validate passcode
  if (!passcode || passcode !== process.env.PHYSICAL_SALE_PASSCODE) {
    recordPasscodeFailure(clientIp);
    return res.status(403).json({ error: 'Invalid passcode' });
  }

  // Passcode correct, clear attempts
  clearPasscodeAttempts(clientIp);

  // Validate required fields
  if (!cinema_code) {
    return res.status(400).json({ error: 'Cinema selection is required' });
  }
  if (!buyer_name || !buyer_name.trim()) {
    return res.status(400).json({ error: 'Buyer name is required' });
  }
  if (!mobile || !mobile.trim()) {
    return res.status(400).json({ error: 'Mobile number is required' });
  }
  if (!sold_by || !sold_by.trim()) {
    return res.status(400).json({ error: 'Sold by is required' });
  }

  // Validate payment method
  if (!payment_method || !['cash', 'gcash'].includes(payment_method)) {
    return res.status(400).json({ error: 'Payment method must be cash or gcash' });
  }

  // Validate payment reference (same validation as gcash_ref in reserve)
  if (!payment_ref || !payment_ref.trim()) {
    return res.status(400).json({ error: 'Payment reference number is required' });
  }

  // Validate and normalize mobile
  const normalizedMobile = normalizePHMobile(mobile);
  if (normalizedMobile === false) {
    return res.status(400).json({ error: 'Enter a valid PH mobile, e.g. 09171234567' });
  }

  // Validate email format when provided
  const trimmedEmail = email ? email.trim() : null;
  if (trimmedEmail && !isValidEmail(trimmedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  // Validate quantity
  const qty = parseInt(quantity);
  if (!qty || qty < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }

  // Validate highest_serial
  const highSerial = parseInt(highest_serial);
  if (!highSerial || highSerial < 1) {
    return res.status(400).json({ error: 'Highest serial number is required' });
  }

  // Compute serial range (descending from highest)
  const serialEnd = highSerial;
  const serialStart = highSerial - qty + 1;

  if (serialStart < 1) {
    return res.status(400).json({ error: 'Serial range goes below 1. Check quantity and highest serial.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Get active event
    const eventResult = await client.query(
      `SELECT id FROM screening_events WHERE status = 'active' LIMIT 1`
    );

    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active screening event found' });
    }

    const eventId = eventResult.rows[0].id;

    // Get cinema capacity and unit price (lock row for concurrency)
    const cinemaResult = await client.query(
      `SELECT capacity, unit_price FROM event_cinemas WHERE event_id = $1 AND code = $2 FOR UPDATE`,
      [eventId, cinema_code]
    );

    if (cinemaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid cinema selection' });
    }

    const cinemaCapacity = parseInt(cinemaResult.rows[0].capacity);
    const unitPrice = parseFloat(cinemaResult.rows[0].unit_price);

    // Validate serial_end does not exceed capacity
    if (serialEnd > cinemaCapacity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Highest serial ${serialEnd} exceeds cinema capacity of ${cinemaCapacity}`
      });
    }

    // Check for overlap with existing pending or confirmed reservations
    const overlapResult = await client.query(
      `SELECT serial_start, serial_end
       FROM reservations
       WHERE event_id = $1 AND cinema_code = $2
         AND status IN ('pending', 'confirmed')
         AND serial_start IS NOT NULL
         AND serial_end IS NOT NULL
         AND serial_start <= $4
         AND serial_end >= $3`,
      [eventId, cinema_code, serialStart, serialEnd]
    );

    if (overlapResult.rows.length > 0) {
      // Find which specific serials collide
      const collidedSerials = [];
      for (const row of overlapResult.rows) {
        const existingStart = parseInt(row.serial_start);
        const existingEnd = parseInt(row.serial_end);
        for (let s = Math.max(serialStart, existingStart); s <= Math.min(serialEnd, existingEnd); s++) {
          collidedSerials.push(s);
        }
      }
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Some serials are already taken. Set these stubs aside.',
        collided_serials: collidedSerials.sort((a, b) => b - a)
      });
    }

    // Calculate total
    const totalAmount = unitPrice * qty;

    // Insert the physical sale reservation with serials
    const insertResult = await client.query(
      `INSERT INTO reservations (
         event_id, cinema_code, buyer_name, mobile, email, quantity, unit_price, total_amount,
         gcash_ref, status, source, sold_by, payment_method, gcash_verified, serial_start, serial_end,
         confirmed_at, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', 'physical', $10, $11, false, $12, $13, NOW(), NOW())
       RETURNING *`,
      [eventId, cinema_code, buyer_name.trim(), normalizedMobile, trimmedEmail, qty, unitPrice, totalAmount, payment_ref.trim(), sold_by.trim(), payment_method, serialStart, serialEnd]
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
    console.error('Error creating physical sale:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
