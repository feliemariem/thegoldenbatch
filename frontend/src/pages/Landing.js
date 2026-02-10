import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showFormModal, setShowFormModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  // Animation states
  const [heroAnimated, setHeroAnimated] = useState(false);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownAnimated, setCountdownAnimated] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);

  // Refs for intersection observer
  const countdownRef = useRef(null);
  const aboutRef = useRef(null);

  // Trigger hero animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setHeroAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Header scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setHeaderSolid(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection observers for scroll-triggered animations
  useEffect(() => {
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -50px 0px'
    };

    const countdownObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !countdownAnimated) {
          setCountdownVisible(true);
          setCountdownAnimated(true);
        }
      });
    }, observerOptions);

    const aboutObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setAboutVisible(true);
        }
      });
    }, observerOptions);

    if (countdownRef.current) countdownObserver.observe(countdownRef.current);
    if (aboutRef.current) aboutObserver.observe(aboutRef.current);

    return () => {
      countdownObserver.disconnect();
      aboutObserver.disconnect();
    };
  }, [countdownAnimated]);

  // Countdown timer
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
    <div className={`landing-page ${heroAnimated ? 'animated' : ''}`} data-theme={theme}>
      {/* Header */}
      <header className={`landing-header ${headerSolid ? 'solid' : ''}`}>
        <div className="landing-logo">
          <img src={logo} alt="USLS Logo" />
          <span>UNIVERSITY OF ST. LA SALLE - IS 2003</span>
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
      <section className={`hero-section ${heroAnimated ? 'animate' : ''}`}>
        <div className="hero-background" />
        <div className="hero-content">
          <img
            src={require('../images/logo.png')}
            alt="25th Anniversary Logo"
            className="hero-logo"
          />
          <h1 className="hero-title">
            <span className="word word-1">25th</span>{' '}
            <span className="word word-2">Alumni</span>{' '}
            <span className="word word-3">Homecoming</span>
          </h1>
          <p className="tagline">The Golden Batch 2003</p>
          <div className="event-details">
            <span className="event-date">
              <span className="event-icon">📅</span>
              December 16, 2028
            </span>
            <span className="event-location">
              <span className="event-icon">📍</span>
              USLS School Grounds, Bacolod City
            </span>
          </div>
          <p className="hero-quote">"It's time to come home."</p>
          <button onClick={() => setShowFormModal(true)} className="btn-hero">
            <span>Register Now</span>
          </button>
        </div>
      </section>

      {/* Countdown Section */}
      <section
        ref={countdownRef}
        className={`countdown-section ${countdownVisible ? 'visible' : ''}`}
      >
        <h2>Countdown to Reunion</h2>
        <div className="countdown-grid">
          <div className="countdown-item" style={{ '--delay': '0' }}>
            <span className="countdown-number">{timeLeft.days}</span>
            <span className="countdown-label">Days</span>
          </div>
          <div className="countdown-item" style={{ '--delay': '1' }}>
            <span className="countdown-number">{timeLeft.hours}</span>
            <span className="countdown-label">Hours</span>
          </div>
          <div className="countdown-item" style={{ '--delay': '2' }}>
            <span className="countdown-number">{timeLeft.minutes}</span>
            <span className="countdown-label">Minutes</span>
          </div>
          <div className="countdown-item" style={{ '--delay': '3' }}>
            <span className="countdown-number">{timeLeft.seconds}</span>
            <span className="countdown-label">Seconds</span>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section
        ref={aboutRef}
        className={`about-section ${aboutVisible ? 'visible' : ''}`}
      >
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
                We're collecting your email to send you a personalized invite link to our official reunion registration system.
              </p>
              <p>
                Once you receive your invite, you'll be able to:
              </p>
              <ul>
                <li>Register for the reunion and confirm your attendance (RSVP)</li>
                <li>Access event updates, announcements, and reminders</li>
                <li>Track reunion details and activities</li>
              </ul>
              <p className="privacy-note">
                By providing your email, you consent to the collection and use of your personal information
                by USLS-IS Batch 2003 in accordance with the Data Privacy Act of 2012 (R.A. 10173).
                Your information will only be used for reunion-related purposes and will not be shared
                with third parties or used for commercial purposes.
              </p>

              {/* Consent Checkbox */}
              <label className="consent-checkbox">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                />
                <span>
                  I understand and agree to the data collection and privacy terms stated above.
                </span>
              </label>
            </div>

            <div
              className="form-embed-container"
              style={{
                opacity: consentGiven ? 1 : 0.5,
                pointerEvents: consentGiven ? 'auto' : 'none'
              }}
            >
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
