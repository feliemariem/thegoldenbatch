import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import logo from '../images/lasalle.jpg';

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showFormModal, setShowFormModal] = useState(false);

  useEffect(() => {
    const reunionDate = new Date('2028-12-16T00:00:00');

    const updateCountdown = () => {
      const now = new Date();
      const diff = reunionDate - now;

      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowFormModal(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-logo">
          <img src={logo} alt="USLS Logo" />
          <span>University of St. La Salle HS 2003</span>
        </div>
        <div className="landing-header-actions">
          <button
            onClick={toggleTheme}
            className="landing-theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/login" className="btn-login">Login</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <h1>25th Alumni Homecoming</h1>
        <p className="tagline">The Golden Batch 2003</p>
        <div className="event-details">
          <span>📅 December 16, 2028</span>
          <span>📍 USLS School Grounds, Bacolod City</span>
        </div>
        <button onClick={() => setShowFormModal(true)} className="btn-hero">
          Register Now
        </button>
      </section>

      {/* Countdown Section */}
      <section className="countdown-section">
        <h2>Countdown to Reunion</h2>
        <div className="countdown-grid">
          <div className="countdown-item">
            <span className="countdown-number">{timeLeft.days}</span>
            <span className="countdown-label">Days</span>
          </div>
          <div className="countdown-item">
            <span className="countdown-number">{timeLeft.hours}</span>
            <span className="countdown-label">Hours</span>
          </div>
          <div className="countdown-item">
            <span className="countdown-number">{timeLeft.minutes}</span>
            <span className="countdown-label">Minutes</span>
          </div>
          <div className="countdown-item">
            <span className="countdown-number">{timeLeft.seconds}</span>
            <span className="countdown-label">Seconds</span>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <h2>About the Reunion</h2>
        <p>
          It's been 25 years since we walked the halls of USLS-IS together. 
          Join us as we celebrate a quarter century of friendship, memories, 
          and the bonds that have lasted a lifetime. Let's reconnect, reminisce, 
          and create new memories together!
        </p>
      </section>

      {/* Pledge/Donate Section */}
      <section className="pledge-section">
        <h2>Support the Reunion</h2>
        <p>Help make our 25th reunion unforgettable! Your contributions will go towards venue, food, and activities.</p>
        
        <div className="pledge-options">
          <div className="pledge-card">
            <h3>Bank Transfer</h3>
            <div className="bank-details">
              <p><strong>PNB (Philippine National Bank)</strong></p>
              <p className="bank-label">Account Number</p>
              <p className="bank-value">307770014898</p>
              <p className="bank-label" style={{ marginTop: '12px' }}>Account Name(s)</p>
              <p className="bank-value">NARCISO F. JAVELOSA OR<br/>MARY ROSE FRANCES M. UY</p>
            </div>
          </div>

          <div className="pledge-card">
            <h3>GCash</h3>
            <div className="qr-placeholder">
              <p className="bank-label">Account Name</p>
              <p className="bank-value">[Name]</p>
              <p className="bank-label" style={{ marginTop: '12px' }}>Mobile Number</p>
              <p className="gcash-number">0917-XXX-XXXX</p>
              {/* Placeholder for QR code */}
              <div className="qr-code" style={{ marginTop: '16px' }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  background: '#f0f0f0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  fontSize: '0.8rem'
                }}>
                  QR Code
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* International Transfers - Separate Section */}
        <div className="intl-transfers-card">
          <h3>For International Transfers</h3>
          <div className="intl-transfers-content">
            <div className="intl-branch-info">
              <p className="intl-branch-name">PNB Bacolod Lacson Branch</p>
              <p className="intl-branch-address">
                10th Lacson Street<br/>
                Bacolod City, Negros Occidental 6100
              </p>
              <p className="intl-branch-tel">Tel: (63) (034) 432-0605 / 434-8007</p>
            </div>
            <div className="intl-codes">
              <div className="intl-row">
                <span className="intl-label">SWIFT Code</span>
                <span className="intl-value">PNBMPHMM</span>
              </div>
              <div className="intl-row">
                <span className="intl-label">Routing No.</span>
                <span className="intl-value">040080019</span>
              </div>
              <div className="intl-row">
                <span className="intl-label">Email</span>
                <span className="intl-value intl-email">bacolod_lacson@pnb.com.ph</span>
              </div>
              <div className="intl-row">
                <span className="intl-label">Website</span>
                <span className="intl-value intl-email">pnb.com.ph</span>
              </div>
            </div>
          </div>
          <p className="intl-note">Transfer fees and applicable taxes are shouldered by sender.</p>
        </div>

        <p className="receipt-note">
          Please send a screenshot of your receipt to{' '}
          <a href="mailto:uslsis.batch2003@gmail.com">uslsis.batch2003@gmail.com</a>
          {' '}for confirmation.
        </p>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>{'\u00A9'} 2025 USLS-IS Batch 2003 | Golden Batch</p>
        <p>
          <a href="https://www.facebook.com/groups/478382298877930" target="_blank" rel="noopener noreferrer">
            Facebook Group
          </a>
          {' | '}
          <a href="mailto:uslsis.batch2003@gmail.com">Contact Us</a>
        </p>
      </footer>

      {/* Google Form Modal */}
      {showFormModal && (
        <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFormModal(false)}>
              âœ•
            </button>
            <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#CFB53B' }}>
              Register for the Reunion
            </h2>
            
            {/* Disclaimer Section */}
            <div className="form-disclaimer">
              <p>
                We're collecting your email to send you an official invite link where you can register and:
              </p>
              <ul>
                <li>Confirm your attendance (RSVP)</li>
                <li>Update your contact information</li>
                <li>Be included in our batch directory so classmates can reconnect with you</li>
                <li>Receive event updates, announcements, and reminders</li>
              </ul>
              <p className="privacy-note">
                Your information will only be shared with fellow batchmates and the organizing committee. 
                We will not share your data with third parties or use it for any commercial purposes.
              </p>
            </div>

            <div className="form-embed-container">
              <iframe 
                src="https://docs.google.com/forms/d/e/1FAIpQLSfJrWdJavnAvJPf0FWmgBs6BWqLM6290CButysWtWRvEwCpIA/viewform?embedded=true" 
                width="100%" 
                height="600" 
                frameBorder="0" 
                marginHeight="0" 
                marginWidth="0"
                title="Registration Form"
              >
                Loadingâ€¦
              </iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}