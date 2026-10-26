import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { apiGet, apiPost, apiDelete } from '../api';
import { getSeatMap } from '../data/seatMaps';
import gcashQr from '../images/gcash-qr.png';
import { API_URL } from '../config';
import '../styles/movieScreening.css';

// Sort seats by row letter (A first) then number
function seatSort(a, b) {
  const ra = a.match(/[A-Z]+/)[0], rb = b.match(/[A-Z]+/)[0];
  if (ra !== rb) return ra < rb ? -1 : 1;
  return parseInt(a.replace(/[A-Z]+/, '')) - parseInt(b.replace(/[A-Z]+/, ''));
}

// Format date as "Friday · December 18, 2026"
function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const monthName = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${weekday} · ${monthName} ${day}, ${year}`;
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Basic email validation
function isValidEmail(value) {
  if (!value || !value.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function MovieScreening() {
  // Core data
  const [event, setEvent] = useState(null);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Step flow
  const [step, setStep] = useState(1);
  const [showtime, setShowtime] = useState(null); // selected cinema object
  const [quantity, setQuantity] = useState(1);

  // Step 2: Seats
  const [seats, setSeats] = useState([]); // selected seat IDs
  const [takenSeats, setTakenSeats] = useState(new Set());
  const [mineSeats, setMineSeats] = useState(new Set());
  const [holdToken, setHoldToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes default
  const [seatError, setSeatError] = useState('');
  const [heldCount, setHeldCount] = useState(0);

  // Step 3: Form
  const [buyerName, setBuyerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [soldByTeam, setSoldByTeam] = useState('');
  const [gcashRef, setGcashRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Done / Expired
  const [expired, setExpired] = useState(false);
  const [reservation, setReservation] = useState(null);

  // Refs
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const step1BottomRef = useRef(null);
  const isFirstShowtimeSelect = useRef(true);
  // Refs for leave handlers (must see current values in event listeners)
  const holdTokenRef = useRef(null);
  const stepRef = useRef(1);
  const reservationRef = useRef(null);
  const expiredRef = useRef(false);

  // Fetch active event
  const fetchActiveEvent = useCallback(async () => {
    try {
      const res = await apiGet('/api/movie-screening/active');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load event');
        return;
      }
      setEvent(data.event);
      setCinemas(data.cinemas || []);
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveEvent();
  }, [fetchActiveEvent]);

  // Keep refs in sync with state
  useEffect(() => {
    holdTokenRef.current = holdToken;
  }, [holdToken]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    reservationRef.current = reservation;
  }, [reservation]);

  useEffect(() => {
    expiredRef.current = expired;
  }, [expired]);

  // Release holds on page leave/refresh
  useEffect(() => {
    const shouldRelease = () =>
      stepRef.current >= 2 &&
      holdTokenRef.current &&
      !reservationRef.current &&
      !expiredRef.current;

    const handlePageHide = () => {
      if (shouldRelease()) {
        fetch(`${API_URL}/api/movie-screening/holds/${holdTokenRef.current}`, {
          method: 'DELETE',
          keepalive: true
        });
      }
    };

    const handleBeforeUnload = (e) => {
      if (shouldRelease()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Unmount cleanup: release hold if navigating away via React Router
      if (shouldRelease()) {
        fetch(`${API_URL}/api/movie-screening/holds/${holdTokenRef.current}`, {
          method: 'DELETE',
          keepalive: true
        });
      }
    };
  }, []);

  // Auto-scroll to ticket counter when showtime is selected
  useEffect(() => {
    if (showtime && step === 1) {
      if (isFirstShowtimeSelect.current) {
        isFirstShowtimeSelect.current = false;
      }
      // Scroll after render
      requestAnimationFrame(() => {
        if (step1BottomRef.current) {
          const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          step1BottomRef.current.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
        }
      });
    }
  }, [showtime, step]);

  // Fetch taken seats
  const fetchTakenSeats = useCallback(async () => {
    if (!showtime) return;
    try {
      const url = `/api/movie-screening/seats/taken?cinema_code=${showtime.code}${holdToken ? `&hold_token=${holdToken}` : ''}`;
      const res = await apiGet(url);
      const data = await res.json();
      if (res.ok) {
        setTakenSeats(new Set(data.taken || []));
        setMineSeats(new Set(data.mine || []));
        if (data.expires_at && holdToken) {
          setExpiresAt(new Date(data.expires_at));
        }
      }
    } catch (err) {
      console.error('Error fetching taken seats:', err);
    }
  }, [showtime, holdToken]);

  // Timer countdown
  useEffect(() => {
    if (step < 2 || expired || reservation) return;

    timerRef.current = setInterval(() => {
      if (expiresAt) {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) {
          handleExpired();
        }
      } else {
        setTimeLeft(prev => {
          const next = prev - 1;
          if (next <= 0) {
            handleExpired();
            return 0;
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [step, expiresAt, expired, reservation]);

  // Poll taken seats every 15 seconds on step 2
  useEffect(() => {
    if (step !== 2 || expired) return;

    fetchTakenSeats();
    pollRef.current = setInterval(fetchTakenSeats, 15000);

    return () => clearInterval(pollRef.current);
  }, [step, fetchTakenSeats, expired]);

  // Handle expiration
  const handleExpired = async () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    setExpired(true);
    if (holdToken) {
      try {
        await apiDelete(`/api/movie-screening/holds/${holdToken}`);
      } catch (e) {
        // ignore
      }
    }
  };

  // Handle seat click
  const handleSeatClick = async (seatId) => {
    if (takenSeats.has(seatId) && !mineSeats.has(seatId)) return;

    let newSeats;
    if (seats.includes(seatId)) {
      // Deselect
      newSeats = seats.filter(s => s !== seatId);
    } else if (seats.length >= quantity) {
      // At capacity - drop oldest, add new
      newSeats = [...seats.slice(1), seatId];
    } else {
      // Add
      newSeats = [...seats, seatId];
    }

    setSeats(newSeats);
    setSeatError('');

    // POST holds
    if (newSeats.length > 0) {
      try {
        const res = await apiPost('/api/movie-screening/holds', {
          cinema_code: showtime.code,
          quantity,
          seats: newSeats,
          hold_token: holdToken || undefined
        });

        if (res.status === 410) {
          handleExpired();
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          setSeatError(data.error || 'Failed to hold seats');
          return;
        }

        setHoldToken(data.hold_token);
        setExpiresAt(new Date(data.expires_at));
        setHeldCount(data.held?.length || 0);

        // Handle unavailable seats
        if (data.unavailable && data.unavailable.length > 0) {
          const unavailableSet = new Set(data.unavailable);
          const validSeats = newSeats.filter(s => !unavailableSet.has(s));
          setSeats(validSeats);
          setTakenSeats(prev => new Set([...prev, ...data.unavailable]));
          setSeatError(`Seat ${data.unavailable[0]} was just taken. Please pick another.`);
        }
      } catch (err) {
        console.error('Error creating hold:', err);
        setSeatError('Connection error');
      }
    }
  };

  // Go to step 2
  const goToStep2 = () => {
    setStep(2);
    setSeats([]);
    setHoldToken(null);
    setExpiresAt(null);
    setTimeLeft(600);
    setHeldCount(0);
    setSeatError('');
  };

  // Change showtime (back from step 2)
  const changeShowtime = async () => {
    if (holdToken) {
      try {
        await apiDelete(`/api/movie-screening/holds/${holdToken}`);
      } catch (e) {
        // ignore
      }
    }
    setStep(1);
    setSeats([]);
    setHoldToken(null);
    setExpiresAt(null);
    setHeldCount(0);
    clearInterval(pollRef.current);
  };

  // Go to step 3
  const goToStep3 = () => {
    setStep(3);
    setSubmitError('');
  };

  // Back to seats
  const backToSeats = () => {
    setStep(2);
    setSubmitError('');
  };

  // Submit reservation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    try {
      const res = await apiPost('/api/movie-screening/reserve', {
        cinema_code: showtime.code,
        buyer_name: buyerName.trim(),
        email: email.trim().toLowerCase(),
        mobile: phone.trim() || null,
        quantity,
        gcash_ref: gcashRef.trim(),
        hold_token: holdToken,
        sold_by_team: soldByTeam
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.error?.toLowerCase().includes('expired')) {
          handleExpired();
          return;
        }
        setSubmitError(data.error || 'Failed to submit reservation');
        setSubmitting(false);
        return;
      }

      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
      setReservation(data);
    } catch (err) {
      console.error(err);
      setSubmitError('Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  // Start again after expiry
  const startAgain = async () => {
    setExpired(false);
    setStep(1);
    setSeats([]);
    setHoldToken(null);
    setExpiresAt(null);
    setTimeLeft(600);
    setHeldCount(0);
    await fetchActiveEvent();
  };

  // Make another reservation
  const makeAnother = async () => {
    setReservation(null);
    setStep(1);
    setShowtime(null);
    setQuantity(1);
    setSeats([]);
    setHoldToken(null);
    setExpiresAt(null);
    setTimeLeft(600);
    setHeldCount(0);
    setBuyerName('');
    setEmail('');
    setPhone('');
    setSoldByTeam('');
    setGcashRef('');
    setSubmitError('');
    await fetchActiveEvent();
  };

  // Format timer
  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Get first name
  const getFirstName = (name) => {
    if (!name) return '';
    return name.trim().split(/\s+/)[0];
  };

  // Sorted seat list
  const sortedSeats = [...seats].sort(seatSort);

  // Form validation for step 3
  const isFormValid = buyerName.trim() && isValidEmail(email) && soldByTeam && gcashRef.trim();

  // Loading
  if (loading) {
    return (
      <div className="ms-page">
        <div className="ms-loading">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // No event
  if (!event) {
    return (
      <div className="ms-page">
        <div className="ms-container">
          <div className="ms-no-event">
            <h2>Block Screening</h2>
            <p>No active screening event at this time.</p>
            <Link to="/" className="ms-back-link">Back to Home</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // DONE screen
  if (reservation) {
    const soldByLabel = reservation.sold_by_team === 'batch2003' ? 'USLS-IS Batch 2003' : 'Liceo Student Government';
    return (
      <div className="ms-page">
        <div className="ms-container">
          {/* Print-only header */}
          <div className="ms-print-header">
            <div className="ms-print-brand">USLS-IS BATCH 2003 · BLOCK SCREENING</div>
            <div className="ms-print-title">{event.title}</div>
            <div className="ms-print-meta">{formatEventDate(event.event_date)} · {event.venue}</div>
          </div>

          <div className="ms-done-card">
            <h2 className="ms-done-heading">Reservation received</h2>
            <p className="ms-done-thanks">Thank you, <strong>{getFirstName(buyerName)}</strong>!</p>
            <p className="ms-done-text">We will verify your payment within 48 hours and send your confirmation to {email}.</p>

            <div className="ms-done-grid">
              <div className="ms-done-item">
                <span className="ms-done-label">Name</span>
                <span className="ms-done-value">{reservation.buyer_name}</span>
              </div>
              <div className="ms-done-item">
                <span className="ms-done-label">Showtime</span>
                <span className="ms-done-value">{showtime.label} · {showtime.showtime}</span>
              </div>
              <div className="ms-done-item">
                <span className="ms-done-label">Tickets</span>
                <span className="ms-done-value">{quantity}</span>
              </div>
              <div className="ms-done-item">
                <span className="ms-done-label">Seats</span>
                <span className="ms-done-value">{sortedSeats.join(', ')}</span>
              </div>
              <div className="ms-done-item">
                <span className="ms-done-label">Total</span>
                <span className="ms-done-value">₱{formatCurrency(reservation.total_amount)}</span>
              </div>
              <div className="ms-done-item">
                <span className="ms-done-label">Reference</span>
                <span className="ms-done-value">{reservation.gcash_ref}</span>
              </div>
              <div className="ms-done-item">
                <span className="ms-done-label">Sold by</span>
                <span className="ms-done-value">{soldByLabel}</span>
              </div>
            </div>

            <div className="ms-done-actions ms-no-print">
              <button className="ms-btn-primary" onClick={() => window.print()}>
                Print or save as PDF
              </button>
              <button className="ms-btn-text" onClick={makeAnother}>
                Make another reservation
              </button>
            </div>
          </div>

          {/* Print-only footer */}
          <div className="ms-print-footer">
            Pending payment verification. Present this receipt or your confirmation email when claiming your tickets.
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // EXPIRED screen
  if (expired) {
    return (
      <div className="ms-page">
        <div className="ms-container">
          <div className="ms-expired-card">
            <h2 className="ms-expired-heading">Time is up</h2>
            <p className="ms-expired-text">Your seats were released so others can choose them. You can start again anytime.</p>
            <button className="ms-btn-primary" onClick={startAgain}>
              Start again
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Get seat map for selected showtime
  const seatMap = showtime ? getSeatMap(showtime.layout) : null;

  return (
    <div className="ms-page">
      <div className="ms-container">
        {/* Film strip top */}
        <div className="ms-film-strip" aria-hidden="true"></div>

        {/* HERO */}
        <div className="ms-hero">
          <div className="ms-hero-glow"></div>
          <div className="ms-hero-content">
            <div className="ms-pill">USLS-IS BATCH 2003 · BLOCK SCREENING</div>
            <div className="ms-title-wrap">
              <div className="ms-title-bar"></div>
              <h1 className="ms-title">{event.title}</h1>
            </div>
            <div className="ms-date-line">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>{formatEventDate(event.event_date)}</span>
            </div>
            <div className="ms-venue-line">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>{event.venue}</span>
            </div>
          </div>
        </div>

        {/* Film strip bottom */}
        <div className="ms-film-strip" aria-hidden="true"></div>

        {/* INCLUSIONS */}
        <div className="ms-inclusions">
          <div className="ms-inclusions-glow"></div>
          <div className="ms-inclusions-line1">
            <svg className="ms-ticket-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
              <path d="M13 5v2"></path><path d="M13 17v2"></path><path d="M13 11v2"></path>
            </svg>
            <strong>Inclusions</strong>
            <span> · your movie stub, popcorn, and a drink.</span>
          </div>
          <div className="ms-inclusions-line2">Choose your showtime and seats below.</div>
        </div>

        {/* PROGRESS */}
        <div className="ms-progress">
          <div className={`ms-progress-step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`}>
            1 · Showtime
          </div>
          <div className={`ms-progress-step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`}>
            2 · Seats
          </div>
          <div className={`ms-progress-step ${step >= 3 ? 'active' : ''}`}>
            3 · Details and payment
          </div>
        </div>

        {error && <p className="ms-error">{error}</p>}

        {/* STEP 1: SHOWTIME */}
        {step === 1 && (
          <div className="ms-card">
            <h2 className="ms-card-heading">Choose your showtime</h2>

            <div className="ms-showtime-grid">
              {cinemas.map((cinema) => (
                <button
                  key={cinema.code}
                  type="button"
                  className={`ms-showtime-card ${showtime?.code === cinema.code ? 'selected' : ''} ${cinema.seats_left === 0 ? 'disabled' : ''}`}
                  onClick={() => {
                    if (cinema.seats_left > 0) {
                      setShowtime(cinema);
                      setQuantity(1);
                    }
                  }}
                  disabled={cinema.seats_left === 0}
                >
                  <div className="ms-showtime-time">{cinema.showtime}</div>
                  <div className="ms-showtime-label">{cinema.label}</div>
                  <div className="ms-showtime-seats">
                    {cinema.seats_left === 0 ? 'Sold out' : `${cinema.seats_left} seats left`}
                  </div>
                  <div className="ms-showtime-divider"></div>
                  <div className="ms-showtime-price">₱{formatCurrency(cinema.unit_price)}</div>
                </button>
              ))}
            </div>

            {showtime && (
              <div className="ms-step1-bottom" ref={step1BottomRef}>
                <div className="ms-qty-row">
                  <span className="ms-qty-label">Tickets</span>
                  <div className="ms-qty-controls">
                    <button
                      type="button"
                      className="ms-qty-btn"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                    >
                      −
                    </button>
                    <span className="ms-qty-value">{quantity}</span>
                    <button
                      type="button"
                      className="ms-qty-btn"
                      onClick={() => setQuantity(q => Math.min(showtime.seats_left, q + 1))}
                      disabled={quantity >= showtime.seats_left}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="ms-total-row">
                  <span>Total</span>
                  <span className="ms-total-amount">₱{formatCurrency(showtime.unit_price * quantity)}</span>
                </div>

                <button type="button" className="ms-btn-primary" onClick={goToStep2}>
                  Choose seats
                </button>

                <p className="ms-step1-note">
                  You will have 10 minutes to choose your seats and complete payment.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: SEATS */}
        {step === 2 && seatMap && (
          <div className="ms-card">
            <div className="ms-step2-header">
              <div>
                <h2 className="ms-card-heading">
                  Choose {quantity} seat{quantity > 1 ? 's' : ''}
                </h2>
                <p className="ms-step2-subline">{showtime.label} · {showtime.showtime}</p>
              </div>
              <div className={`ms-timer ${timeLeft <= 60 ? 'warning' : ''}`}>
                Seats held for {formatTimer(timeLeft)}
              </div>
              <p className="ms-hold-warning">
                Refreshing or leaving this page will release your seats.
              </p>
            </div>

            {seatError && <p className="ms-seat-error">{seatError}</p>}

            <div className="ms-seat-scroll">
              <div className="ms-seat-grid">
                {seatMap.rows.map((row) => (
                  <div key={row.letter} className="ms-seat-row">
                    <div className="ms-row-label">{row.letter}</div>
                    {Array.from({ length: seatMap.cols }, (_, i) => i + 1).map((col) => {
                      const seatNum = row.cols[col];
                      if (seatNum === undefined) {
                        return <div key={col} className="ms-seat-cell"></div>;
                      }
                      const seatId = `${row.letter}${seatNum}`;
                      const isTaken = takenSeats.has(seatId) && !mineSeats.has(seatId);
                      const isSelected = seats.includes(seatId);
                      const ariaLabel = `Seat ${seatId} ${isTaken ? 'taken' : isSelected ? 'selected' : 'available'}`;

                      return (
                        <div key={col} className="ms-seat-cell">
                          <button
                            type="button"
                            className={`ms-seat ${isTaken ? 'taken' : ''} ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSeatClick(seatId)}
                            disabled={isTaken}
                            aria-label={ariaLabel}
                          >
                            {seatNum}
                          </button>
                        </div>
                      );
                    })}
                    <div className="ms-row-label">{row.letter}</div>
                  </div>
                ))}

                {/* Screen indicator */}
                <div className="ms-screen-wrap">
                  <div className="ms-screen-bar"></div>
                  <div className="ms-screen-label">SCREEN</div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="ms-legend">
              <div className="ms-legend-item">
                <span className="ms-legend-swatch available"></span>
                <span>Available</span>
              </div>
              <div className="ms-legend-item">
                <span className="ms-legend-swatch selected"></span>
                <span>Your seats</span>
              </div>
              <div className="ms-legend-item">
                <span className="ms-legend-swatch taken"></span>
                <span>Taken</span>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="ms-step2-bottom">
              <div className="ms-selected-info">
                <span>Selected {seats.length} of {quantity}</span>
                <span className="ms-selected-list">
                  {sortedSeats.length > 0 ? sortedSeats.join(', ') : 'None yet'}
                </span>
              </div>
              <div className="ms-step2-actions">
                <button type="button" className="ms-btn-text" onClick={changeShowtime}>
                  Change showtime
                </button>
                <button
                  type="button"
                  className="ms-btn-primary"
                  onClick={goToStep3}
                  disabled={heldCount !== quantity}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DETAILS AND PAYMENT */}
        {step === 3 && (
          <div className="ms-card">
            <div className="ms-step3-header">
              <div>
                <h2 className="ms-card-heading">Your details and payment</h2>
                <p className="ms-step3-subline">{showtime.label} · {showtime.showtime} · Seats {sortedSeats.join(', ')}</p>
              </div>
              <div className={`ms-timer ${timeLeft <= 60 ? 'warning' : ''}`}>
                Seats held for {formatTimer(timeLeft)}
              </div>
              <p className="ms-hold-warning">
                Refreshing or leaving this page will release your seats.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="ms-form">
              <div className="ms-field">
                <label className="ms-label" htmlFor="buyerName">Full name</label>
                <input
                  id="buyerName"
                  type="text"
                  className="ms-input"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  required
                />
              </div>

              <div className="ms-field">
                <label className="ms-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="ms-input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="ms-field">
                <label className="ms-label" htmlFor="phone">Phone (optional)</label>
                <input
                  id="phone"
                  type="tel"
                  className="ms-input"
                  placeholder="+63 917 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <span className="ms-field-helper">Any country is fine. Include your country code.</span>
              </div>

              <fieldset className="ms-fieldset">
                <legend className="ms-legend-text">Who sold you this ticket?</legend>
                <div className="ms-radio-group">
                  <label className="ms-radio">
                    <input
                      type="radio"
                      name="soldBy"
                      value="batch2003"
                      checked={soldByTeam === 'batch2003'}
                      onChange={(e) => setSoldByTeam(e.target.value)}
                    />
                    <span>USLS-IS Batch 2003</span>
                  </label>
                  <label className="ms-radio">
                    <input
                      type="radio"
                      name="soldBy"
                      value="liceo"
                      checked={soldByTeam === 'liceo'}
                      onChange={(e) => setSoldByTeam(e.target.value)}
                    />
                    <span>Liceo Student Government</span>
                  </label>
                </div>
              </fieldset>

              <div className="ms-payment-box">
                <img src={gcashQr} alt="GCash QR Code" className="ms-gcash-qr" />

                <div className="ms-payment-amount">
                  <span className="ms-payment-label">Amount to send</span>
                  <span className="ms-payment-total">₱{formatCurrency(showtime.unit_price * quantity)}</span>
                  <span className="ms-payment-breakdown">
                    {quantity} ticket{quantity > 1 ? 's' : ''} × ₱{formatCurrency(showtime.unit_price)}
                  </span>
                </div>

                <div className="ms-gcash-details">
                  <div>GCash name: <strong>{event.gcash_name}</strong></div>
                  <div>GCash number: <strong>{event.gcash_number}</strong></div>
                </div>
              </div>

              <div className="ms-field">
                <label className="ms-label" htmlFor="gcashRef">GCash reference number</label>
                <input
                  id="gcashRef"
                  type="text"
                  className="ms-input"
                  value={gcashRef}
                  onChange={(e) => setGcashRef(e.target.value)}
                  required
                />
              </div>

              {submitError && <p className="ms-submit-error">{submitError}</p>}

              <div className="ms-step3-actions">
                <button type="button" className="ms-btn-text" onClick={backToSeats}>
                  Back to seats
                </button>
                <button
                  type="submit"
                  className="ms-btn-primary"
                  disabled={!isFormValid || submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit reservation'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
