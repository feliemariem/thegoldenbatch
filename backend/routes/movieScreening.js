const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { sendScreeningConfirmationEmail } = require('../utils/email');

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

// Normalize and validate Philippine mobile number (used by physical-sale)
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

// Validate international mobile (optional, lenient)
const isValidMobile = (mobile) => {
  if (!mobile) return true; // Optional
  const trimmed = mobile.trim();
  if (!trimmed) return true;
  return /^\+?[0-9\s().\-]{7,20}$/.test(trimmed);
};

// Helper: get active event row (deterministic: ORDER BY id DESC)
const getActiveEvent = async (client) => {
  const result = await client.query(
    `SELECT id, slug, title, subtitle, event_date, venue, gcash_number, gcash_name, status
     FROM screening_events
     WHERE status = 'active'
     ORDER BY id DESC
     LIMIT 1`
  );
  return result.rows.length > 0 ? result.rows[0] : null;
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
// SHARED STATS HELPER
// ============================================

// Get event stats, showtimes, and by_team breakdown
const getEventStats = async (eventId) => {
  // Core stats (removed tickets_sold_c3/c4 and sponsored_* fields)
  const statsResult = await db.query(
    `SELECT
       COUNT(*) as total_reservations,
       COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
       COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
       COALESCE(SUM(total_amount) FILTER (WHERE status = 'confirmed'), 0) as total_collected,
       COALESCE(SUM(quantity) FILTER (WHERE status IN ('pending', 'confirmed')), 0) as total_tickets_held,
       COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed'), 0) as tickets_sold,
       COALESCE(SUM(quantity) FILTER (WHERE status = 'pending'), 0) as tickets_pending
     FROM reservations
     WHERE event_id = $1`,
    [eventId]
  );

  // Per-showtime stats with serial_prefix and serial_base
  const showtimesResult = await db.query(
    `SELECT
       ec.code,
       ec.label,
       ec.showtime,
       ec.capacity,
       COALESCE(ec.serial_prefix, ec.code) as serial_prefix,
       COALESCE(ec.serial_base, 1) as serial_base,
       COALESCE(
         (SELECT SUM(r.quantity)
          FROM reservations r
          WHERE r.event_id = ec.event_id
            AND r.cinema_code = ec.code
            AND r.status = 'confirmed'
         ), 0
       ) as tickets_sold,
       COALESCE(
         (SELECT SUM(r.quantity)
          FROM reservations r
          WHERE r.event_id = ec.event_id
            AND r.cinema_code = ec.code
            AND r.status = 'pending'
         ), 0
       ) as tickets_pending,
       COALESCE(
         (SELECT SUM(r.quantity)
          FROM reservations r
          WHERE r.event_id = ec.event_id
            AND r.cinema_code = ec.code
            AND r.status IN ('pending', 'confirmed')
         ), 0
       ) + COALESCE(
         (SELECT COUNT(*)
          FROM screening_seats ss
          WHERE ss.event_id = ec.event_id
            AND ss.cinema_code = ec.code
            AND ss.reservation_id IS NULL
            AND ss.expires_at > NOW()
         ), 0
       ) as held_seats
     FROM event_cinemas ec
     WHERE ec.event_id = $1
     ORDER BY ec.sort_order NULLS LAST, ec.code ASC`,
    [eventId]
  );

  // By-team breakdown (confirmed only for tickets/orders/collected, pending for pending_tickets)
  const byTeamResult = await db.query(
    `SELECT
       COALESCE(sold_by_team, 'batch2003') as team,
       cinema_code,
       COUNT(*) FILTER (WHERE status = 'confirmed') as orders,
       COALESCE(SUM(quantity) FILTER (WHERE status = 'confirmed'), 0) as tickets,
       COALESCE(SUM(quantity) FILTER (WHERE status = 'pending'), 0) as pending_tickets,
       COALESCE(SUM(total_amount) FILTER (WHERE status = 'confirmed'), 0) as collected
     FROM reservations
     WHERE event_id = $1 AND status IN ('pending', 'confirmed')
     GROUP BY COALESCE(sold_by_team, 'batch2003'), cinema_code`,
    [eventId]
  );

  const showtimes = showtimesResult.rows.map(c => ({
    ...c,
    capacity: parseInt(c.capacity),
    serial_base: parseInt(c.serial_base),
    tickets_sold: parseInt(c.tickets_sold),
    tickets_pending: parseInt(c.tickets_pending),
    held_seats: parseInt(c.held_seats)
  }));

  // Build by_team structure with exact shape, always include both teams
  const teams = ['batch2003', 'liceo'];
  const by_team = {};

  for (const team of teams) {
    // Initialize with zeros and per_showtime for every showtime
    by_team[team] = {
      tickets: 0,
      orders: 0,
      collected: 0,
      pending_tickets: 0,
      per_showtime: showtimes.map(s => ({
        code: s.code,
        showtime: s.showtime,
        tickets: 0
      }))
    };
  }

  // Populate from query results
  for (const row of byTeamResult.rows) {
    const team = row.team;
    if (!by_team[team]) continue; // Skip unknown teams

    by_team[team].tickets += parseInt(row.tickets);
    by_team[team].orders += parseInt(row.orders);
    by_team[team].collected += parseFloat(row.collected);
    by_team[team].pending_tickets += parseInt(row.pending_tickets);

    // Update per_showtime entry for this cinema_code
    const showtimeEntry = by_team[team].per_showtime.find(s => s.code === row.cinema_code);
    if (showtimeEntry) {
      showtimeEntry.tickets += parseInt(row.tickets);
    }
  }

  return {
    stats: {
      total_reservations: parseInt(statsResult.rows[0].total_reservations),
      pending_count: parseInt(statsResult.rows[0].pending_count),
      confirmed_count: parseInt(statsResult.rows[0].confirmed_count),
      total_collected: parseFloat(statsResult.rows[0].total_collected),
      total_tickets_held: parseInt(statsResult.rows[0].total_tickets_held),
      tickets_sold: parseInt(statsResult.rows[0].tickets_sold),
      tickets_pending: parseInt(statsResult.rows[0].tickets_pending)
    },
    showtimes,
    cinemaStats: showtimes, // backward compatibility alias
    by_team
  };
};

// Format ticket numbers from serial range
const formatTicketNumbers = (serialPrefix, serialStart, serialEnd) => {
  if (!serialStart || !serialEnd) return null;
  const padded = (n) => String(n).padStart(5, '0');
  if (serialStart === serialEnd) {
    return `${serialPrefix}-${padded(serialStart)}`;
  }
  return `${serialPrefix}-${padded(serialStart)} to ${serialPrefix}-${padded(serialEnd)}`;
};

// ============================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================

// GET /api/movie-screening/active
// Returns the active screening event with cinemas and remaining seats
router.get('/active', async (req, res) => {
  try {
    const event = await getActiveEvent(db);
    if (!event) {
      return res.json({ event: null, cinemas: [] });
    }

    // Get cinemas with remaining seats (reservations + unexpired holds)
    const cinemasResult = await db.query(
      `SELECT
         ec.id,
         ec.code,
         ec.label,
         ec.showtime,
         ec.unit_price,
         ec.capacity,
         ec.layout,
         ec.sort_order,
         GREATEST(0, ec.capacity - COALESCE(
           (SELECT SUM(r.quantity)
            FROM reservations r
            WHERE r.event_id = ec.event_id
              AND r.cinema_code = ec.code
              AND r.status IN ('pending', 'confirmed')
           ), 0)
           - COALESCE(
             (SELECT COUNT(*)
              FROM screening_seats ss
              WHERE ss.event_id = ec.event_id
                AND ss.cinema_code = ec.code
                AND ss.reservation_id IS NULL
                AND ss.expires_at > NOW()
             ), 0)
         ) as seats_left
       FROM event_cinemas ec
       WHERE ec.event_id = $1
       ORDER BY ec.sort_order NULLS LAST, ec.id`,
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
        seats_left: parseInt(c.seats_left),
        layout: c.layout,
        sort_order: c.sort_order
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

// GET /api/movie-screening/seats/taken?cinema_code=X&hold_token=Y
// Returns taken seats and seats held by the current token
router.get('/seats/taken', async (req, res) => {
  const { cinema_code, hold_token } = req.query;

  if (!cinema_code) {
    return res.status(400).json({ error: 'cinema_code is required' });
  }

  try {
    const event = await getActiveEvent(db);
    if (!event) {
      return res.status(400).json({ error: 'No active screening event' });
    }

    // Validate cinema_code belongs to this event
    const cinemaCheck = await db.query(
      `SELECT code FROM event_cinemas WHERE event_id = $1 AND code = $2`,
      [event.id, cinema_code]
    );
    if (cinemaCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid cinema for this event' });
    }

    // SOLD seats: reservation_id IS NOT NULL
    const soldResult = await db.query(
      `SELECT seat_label FROM screening_seats
       WHERE event_id = $1 AND cinema_code = $2 AND reservation_id IS NOT NULL`,
      [event.id, cinema_code]
    );

    // HELD by others: reservation_id IS NULL AND expires_at > NOW() AND hold_token != ours
    const heldByOthersResult = await db.query(
      `SELECT seat_label FROM screening_seats
       WHERE event_id = $1 AND cinema_code = $2
         AND reservation_id IS NULL
         AND expires_at > NOW()
         AND ($3::text IS NULL OR hold_token != $3)`,
      [event.id, cinema_code, hold_token || null]
    );

    const taken = [
      ...soldResult.rows.map(r => r.seat_label),
      ...heldByOthersResult.rows.map(r => r.seat_label)
    ];

    // Mine: seats held by my token (if provided)
    let mine = [];
    let expires_at = null;
    if (hold_token) {
      const mineResult = await db.query(
        `SELECT seat_label, expires_at FROM screening_seats
         WHERE event_id = $1 AND cinema_code = $2
           AND hold_token = $3
           AND reservation_id IS NULL
           AND expires_at > NOW()`,
        [event.id, cinema_code, hold_token]
      );
      mine = mineResult.rows.map(r => r.seat_label);
      if (mineResult.rows.length > 0) {
        expires_at = mineResult.rows.reduce((min, r) =>
          !min || new Date(r.expires_at) < new Date(min) ? r.expires_at : min, null);
      }
    }

    res.json({ taken, mine, expires_at });
  } catch (err) {
    console.error('Error fetching taken seats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/movie-screening/holds
// Create or update seat holds
router.post('/holds', async (req, res) => {
  let { cinema_code, quantity, seats, hold_token } = req.body;

  // Validation
  if (!cinema_code) {
    return res.status(400).json({ error: 'cinema_code is required' });
  }
  const qty = parseInt(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
    return res.status(400).json({ error: 'quantity must be an integer between 1 and 50' });
  }
  if (!Array.isArray(seats)) {
    return res.status(400).json({ error: 'seats must be an array' });
  }
  if (seats.length > qty) {
    return res.status(400).json({ error: `seats array length (${seats.length}) exceeds quantity (${qty})` });
  }
  const seatSet = new Set();
  for (const s of seats) {
    if (typeof s !== 'string' || !/^[A-O][0-9]{1,2}$/.test(s)) {
      return res.status(400).json({ error: `Invalid seat label: ${s}` });
    }
    if (seatSet.has(s)) {
      return res.status(400).json({ error: `Duplicate seat: ${s}` });
    }
    seatSet.add(s);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const event = await getActiveEvent(client);
    if (!event) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active screening event' });
    }

    // Validate cinema_code
    const cinemaCheck = await client.query(
      `SELECT code FROM event_cinemas WHERE event_id = $1 AND code = $2`,
      [event.id, cinema_code]
    );
    if (cinemaCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid cinema for this event' });
    }

    // Generate token if not provided
    if (!hold_token) {
      hold_token = crypto.randomBytes(24).toString('hex');
    }

    // 1. Delete expired holds for this event+cinema
    await client.query(
      `DELETE FROM screening_seats
       WHERE event_id = $1 AND cinema_code = $2
         AND reservation_id IS NULL AND expires_at < NOW()`,
      [event.id, cinema_code]
    );

    // 2. Delete this token's holds in OTHER cinemas (buyer switched showtime)
    await client.query(
      `DELETE FROM screening_seats
       WHERE hold_token = $1 AND cinema_code != $2`,
      [hold_token, cinema_code]
    );

    // 3. Session expiry check
    const existingRows = await client.query(
      `SELECT MIN(expires_at) as min_exp FROM screening_seats
       WHERE hold_token = $1 AND reservation_id IS NULL`,
      [hold_token]
    );
    let sessionExpiry;
    if (existingRows.rows[0].min_exp) {
      const minExp = new Date(existingRows.rows[0].min_exp);
      if (minExp < new Date()) {
        // Session expired - delete all and return 410
        await client.query(
          `DELETE FROM screening_seats WHERE hold_token = $1 AND reservation_id IS NULL`,
          [hold_token]
        );
        await client.query('COMMIT');
        return res.status(410).json({ error: 'expired' });
      }
      sessionExpiry = minExp;
    } else {
      sessionExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    }

    // 4. Delete this token's rows whose seat_label is NOT in the new seats array
    if (seats.length > 0) {
      await client.query(
        `DELETE FROM screening_seats
         WHERE hold_token = $1 AND cinema_code = $2 AND reservation_id IS NULL
           AND seat_label != ALL($3::text[])`,
        [hold_token, cinema_code, seats]
      );
    } else {
      await client.query(
        `DELETE FROM screening_seats
         WHERE hold_token = $1 AND cinema_code = $2 AND reservation_id IS NULL`,
        [hold_token, cinema_code]
      );
    }

    // 5. Get seats already held by this token
    const alreadyHeldResult = await client.query(
      `SELECT seat_label FROM screening_seats
       WHERE hold_token = $1 AND cinema_code = $2 AND reservation_id IS NULL`,
      [hold_token, cinema_code]
    );
    const alreadyHeld = new Set(alreadyHeldResult.rows.map(r => r.seat_label));

    // Seats to insert (requested but not already held)
    const seatsToInsert = seats.filter(s => !alreadyHeld.has(s));

    // Insert new holds
    for (const seat of seatsToInsert) {
      await client.query(
        `INSERT INTO screening_seats (event_id, cinema_code, seat_label, hold_token, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (event_id, cinema_code, seat_label) DO NOTHING`,
        [event.id, cinema_code, seat, hold_token, sessionExpiry]
      );
    }

    // 6. Determine what we now hold and what was unavailable
    const nowHeldResult = await client.query(
      `SELECT seat_label FROM screening_seats
       WHERE hold_token = $1 AND cinema_code = $2 AND reservation_id IS NULL`,
      [hold_token, cinema_code]
    );
    const nowHeld = new Set(nowHeldResult.rows.map(r => r.seat_label));
    const unavailable = seats.filter(s => !nowHeld.has(s));

    await client.query('COMMIT');

    res.json({
      hold_token,
      expires_at: sessionExpiry.toISOString(),
      held: Array.from(nowHeld),
      unavailable
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating holds:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/movie-screening/holds/:token
// Release all holds for a token
router.delete('/holds/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await db.query(
      `DELETE FROM screening_seats WHERE hold_token = $1 AND reservation_id IS NULL`,
      [token]
    );
    res.json({ released: result.rowCount });
  } catch (err) {
    console.error('Error releasing holds:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/movie-screening/holds/:token/release
// Release all holds for a token (sendBeacon-friendly, no preflight)
router.post('/holds/:token/release', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await db.query(
      `DELETE FROM screening_seats WHERE hold_token = $1 AND reservation_id IS NULL`,
      [token]
    );
    res.json({ released: result.rowCount });
  } catch (err) {
    console.error('Error releasing holds:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/movie-screening/reserve
// Create a new reservation (public endpoint)
router.post('/reserve', async (req, res) => {
  const { cinema_code: rawCinema, buyer_name, mobile, email, quantity, gcash_ref, is_sponsor, is_anonymous, hold_token, sold_by_team } = req.body;
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

  // Email is now required
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email address is required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  const normalizedEmail = email.trim().toLowerCase();

  // Mobile is now optional and international
  let normalizedMobile = null;
  if (mobile && mobile.trim()) {
    if (!isValidMobile(mobile)) {
      return res.status(400).json({ error: 'Enter a valid mobile number' });
    }
    normalizedMobile = mobile.trim();
  }

  // hold_token is required
  if (!hold_token) {
    return res.status(400).json({ error: 'hold_token is required' });
  }

  // sold_by_team is required
  if (!sold_by_team || !['batch2003', 'liceo'].includes(sold_by_team)) {
    return res.status(400).json({ error: 'sold_by_team must be batch2003 or liceo' });
  }

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }
  if (!gcash_ref || !gcash_ref.trim()) {
    return res.status(400).json({ error: 'GCash reference number is required' });
  }

  const client = await db.pool.connect();
  const requestedQty = parseInt(quantity);

  try {
    await client.query('BEGIN');

    const event = await getActiveEvent(client);
    if (!event) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active screening event found' });
    }
    const eventId = event.id;

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

    // Verify seat holds
    const holdCheck = await client.query(
      `SELECT seat_label, cinema_code, expires_at FROM screening_seats
       WHERE hold_token = $1 AND reservation_id IS NULL
       FOR UPDATE`,
      [hold_token]
    );

    if (holdCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Your seat hold expired. Please choose your seats again.' });
    }

    // Check if any hold is expired
    const now = new Date();
    for (const row of holdCheck.rows) {
      if (new Date(row.expires_at) < now) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Your seat hold expired. Please choose your seats again.' });
      }
    }

    // Check all holds are for the same cinema
    for (const row of holdCheck.rows) {
      if (row.cinema_code !== cinema_code) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Seat holds are for a different cinema. Please choose your seats again.' });
      }
    }

    // Check hold count matches quantity
    if (holdCheck.rows.length !== requestedQty) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Expected ${requestedQty} held seats but found ${holdCheck.rows.length}. Please choose your seats again.` });
    }

    // Sort seats: row letter first, then number
    const heldSeatsLabels = holdCheck.rows.map(r => r.seat_label);
    heldSeatsLabels.sort((a, b) => {
      const rowA = a.match(/^[A-O]/)[0];
      const rowB = b.match(/^[A-O]/)[0];
      if (rowA !== rowB) return rowA.localeCompare(rowB);
      const numA = parseInt(a.slice(1));
      const numB = parseInt(b.slice(1));
      return numA - numB;
    });
    const chosenSeatsStr = heldSeatsLabels.join(', ');

    // Calculate total amount
    const totalAmount = unitPrice * requestedQty;

    // Insert the reservation
    const insertResult = await client.query(
      `INSERT INTO reservations (
         event_id, cinema_code, buyer_name, mobile, email, quantity, unit_price, total_amount,
         gcash_ref, is_sponsor, is_anonymous, sold_by_team, chosen_seats, status, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', NOW())
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
        isAnonymous,
        sold_by_team,
        chosenSeatsStr
      ]
    );

    const reservationId = insertResult.rows[0].id;

    // Convert holds to sold seats
    const updateResult = await client.query(
      `UPDATE screening_seats
       SET reservation_id = $1, hold_token = NULL, expires_at = NULL
       WHERE hold_token = $2`,
      [reservationId, hold_token]
    );

    // Verify all holds were converted
    if (updateResult.rowCount !== requestedQty) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Seat hold mismatch. Please choose your seats again.' });
    }

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

    const eventStats = await getEventStats(event_id);

    res.json(eventStats);
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
              COALESCE(ec.serial_prefix, ec.code) as serial_prefix,
              a.first_name as claimed_by_first_name, a.last_name as claimed_by_last_name
       FROM reservations r
       JOIN event_cinemas ec ON ec.event_id = r.event_id AND ec.code = r.cinema_code
       LEFT JOIN admins a ON r.claimed_by = a.id
       WHERE r.event_id = $1
       ORDER BY r.created_at DESC`,
      [event_id]
    );

    const eventStats = await getEventStats(event_id);

    res.json({
      reservations: result.rows.map(r => ({
        ...r,
        unit_price: parseFloat(r.unit_price),
        total_amount: parseFloat(r.total_amount),
        ticket_numbers: formatTicketNumbers(r.serial_prefix, r.serial_start, r.serial_end),
        claimed_by_name: r.claimed_by_first_name && r.claimed_by_last_name
          ? `${r.claimed_by_first_name} ${r.claimed_by_last_name}`
          : (r.claimed_by_first_name || r.claimed_by_last_name || null)
      })),
      ...eventStats
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

    // Get cinema capacity, serial_base, and serial_prefix (lock row to serialize concurrent confirms per cinema)
    const cinemaResult = await client.query(
      `SELECT capacity, COALESCE(serial_base, 1) as serial_base, COALESCE(serial_prefix, code) as serial_prefix
       FROM event_cinemas WHERE event_id = $1 AND code = $2 FOR UPDATE`,
      [reservation.event_id, reservation.cinema_code]
    );

    if (cinemaResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cinema not found' });
    }

    const cinemaCapacity = parseInt(cinemaResult.rows[0].capacity);
    const serialBase = parseInt(cinemaResult.rows[0].serial_base);
    const serialLast = serialBase + cinemaCapacity - 1;
    const serialPrefix = cinemaResult.rows[0].serial_prefix;

    // Get the max serial_end for this event and cinema (excluding physical sales)
    const maxSerialResult = await client.query(
      `SELECT COALESCE(MAX(serial_end), 0) as max_serial
       FROM reservations
       WHERE event_id = $1 AND cinema_code = $2 AND status = 'confirmed'
         AND source IS DISTINCT FROM 'physical'`,
      [reservation.event_id, reservation.cinema_code]
    );

    const serialStart = Math.max(serialBase, parseInt(maxSerialResult.rows[0].max_serial) + 1);
    const serialEnd = serialStart + parseInt(reservation.quantity) - 1;

    // Guard: check capacity overflow
    if (serialEnd > serialLast) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Not enough remaining serials. Requested ${reservation.quantity} but only ${serialLast - serialStart + 1} available.`
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

    const updated = updateResult.rows[0];
    const ticketNumbers = formatTicketNumbers(serialPrefix, updated.serial_start, updated.serial_end);

    res.json({
      ...updated,
      unit_price: parseFloat(updated.unit_price),
      total_amount: parseFloat(updated.total_amount),
      ticket_numbers: ticketNumbers
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error confirming reservation:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/movie-screening/admin/:id/send-confirmation
// Send confirmation email for a confirmed reservation
router.post('/admin/:id/send-confirmation', authenticateToken, async (req, res) => {
  // Permission check: must have screenings_view + screenings_edit
  const hasAccess = await canEditTracker(req.user.email);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied. Screenings edit permission required.' });
  }

  const { id } = req.params;

  try {
    // Load the reservation
    const reservationResult = await db.query(
      `SELECT r.*, ec.label as cinema_label, ec.showtime,
              COALESCE(ec.serial_prefix, ec.code) as serial_prefix
       FROM reservations r
       JOIN event_cinemas ec ON ec.event_id = r.event_id AND ec.code = r.cinema_code
       WHERE r.id = $1`,
      [id]
    );

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = reservationResult.rows[0];

    if (reservation.status !== 'confirmed') {
      return res.status(400).json({ error: 'Reservation must be confirmed before sending email' });
    }

    if (!reservation.email) {
      return res.status(400).json({ error: 'No email address on this reservation' });
    }

    // Load event details with pre-formatted date
    const eventResult = await db.query(
      `SELECT title, TO_CHAR(event_date, 'FMMonth FMDD, YYYY') AS event_date_label, venue
       FROM screening_events WHERE id = $1`,
      [reservation.event_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(400).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];
    const firstName = (reservation.buyer_name || '').split(' ')[0] || 'there';
    const ticketNumbers = formatTicketNumbers(reservation.serial_prefix, reservation.serial_start, reservation.serial_end);

    const emailResult = await sendScreeningConfirmationEmail({
      to: reservation.email,
      firstName,
      eventTitle: event.title,
      eventDate: event.event_date_label,
      cinemaLabel: reservation.cinema_label,
      showtime: reservation.showtime,
      venue: event.venue,
      quantity: reservation.quantity,
      seats: reservation.chosen_seats || '',
      ticketNumbers,
      reference: reservation.gcash_ref
    });

    if (!emailResult.success) {
      return res.status(502).json({ email_sent: false, error: emailResult.error || 'Failed to send email' });
    }

    // Update confirmation_email_sent_at
    const updateResult = await db.query(
      `UPDATE reservations SET confirmation_email_sent_at = NOW() WHERE id = $1 RETURNING confirmation_email_sent_at`,
      [id]
    );

    res.json({
      email_sent: true,
      confirmation_email_sent_at: updateResult.rows[0].confirmation_email_sent_at
    });
  } catch (err) {
    console.error('Error sending confirmation email:', err);
    res.status(500).json({ error: 'Server error' });
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

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE reservations
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Free up any screening_seats tied to this reservation
    await client.query(
      `DELETE FROM screening_seats WHERE reservation_id = $1`,
      [id]
    );

    await client.query('COMMIT');

    res.json({
      ...result.rows[0],
      unit_price: parseFloat(result.rows[0].unit_price),
      total_amount: parseFloat(result.rows[0].total_amount)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cancelling reservation:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
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

// GET /api/movie-screening/admin/seats
// Returns seat map data for all cinemas with reservation info
router.get('/admin/seats', authenticateToken, async (req, res) => {
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

    // Get all reservations with chosen_seats for this event
    const reservationsResult = await db.query(
      `SELECT id, cinema_code, buyer_name, mobile, email, status, is_sponsor, sponsor_type, gcash_ref, chosen_seats
       FROM reservations
       WHERE event_id = $1
         AND chosen_seats IS NOT NULL
         AND status IN ('pending', 'confirmed')`,
      [event_id]
    );

    // Build seatMap: { "C3:A1" -> { buyer_name, mobile, email, status, is_sponsor, sponsor_type, gcash_ref } }
    const seatMap = {};
    for (const row of reservationsResult.rows) {
      const seats = row.chosen_seats.split(',').map(s => s.trim()).filter(Boolean);
      for (const seat of seats) {
        const key = `${row.cinema_code}:${seat}`;
        seatMap[key] = {
          buyer_name: row.buyer_name,
          mobile: row.mobile,
          email: row.email,
          status: row.status,
          is_sponsor: row.is_sponsor,
          sponsor_type: row.sponsor_type,
          gcash_ref: row.gcash_ref
        };
      }
    }

    // Get cinema info
    const cinemasResult = await db.query(
      `SELECT code, label, capacity
       FROM event_cinemas
       WHERE event_id = $1
       ORDER BY code ASC`,
      [event_id]
    );

    res.json({
      seatMap,
      cinemas: cinemasResult.rows.map(c => ({
        ...c,
        capacity: parseInt(c.capacity)
      }))
    });
  } catch (err) {
    console.error('Error fetching seat map:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/movie-screening/admin/stubs
// Returns per-stub data for CSV export (one row per stub in the cinema)
router.get('/admin/stubs', authenticateToken, async (req, res) => {
  try {
    // Permission check: must have screenings_view + (screenings_tracker OR screenings_edit)
    const hasAccess = await canViewTracker(req.user.email);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied. Screenings tracker permission required.' });
    }

    const { event_id, cinema_code } = req.query;

    if (!event_id || !cinema_code) {
      return res.status(400).json({ error: 'event_id and cinema_code are required' });
    }

    // Load cinema info
    const cinemaResult = await db.query(
      `SELECT code, label, showtime, capacity,
              COALESCE(serial_prefix, code) as serial_prefix,
              COALESCE(serial_base, 1) as serial_base
       FROM event_cinemas
       WHERE event_id = $1 AND code = $2`,
      [event_id, cinema_code]
    );

    if (cinemaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cinema not found' });
    }

    const cinema = cinemaResult.rows[0];
    const capacity = parseInt(cinema.capacity);
    const serialBase = parseInt(cinema.serial_base);
    const serialPrefix = cinema.serial_prefix;

    // Load all confirmed reservations with serial assignments for this cinema
    const reservationsResult = await db.query(
      `SELECT buyer_name, chosen_seats, serial_start, serial_end, sold_by_team
       FROM reservations
       WHERE event_id = $1 AND cinema_code = $2
         AND status = 'confirmed'
         AND serial_start IS NOT NULL
         AND serial_end IS NOT NULL
       ORDER BY serial_start ASC`,
      [event_id, cinema_code]
    );

    // Build a map: stubSerial -> { buyer_name, seat, sold_by }
    const stubMap = new Map();

    for (const r of reservationsResult.rows) {
      const serialStart = parseInt(r.serial_start);
      const serialEnd = parseInt(r.serial_end);
      const soldBy = r.sold_by_team === 'liceo' ? 'Liceo' : 'Batch 2003';

      // Parse and sort seats by row letter then number
      const seats = r.chosen_seats
        ? r.chosen_seats.split(',').map(s => s.trim()).filter(Boolean).sort((a, b) => {
            const rowA = a.match(/^[A-O]/)?.[0] || '';
            const rowB = b.match(/^[A-O]/)?.[0] || '';
            if (rowA !== rowB) return rowA.localeCompare(rowB);
            const numA = parseInt(a.slice(1)) || 0;
            const numB = parseInt(b.slice(1)) || 0;
            return numA - numB;
          })
        : [];

      for (let i = serialStart; i <= serialEnd; i++) {
        const seatIndex = i - serialStart;
        stubMap.set(i, {
          buyer_name: r.buyer_name,
          seat: seatIndex < seats.length ? seats[seatIndex] : '',
          sold_by: soldBy
        });
      }
    }

    // Build rows for every stub from serial_base to serial_base + capacity - 1
    const rows = [];
    for (let serial = serialBase; serial < serialBase + capacity; serial++) {
      const stubLabel = `${serialPrefix}-${String(serial).padStart(5, '0')}`;
      const info = stubMap.get(serial);
      rows.push({
        stub: stubLabel,
        seat: info?.seat || '',
        buyer_name: info?.buyer_name || '',
        sold_by: info?.sold_by || ''
      });
    }

    res.json({
      showtime: cinema.showtime,
      label: cinema.label,
      rows
    });
  } catch (err) {
    console.error('Error fetching stubs:', err);
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
