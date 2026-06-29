import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import { apiGet, apiPost } from '../api';
import '../styles/movieScreening.css';

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
    setSubmitting(true);

    try {
      const res = await apiPost('/api/movie-screening/reserve', {
        cinema_code: selectedCinema,
        buyer_name: buyerName,
        mobile: mobile || null,
        email: email || null,
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="movie-screening-page">
        <div className="container">
          <div className="card">
            <p>Loading...</p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="movie-screening-page">
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>
        <div className="container">
          <div className="card card-narrow">
            <img src={logo} alt="USLS Logo" className="logo" />
            <h1 className="page-title-gold">
              University of St. La Salle<br />IS 2003
            </h1>
            <h2 style={{ textAlign: 'center', marginTop: '20px', color: '#006633' }}>Movie Screening</h2>
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '16px' }}>
              No active screening event at this time.
            </p>
            <p style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link to="/" className="btn-link">Back to Home</Link>
            </p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  if (submitted && reservation) {
    return (
      <div className="movie-screening-page">
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>
        <div className="container">
          <div className="card movie-screening-card">
            <img src={logo} alt="USLS Logo" className="logo" />
            <h1 className="page-title-gold">
              University of St. La Salle<br />IS 2003
            </h1>

            <div className="confirmation-box">
              <div className="confirmation-check">✓</div>
              <h2 className="confirmation-title">Purchase Received!</h2>
              <p className="confirmation-subtitle">
                Thank you, {reservation.buyer_name}!
              </p>
            </div>

            <div className="order-summary">
              <h3>Order Summary</h3>
              <div className="order-detail">
                <span>Cinema:</span>
                <span>{selectedCinemaData?.label}</span>
              </div>
              <div className="order-detail">
                <span>Tickets:</span>
                <span>{reservation.quantity}</span>
              </div>
              <div className="order-detail">
                <span>Total Paid:</span>
                <span className="order-total">{formatCurrency(reservation.total_amount)}</span>
              </div>
              <div className="order-detail">
                <span>GCash Ref:</span>
                <span className="gcash-ref-display">{reservation.gcash_ref}</span>
              </div>
            </div>

            <div className="what-next">
              <h3>What happens next?</h3>
              <ul>
                <li>Wait 24 hours for payment verification.</li>
                <li>Coycoy messages your ticket numbers (your movie stub and food voucher onsite).</li>
                <li>Pick up your printed tickets from Apol, she matches your numbers.</li>
                <li>Raffle and merch sold separately onsite.</li>
                {quantity >= 20 && (
                  <li className="highlight-note">Felie contacts you to pick seats.</li>
                )}
              </ul>
            </div>

            <p style={{ textAlign: 'center', marginTop: '32px' }}>
              <Link to="/" className="btn-link">Back to Home</Link>
            </p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="movie-screening-page">
      <button
        onClick={toggleTheme}
        className="theme-toggle"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
      </button>
      <div className="container">
        <div className="card movie-screening-card">
          <img src={logo} alt="USLS Logo" className="logo" />
          <h1 className="page-title-gold">
            University of St. La Salle<br />IS 2003
          </h1>

          <div className="event-header">
            <h2 className="event-title">{event.title}</h2>
            {event.subtitle && <p className="event-subtitle">{event.subtitle}</p>}
            <p className="event-details">
              <span className="event-date">{formatDate(event.event_date)}</span>
              {event.venue && <span className="event-venue">{event.venue}</span>}
            </p>
          </div>

          <div className="inclusion-note">
            Every ticket includes your movie stub plus food and drinks. Raffle tickets and merch are sold separately onsite.
          </div>

          {error && <p className="error">{error}</p>}
          {submitError && <p className="error">{submitError}</p>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name <span className="required">*</span></label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Mobile Number</label>
                <span className="form-hint">if in the Philippines</span>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+63 or 09XX"
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <span className="form-hint">if outside the Philippines</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Select Cinema <span className="required">*</span></label>
              <div className="cinema-cards">
                {cinemas.map((cinema) => (
                  <div
                    key={cinema.code}
                    className={`cinema-card ${selectedCinema === cinema.code ? 'selected' : ''} ${cinema.seats_left === 0 ? 'sold-out' : ''}`}
                    onClick={() => cinema.seats_left > 0 && setSelectedCinema(cinema.code)}
                  >
                    <div className="cinema-label">{cinema.label}</div>
                    <div className="cinema-showtime">{cinema.showtime}</div>
                    <div className="cinema-price">{formatCurrency(cinema.unit_price)}</div>
                    <div className={`cinema-seats ${cinema.seats_left <= 20 ? 'low' : ''}`}>
                      {cinema.seats_left === 0 ? 'SOLD OUT' : `${cinema.seats_left} seats left`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedCinema && (
              <>
                <div className="form-group">
                  <label>Number of Tickets <span className="required">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max={maxQuantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(Math.max(1, parseInt(e.target.value) || 1), maxQuantity))}
                    required
                  />
                  <span className="form-hint">Max {maxQuantity} tickets available</span>
                </div>

                {quantity >= 20 && (
                  <div className="seat-choice-note">
                    For orders of 20+ tickets, you can choose your seats. Felie will contact you after your purchase is verified.
                  </div>
                )}

                <div className="total-display">
                  <span>Total:</span>
                  <span className="total-amount">{formatCurrency(totalAmount)}</span>
                </div>

                <div className="gcash-box">
                  <div className="gcash-header">
                    <span className="gcash-logo">GCash</span>
                    <span className="gcash-amount">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="gcash-details">
                    <div className="gcash-detail-row">
                      <span>Number:</span>
                      <span className="gcash-number">{event.gcash_number}</span>
                    </div>
                    <div className="gcash-detail-row">
                      <span>Name:</span>
                      <span className="gcash-name">{event.gcash_name}</span>
                    </div>
                  </div>
                  <p className="gcash-instruction">
                    Send the exact amount above via GCash, then paste your reference number below.
                  </p>
                </div>

                <div className="form-group">
                  <label>GCash Reference Number <span className="required">*</span></label>
                  <input
                    type="text"
                    value={gcashRef}
                    onChange={(e) => setGcashRef(e.target.value)}
                    placeholder="Paste your GCash reference number"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-purchase"
                  disabled={submitting || !buyerName || (!mobile && !email) || !gcashRef}
                >
                  {submitting ? 'Processing...' : 'Purchase tickets'}
                </button>
              </>
            )}
          </form>

          <p style={{ textAlign: 'center', marginTop: '32px' }}>
            <Link to="/" className="btn-link">Back to Home</Link>
          </p>
        </div>
        <Footer />
      </div>
    </div>
  );
}
