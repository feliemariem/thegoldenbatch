import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import logo from '../images/lasalle.jpg';

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="landing-page">
      {/* Theme toggle in corner */}
      <button
        onClick={toggleTheme}
        className="landing-theme-toggle"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Centered content */}
      <div className="landing-content">
        {/* La Salle portrait */}
        <img src={logo} alt="La Salle" className="landing-portrait" />

        {/* Title */}
        <h1 className="landing-title">UNIVERSITY OF ST. LA SALLE - IS 2003</h1>

        {/* The Golden Batch */}
        <h2 className="landing-golden-batch">THE GOLDEN BATCH</h2>

        {/* Subtitle */}
        <p className="landing-subtitle">25th Alumni Homecoming</p>

        {/* Login button */}
        <Link to="/login" className="btn-login">Login</Link>
      </div>
    </div>
  );
}