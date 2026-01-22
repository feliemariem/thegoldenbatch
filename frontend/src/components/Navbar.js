import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../images/logo.png';
import '../styles/navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { unreadCount } = useInbox();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const [communityDropdownOpen, setCommunityDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileEventsOpen, setMobileEventsOpen] = useState(false);

  const eventsDropdownRef = useRef(null);
  const communityDropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eventsDropdownRef.current && !eventsDropdownRef.current.contains(event.target)) {
        setEventsDropdownOpen(false);
      }
      if (communityDropdownRef.current && !communityDropdownRef.current.contains(event.target)) {
        setCommunityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileEventsOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isEventsActive = location.pathname === '/events' || location.pathname === '/media' || location.pathname.startsWith('/events/');
  const isCommunityActive = location.pathname === '/committee' || location.pathname === '/directory';

  return (
    <header className="navbar">
      <div className="navbar-content">
        {/* Logo Section */}
        <div className="navbar-logo-section">
          <img src={logo} alt="USLS Logo" className="navbar-logo" />
          <div className="navbar-title">
            <h1>THE GOLDEN BATCH</h1>
            <span className="navbar-subtitle">25th Alumni Homecoming</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="navbar-nav desktop-nav">
          {/* Events Dropdown */}
          <div className={`nav-dropdown ${eventsDropdownOpen ? 'open' : ''}`} ref={eventsDropdownRef}>
            <button
              className={`nav-dropdown-trigger ${isEventsActive ? 'active' : ''} ${eventsDropdownOpen ? 'open' : ''}`}
              onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
            >
              Events <span className="dropdown-arrow">▼</span>
            </button>
            <div className="nav-dropdown-menu">
              <Link
                to="/events"
                className={`nav-dropdown-item ${location.pathname === '/events' ? 'active' : ''}`}
                onClick={() => setEventsDropdownOpen(false)}
              >
                Upcoming
              </Link>
              <Link
                to="/media"
                className={`nav-dropdown-item ${location.pathname === '/media' ? 'active' : ''}`}
                onClick={() => setEventsDropdownOpen(false)}
              >
                Media
              </Link>
            </div>
          </div>

          {/* Community Dropdown - Admin only */}
          {user?.isAdmin && (
            <div className={`nav-dropdown ${communityDropdownOpen ? 'open' : ''}`} ref={communityDropdownRef}>
              <button
                className={`nav-dropdown-trigger ${isCommunityActive ? 'active' : ''} ${communityDropdownOpen ? 'open' : ''}`}
                onClick={() => setCommunityDropdownOpen(!communityDropdownOpen)}
              >
                Community <span className="dropdown-arrow">▼</span>
              </button>
              <div className="nav-dropdown-menu">
                <Link
                  to="/committee"
                  className={`nav-dropdown-item ${location.pathname === '/committee' ? 'active' : ''}`}
                  onClick={() => setCommunityDropdownOpen(false)}
                >
                  Committee
                </Link>
                <Link
                  to="/directory"
                  className={`nav-dropdown-item ${location.pathname === '/directory' ? 'active' : ''}`}
                  onClick={() => setCommunityDropdownOpen(false)}
                >
                  Directory
                </Link>
              </div>
            </div>
          )}

          <Link to="/funds" className={`nav-link ${location.pathname === '/funds' ? 'active' : ''}`}>Funds</Link>
          <Link to="/inbox" className={`nav-link ${location.pathname === '/inbox' ? 'active' : ''}`}>
            Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          </Link>
          <Link to={user?.isAdmin ? "/profile-preview" : "/profile"} className={`nav-link ${location.pathname === '/profile' || location.pathname === '/profile-preview' ? 'active' : ''}`}>Profile</Link>
          {user?.isAdmin && <Link to="/admin" className={`nav-link admin-link ${location.pathname === '/admin' ? 'active' : ''}`}>Admin</Link>}
          <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
        </nav>

        {/* Top-right controls: Theme Toggle + Hamburger */}
        <div className="navbar-controls">
          <button
            onClick={toggleTheme}
            className="navbar-theme-toggle"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className={`hamburger-toggle ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            <span className="hamburger-icon">{mobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className={`navbar-nav mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Events with expand/collapse */}
        <div className="mobile-nav-group">
          <button
            className={`mobile-nav-trigger ${isEventsActive ? 'active' : ''}`}
            onClick={() => setMobileEventsOpen(!mobileEventsOpen)}
          >
            Events <span className={`dropdown-arrow ${mobileEventsOpen ? 'open' : ''}`}>▼</span>
          </button>
          <div className={`mobile-nav-submenu ${mobileEventsOpen ? 'open' : ''}`}>
            <Link to="/events" className={`mobile-nav-subitem ${location.pathname === '/events' ? 'active' : ''}`}>
              Upcoming
            </Link>
            <Link to="/media" className={`mobile-nav-subitem ${location.pathname === '/media' ? 'active' : ''}`}>
              Media
            </Link>
          </div>
        </div>

        {/* Committee and Directory as separate items on mobile */}
        {user?.isAdmin && (
          <>
            <Link to="/committee" className={`mobile-nav-link ${location.pathname === '/committee' ? 'active' : ''}`}>
              Committee
            </Link>
            <Link to="/directory" className={`mobile-nav-link ${location.pathname === '/directory' ? 'active' : ''}`}>
              Directory
            </Link>
          </>
        )}

        <Link to="/funds" className={`mobile-nav-link ${location.pathname === '/funds' ? 'active' : ''}`}>
          Funds
        </Link>
        <Link to="/inbox" className={`mobile-nav-link ${location.pathname === '/inbox' ? 'active' : ''}`}>
          Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </Link>
        <Link
          to={user?.isAdmin ? "/profile-preview" : "/profile"}
          className={`mobile-nav-link ${location.pathname === '/profile' || location.pathname === '/profile-preview' ? 'active' : ''}`}
        >
          Profile
        </Link>
        {user?.isAdmin && (
          <Link to="/admin" className={`mobile-nav-link admin-link ${location.pathname === '/admin' ? 'active' : ''}`}>
            Admin
          </Link>
        )}
        <button onClick={handleLogout} className="mobile-nav-link logout-btn">
          Logout
        </button>
      </nav>
    </header>
  );
}
