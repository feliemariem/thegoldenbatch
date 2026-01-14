import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import logo from '../images/lasalle.jpg';

export default function Landing() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showFormModal, setShowFormModal] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/login" className="btn-login">Login</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <h1>25th Alumni Homecoming</h1>
        <p className="tagline">"Golden Batch 2003"</p>
        <div className="event-details">
          <span>📅 December 16, 2028</span>
          <span>📍 Bacolod City</span>
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
              <p><strong>Bank:</strong> BDO</p>
              <p><strong>Account Name:</strong> USLS-IS Batch 2003</p>
              <p><strong>Account Number:</strong> 1234-5678-9012</p>
            </div>
          </div>

          <div className="pledge-card">
            <h3>GCash</h3>
            <div className="qr-placeholder">
              <div className="qr-code">
                {/* Placeholder QR - replace with actual image */}
                <svg viewBox="0 0 100 100" width="150" height="150">
                  <rect width="100" height="100" fill="#fff"/>
                  <rect x="10" y="10" width="20" height="20" fill="#000"/>
                  <rect x="70" y="10" width="20" height="20" fill="#000"/>
                  <rect x="10" y="70" width="20" height="20" fill="#000"/>
                  <rect x="15" y="15" width="10" height="10" fill="#fff"/>
                  <rect x="75" y="15" width="10" height="10" fill="#fff"/>
                  <rect x="15" y="75" width="10" height="10" fill="#fff"/>
                  <rect x="40" y="10" width="5" height="5" fill="#000"/>
                  <rect x="50" y="10" width="5" height="5" fill="#000"/>
                  <rect x="40" y="20" width="5" height="5" fill="#000"/>
                  <rect x="45" y="25" width="5" height="5" fill="#000"/>
                  <rect x="40" y="40" width="20" height="20" fill="#000"/>
                  <rect x="45" y="45" width="10" height="10" fill="#fff"/>
                  <rect x="10" y="40" width="5" height="5" fill="#000"/>
                  <rect x="20" y="45" width="5" height="5" fill="#000"/>
                  <rect x="85" y="40" width="5" height="5" fill="#000"/>
                  <rect x="75" y="50" width="5" height="5" fill="#000"/>
                  <rect x="40" y="85" width="5" height="5" fill="#000"/>
                  <rect x="55" y="75" width="5" height="5" fill="#000"/>
                  <rect x="70" y="70" width="20" height="20" fill="#000"/>
                  <rect x="75" y="75" width="10" height="10" fill="#fff"/>
                </svg>
              </div>
              <p className="gcash-number">0917-123-4567</p>
              <p className="gcash-name">Juan D. Cruz</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2025 USLS-IS Batch 2003 | Golden Batch</p>
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
              ✕
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
                Loading…
              </iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}