import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import Footer from './Footer';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';
import '../styles/systemAdmin.css';

export default function SystemAdminProfile() {
  const { user, logout } = useAuth();
  const { unreadCount } = useInbox();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="container admin-container">
      <div className="card">
        {/* Header */}
        <header className="profile-header">
          <div className="profile-header-content">
            <div className="profile-logo-section">
              <img src={logo} alt="USLS Logo" className="profile-logo" />
              <div className="profile-title">
                <h1>THE GOLDEN BATCH</h1>
                <span className="profile-subtitle">25th Alumni Homecoming</span>
              </div>
            </div>
            <nav className="nav-section">
              <Link to="/events" className={`nav-link ${location.pathname === '/events' ? 'active' : ''}`}>Events</Link>
              <Link to="/committee" className="nav-link">Committee</Link>
              <Link to="/directory" className="nav-link">Directory</Link>
              <Link to="/funds" className="nav-link">Funds</Link>
              <Link to="/inbox" className="nav-link nav-link-badge">
                Inbox
                {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
              </Link>
              <Link to="/profile-preview" className="nav-link active">Profile</Link>
              <Link to="/admin" className="nav-link">Admin</Link>
              <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
            </nav>
          </div>
        </header>

        <main className="profile-main">
          {/* System Admin Content */}
          <div className="system-admin-content">
            <div className="system-admin-card">
              <div className="system-admin-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </div>
              <h2 className="system-admin-title">System Administrator</h2>
              <p className="system-admin-email">{user?.email}</p>
              <p className="system-admin-description">
                You are logged in as the system administrator. Use the Admin Dashboard to manage the application.
              </p>
              <Link to="/admin" className="system-admin-button">
                Go to Admin Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
