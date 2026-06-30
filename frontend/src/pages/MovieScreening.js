import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';
import { apiGet, apiPost } from '../api';
import '../styles/movieScreening.css';
import gcashQr from '../images/gcash-qr.png';

export default function MovieScreening() {
  const { theme, toggleTheme } = useTheme();
  const [event, setEvent] = useState(null);
  const [cinemas, setCinemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [buyerName, setBuyerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCinema, setSelectedCinema] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [gcashRef, setGcashRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [reservation, setReservation] = useState(null);

  // Validation errors
  const [mobileError, setMobileError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [contactError, setContactError] = useState('');

  // Refs
  const ticketFieldRef = useRef(null);
  const mobileInputRef = useRef(null);

  // Copy feedback
  const [gcashCopied, setGcashCopied] = useState(false);

  // Privacy disclosure toggle
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // Normalize and validate Philippine mobile number
  const normalizePHMobile = (value) => {
    if (!value || !value.trim()) return null;

    // Remove spaces, dashes, parentheses
    let normalized = value.replace(/[\s\-()]/g, '');

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
  const isValidEmail = (value) => {
    if (!value || !value.trim()) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  // Validate mobile on blur
  const handleMobileBlur = () => {
    if (mobile.trim()) {
      const result = normalizePHMobile(mobile);
      if (result === false) {
        setMobileError('Enter a valid PH mobile, e.g. 09171234567');
      } else {
        setMobileError('');
      }
    } else {
      setMobileError('');
    }
  };

  // Validate email on blur
  const handleEmailBlur = () => {
    if (email.trim()) {
      if (!isValidEmail(email)) {
        setEmailError('Enter a valid email address');
      } else {
        setEmailError('');
      }
    } else {
      setEmailError('');
    }
  };

  // Copy GCash number to clipboard (stripped of spaces)
  const copyGcashNumber = async () => {
    if (!event?.gcash_number) return;
    const rawNumber = event.gcash_number.replace(/\s/g, '');
    try {
      await navigator.clipboard.writeText(rawNumber);
      setGcashCopied(true);
      setTimeout(() => setGcashCopied(false), 1500);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = rawNumber;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setGcashCopied(true);
      setTimeout(() => setGcashCopied(false), 1500);
    }
  };

  useEffect(() => {
    fetchActiveEvent();
  }, []);

  const fetchActiveEvent = async () => {
    try {
      const res = await apiGet('/api/movie-screening/active');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load event');
        return;
      }

      setEvent(data.event);
      // Sort cinemas so Cinema 3 comes first
      const sortedCinemas = (data.cinemas || []).sort((a, b) => {
        if (a.code === 'C3') return -1;
        if (b.code === 'C3') return 1;
        return a.code.localeCompare(b.code);
      });
      setCinemas(sortedCinemas);
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const selectedCinemaData = cinemas.find(c => c.code === selectedCinema);
  const maxQuantity = selectedCinemaData?.seats_left || 0;
  const unitPrice = selectedCinemaData?.unit_price || 0;
  const totalAmount = unitPrice * quantity;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setContactError('');

    // Ensure at least one contact method is provided
    if (!mobile.trim() && !email.trim()) {
      setContactError('Enter your mobile number or email so we can reach you.');
      mobileInputRef.current?.focus();
      return;
    }

    // Validate mobile if provided
    let normalizedMobile = null;
    if (mobile.trim()) {
      const result = normalizePHMobile(mobile);
      if (result === false) {
        setMobileError('Enter a valid PH mobile, e.g. 09171234567');
        return;
      }
      normalizedMobile = result;
    }

    // Validate email if provided
    let normalizedEmail = null;
    if (email.trim()) {
      if (!isValidEmail(email)) {
        setEmailError('Enter a valid email address');
        return;
      }
      normalizedEmail = email.trim().toLowerCase();
    }

    setSubmitting(true);

    try {
      const res = await apiPost('/api/movie-screening/reserve', {
        cinema_code: selectedCinema,
        buyer_name: buyerName,
        mobile: normalizedMobile,
        email: normalizedEmail,
        quantity: parseInt(quantity),
        gcash_ref: gcashRef
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit reservation');
      }

      setReservation(data);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDateHero = (dateStr) => {
    if (!dateStr) return '';
    // Parse YYYY-MM-DD directly to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const monthName = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
    return `${weekday} · ${monthName} ${day}, ${year}`;
  };

  // Derive cinema name from code (C3 -> "Cinema 3", C4 -> "Cinema 4")
  const getCinemaName = (code) => {
    if (!code) return '';
    const match = code.match(/^C(\d+)$/);
    return match ? `Cinema ${match[1]}` : code;
  };

  if (loading) {
    return (
      <div className="ms-page">
        <div className="ms-loading">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="ms-page">
        <div className="ms-container">
          <div className="ms-no-event">
            <h2>Movie Screening</h2>
            <p>No active screening event at this time.</p>
            <Link to="/" className="ms-back-link">Back to Home</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (submitted && reservation) {
    const qty = reservation.quantity;
    const ticketWord = qty === 1 ? 'ticket' : 'tickets';
    const numWord = qty === 1 ? 'ticket number' : 'ticket numbers';
    const isAre = qty === 1 ? 'is' : 'are';
    const stubVoucher = qty === 1 ? 'your movie stub and food voucher' : 'your movie stubs and food vouchers';

    return (
      <div className="ms-page">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="ms-theme-toggle ms-no-print"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div className="ms-container">
          <div className="ms-confirmation">
            <div className="ms-confirm-icon">✓</div>
            <h2 className="ms-confirm-title">Purchase Received!</h2>
            <p className="ms-confirm-subtitle">Thank you, {reservation.buyer_name}!</p>

            <div className="ms-order-summary">
              <div className="ms-receipt-header">
                <div className="ms-receipt-batch">USLS-IS Batch 2003 · Movie Screening</div>
                <div className="ms-receipt-title">{event.title}</div>
                <div className="ms-receipt-meta">{formatDateHero(event.event_date)}</div>
                <div className="ms-receipt-meta">Ayala Malls Capitol Central · Bacolod</div>
              </div>
              <h3>Order Summary</h3>
              <div className="ms-order-row">
                <span>Name</span>
                <span>{reservation.buyer_name}</span>
              </div>
              <div className="ms-order-row">
                <span>Cinema</span>
                <span>{getCinemaName(reservation.cinema_code)} · {selectedCinemaData?.label}</span>
              </div>
              <div className="ms-order-row">
                <span>Showtime</span>
                <span>{selectedCinemaData?.showtime}</span>
              </div>
              <div className="ms-order-row">
                <span>Tickets</span>
                <span>{qty} {ticketWord}</span>
              </div>
              <div className="ms-order-row">
                <span>Total Paid</span>
                <span className="ms-order-total">{formatCurrency(reservation.total_amount)}</span>
              </div>
              <div className="ms-order-row">
                <span>Reference No.</span>
                <span className="ms-order-ref">{reservation.gcash_ref}</span>
              </div>
              <p className="ms-pending-note">
                This confirms your order is received and pending verification. Your official {numWord} will be sent within 24 hours.
              </p>

              <div className="ms-what-next">
                <h4>What happens next?</h4>
                <ul>
                  <li>Wait 24 hours for payment verification.</li>
                  <li>A committee member will message your {numWord}.</li>
                  <li>Your {numWord} {isAre} {stubVoucher} onsite.</li>
                  <li>A committee member will let you know where to pick up your printed {ticketWord}.</li>
                  <li>Raffle and merch sold separately onsite.</li>
                  {qty >= 20 && (
                    <li className="ms-highlight">A committee member will contact you to pick seats.</li>
                  )}
                </ul>
              </div>

              <p className="ms-support-email">
                Questions? Email us at{' '}
                <a href="mailto:uslsis.batch2003@gmail.com">uslsis.batch2003@gmail.com</a>
              </p>
            </div>

            <button
              type="button"
              className="ms-print-btn ms-no-print"
              onClick={() => window.print()}
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="ms-page">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="ms-theme-toggle ms-no-print"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="ms-container">
        {/* Film strip top */}
        <div className="ms-film-strip"></div>

      {/* Hero Banner */}
      <div className="ms-hero">
        <div className="ms-hero-content">
          <div className="ms-pill">USLS-IS BATCH 2003 · MOVIE SCREENING</div>
          <h1 className="ms-movie-title" style={{ color: '#FDF8EE' }}>{event.title}</h1>

          <div className="ms-meta">
            <div className="ms-meta-date">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CFB53B" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span style={{ color: '#CFB53B' }}>{formatDateHero(event.event_date)}</span>
            </div>
            {event.venue && (
              <div className="ms-meta-venue">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c2ccc4" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span style={{ color: '#c2ccc4' }}>Ayala Malls Capitol Central · Bacolod</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Film strip bottom */}
      <div className="ms-film-strip"></div>

      {/* Form Section */}
      <div className="ms-form-section">
        <div className="ms-form-container">
          {error && <p className="ms-error">{error}</p>}
          {submitError && <p className="ms-error">{submitError}</p>}

          {/* Inclusions - lead-in to the form */}
          <div className="ms-form-inclusions">
            <p className="ms-form-inclusion-line">
              <strong>Inclusions</strong> · every ticket includes your movie stub plus food and drinks.
            </p>
            <p className="ms-form-separate-line">Raffle and merch sold separately onsite.</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Cinema Selection - FIRST interactive step */}
            <div className="ms-field">
              <label className="ms-label">SELECT CINEMA & SHOWTIME <span className="ms-req">*</span></label>
              <div className="ms-cinema-cards">
                {cinemas.map((cinema) => (
                  <div
                    key={cinema.code}
                    className={`ms-cinema-card ${selectedCinema === cinema.code ? 'selected' : ''} ${cinema.seats_left === 0 ? 'sold-out' : ''}`}
                    onClick={() => {
                      if (cinema.seats_left > 0) {
                        setSelectedCinema(cinema.code);
                        setQuantity(1);
                        // Scroll to ticket field after state updates
                        setTimeout(() => {
                          ticketFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }
                    }}
                  >
                    {selectedCinema === cinema.code && (
                      <div className="ms-check-badge">✓</div>
                    )}
                    <div className="ms-cinema-name">{getCinemaName(cinema.code)}</div>
                    <div className="ms-cinema-type">{cinema.label}</div>
                    <div className="ms-cinema-showtime">
                      <svg className="ms-clock-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      {cinema.showtime}
                    </div>
                    <div className="ms-cinema-price">{formatCurrency(cinema.unit_price)}</div>
                    <div className="ms-cinema-seats">
                      {cinema.seats_left === 0 ? 'SOLD OUT' : `${cinema.seats_left} seats left`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedCinema && (
              <>
                {/* Number of Tickets */}
                <div className="ms-field" ref={ticketFieldRef}>
                  <label className="ms-label">NUMBER OF TICKETS <span className="ms-req">*</span></label>
                  <select
                    className="ms-ticket-select"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    required
                  >
                    {Array.from({ length: Math.min(maxQuantity, 50) }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <div className={`ms-seats-badge ${maxQuantity > 40 ? 'ms-seats-plenty' : 'ms-seats-low'}`}>
                    {maxQuantity > 40 ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 11a2 2 0 0 1 2 2v2h10v-2a2 2 0 1 1 4 0v4a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z"></path>
                          <path d="M5 11v-5a3 3 0 0 1 3 -3h8a3 3 0 0 1 3 3v5"></path>
                        </svg>
                        <span>{maxQuantity} seats available</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 12c2 -2.96 0 -7 -1 -8c0 3.038 -1.773 4.741 -3 6c-1.226 1.26 -2 3.24 -2 5a6 6 0 1 0 12 0c0 -1.532 -1.056 -3.94 -2 -5c-1.786 3 -2.791 3 -4 2z"></path>
                        </svg>
                        <span>Only {maxQuantity} seats left!</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 20+ Seat Choice Note */}
                {quantity >= 20 && (
                  <div className="ms-seat-note">
                    For orders of 20+ tickets, you can choose your seats. A committee member will contact you after your purchase is verified.
                  </div>
                )}

                {/* Total */}
                <div className="ms-total-box">
                  <span className="ms-total-label">Total</span>
                  <span className="ms-total-amount">{formatCurrency(totalAmount)}</span>
                </div>

                {/* Full Name */}
                <div className="ms-field">
                  <label className="ms-label">FULL NAME <span className="ms-req">*</span></label>
                  <input
                    type="text"
                    className="ms-input"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                {/* Contact Row */}
                <div className="ms-field">
                  <label className="ms-label">MOBILE NUMBER OR EMAIL <span className="ms-req">*</span></label>
                  <p className="ms-contact-purpose">
                    At least one required — mobile if you're in the Philippines, email if abroad.
                  </p>
                  <p className="ms-contact-purpose">
                    We'll message your {quantity === 1 ? 'ticket number' : 'ticket numbers'} here within 24 hours of verifying your payment, so please make sure it's correct.
                  </p>
                  <button
                    type="button"
                    className={`ms-privacy-toggle ${privacyOpen ? 'open' : ''}`}
                    onClick={() => setPrivacyOpen(!privacyOpen)}
                  >
                    <span className="ms-privacy-chevron">▸</span>
                    Data privacy
                  </button>
                  <div className={`ms-privacy-content ${privacyOpen ? 'open' : ''}`}>
                    <p>
                      By providing your contact information, you consent to the collection and use of your personal information by USLS-IS Batch 2003 in accordance with the Data Privacy Act of 2012 (R.A. 10173). Your information will only be used for purposes related to this movie screening fundraiser and will not be shared with third parties or used for commercial purposes.
                    </p>
                  </div>
                  {contactError && <span className="ms-field-error">{contactError}</span>}
                </div>
                <div className="ms-field-row">
                  <div className="ms-field">
                    <label className="ms-label-secondary">MOBILE NUMBER</label>
                    <input
                      ref={mobileInputRef}
                      type="tel"
                      className={`ms-input ${mobileError || contactError ? 'ms-input-error' : ''}`}
                      value={mobile}
                      onChange={(e) => {
                        setMobile(e.target.value);
                        if (mobileError) setMobileError('');
                        if (contactError) setContactError('');
                      }}
                      onBlur={handleMobileBlur}
                      placeholder="+63 or 09XX"
                    />
                    {mobileError && <span className="ms-field-error">{mobileError}</span>}
                  </div>
                  <div className="ms-field">
                    <label className="ms-label-secondary">EMAIL ADDRESS</label>
                    <input
                      type="email"
                      className={`ms-input ${emailError || contactError ? 'ms-input-error' : ''}`}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError('');
                        if (contactError) setContactError('');
                      }}
                      onBlur={handleEmailBlur}
                      placeholder="your@email.com"
                    />
                    {emailError && <span className="ms-field-error">{emailError}</span>}
                  </div>
                </div>

                {/* GCash Box */}
                <div className="ms-gcash-box">
                  <div className="ms-gcash-header">
                    <span className="ms-gcash-logo">GCash</span>
                    <span className="ms-gcash-amount">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="ms-gcash-divider"></div>
                  <div className="ms-gcash-details">
                    <div className="ms-gcash-row">
                      <span className="ms-gcash-label">Number</span>
                      <span className="ms-gcash-value">
                        {event.gcash_number}
                        <button
                          type="button"
                          className="ms-copy-btn"
                          onClick={copyGcashNumber}
                          aria-label="Copy GCash number"
                        >
                          {gcashCopied ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              <span className="ms-copy-text">Copied!</span>
                            </>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          )}
                        </button>
                      </span>
                    </div>
                    <div className="ms-gcash-row">
                      <span className="ms-gcash-label">Name</span>
                      <span className="ms-gcash-value">{event.gcash_name}</span>
                    </div>
                  </div>
                  <img src={gcashQr} alt="GCash QR Code" className="ms-gcash-qr" />
                  <p className="ms-gcash-instruction">
                    Send the exact amount, then paste your reference number below.
                  </p>
                </div>

                {/* GCash Reference */}
                <div className="ms-field">
                  <label className="ms-label">REFERENCE NUMBER <span className="ms-req">*</span></label>
                  <span className="ms-hint">(we use this to confirm your payment)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="ms-input"
                    value={gcashRef}
                    onChange={(e) => setGcashRef(e.target.value)}
                    placeholder="Paste your reference number"
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="ms-submit-btn"
                  disabled={submitting || !buyerName || (!mobile && !email) || !gcashRef || mobileError || emailError}
                >
                  {submitting ? 'Processing...' : 'Purchase tickets'}
                </button>

                <p className="ms-support-email">
                  Questions? Email us at{' '}
                  <a href="mailto:uslsis.batch2003@gmail.com">uslsis.batch2003@gmail.com</a>
                </p>
              </>
            )}
          </form>
        </div>
      </div>
      </div>

      <Footer />
    </div>
  );
}
