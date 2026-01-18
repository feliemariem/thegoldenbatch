import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';
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
          <span>University of St. La Salle - IS 2003</span>
        </div>
        <div className="landing-header-actions">
          <Link to="/login" className="btn-login">Login</Link>
          <button
            onClick={toggleTheme}
            className="landing-theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
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



      <Footer />

      {/* Google Form Modal */}
      {showFormModal && (
        <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFormModal(false)}>
              &#10005;
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