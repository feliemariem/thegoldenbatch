import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';

export default function Funds() {
  const { user, logout } = useAuth();
  const { unreadCount } = useInbox();
  const navigate = useNavigate();
  const location = useLocation();
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const eventsDropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const [balance, setBalance] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [donors, setDonors] = useState([]);

  const PESO = '\u20B1'; // Philippine Peso sign

  const fetchBalance = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/ledger/balance');
      const data = await res.json();
      setBalance(data.balance || 0);
      setTotalDeposits(data.totalDeposits || 0);
      setTotalWithdrawals(data.totalWithdrawals || 0);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  };

  const fetchDonors = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/ledger/donors');
      const data = await res.json();
      setDonors(data.donors || []);
    } catch (err) {
      console.error('Failed to fetch donors');
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchDonors();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBalance, 30000);

    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eventsDropdownRef.current && !eventsDropdownRef.current.contains(event.target)) {
        setEventsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatPeso = (amount, decimals = 2) => {
    return PESO + amount.toLocaleString('en-PH', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
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
            <nav className="profile-nav">
              <div className={`nav-dropdown ${eventsDropdownOpen ? 'open' : ''}`} ref={eventsDropdownRef}>
                <button
                  className={`nav-dropdown-trigger ${location.pathname === '/events' || location.pathname === '/media' ? 'active' : ''} ${eventsDropdownOpen ? 'open' : ''}`}
                  onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
                >
                  Events <span className="dropdown-arrow">▼</span>
                </button>
                <div className="nav-dropdown-menu">
                  <Link to="/events" className={`nav-dropdown-item ${location.pathname === '/events' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Upcoming</Link>
                <Link to="/media" className={`nav-dropdown-item ${location.pathname === '/media' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Media</Link>
              </div>
            </div>
            {user?.isAdmin && <Link to="/committee" className="nav-link">Committee</Link>}
            {user?.isAdmin && <Link to="/directory" className="nav-link">Directory</Link>}
            <Link to="/funds" className="nav-link active">Funds</Link>
            <Link to="/inbox" className="nav-link">Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</Link>
            <Link to={user?.isAdmin ? "/profile-preview" : "/profile"} className="nav-link">Profile</Link>
            {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
            <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
          </nav>
        </div>
      </header>

      <main className="profile-main">
        <div className="card funds-content">
          <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>USLS-IS 2003</h2>
          <p className="subtitle" style={{ textAlign: 'center' }}>25th Alumni Homecoming Fund</p>

        {/* Total Funds Display */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(207, 181, 59, 0.15) 0%, rgba(207, 181, 59, 0.05) 100%)',
          border: '2px solid rgba(207, 181, 59, 0.4)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <p className="funds-label">Current Balance</p>
          {loading ? (
            <p className="funds-total-loading">Loading...</p>
          ) : (
            <>
              <p className="funds-total-amount">
                {formatPeso(balance)}
              </p>
              
              {/* Progress Bar */}
              <div style={{ marginTop: '24px', marginBottom: '12px' }}>
                <div className="progress-bar-track">
                  <div 
                    className="progress-bar-fill"
                    style={{ width: `${Math.min((balance / 1700000) * 100, 100)}%` }}
                  />
                </div>
                <p className="funds-progress-text">
                  {((balance / 1700000) * 100).toFixed(1)}% of {formatPeso(1700000, 0)} goal
                </p>
              </div>

              {/* Deposits & Withdrawals breakdown */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '24px', 
                marginTop: '16px',
                fontSize: '0.9rem'
              }}>
                <span style={{ color: '#4ade80' }}>
                  {'\u2191'} {formatPeso(totalDeposits, 0)} in
                </span>
                <span style={{ color: '#f87171' }}>
                  {'\u2193'} {formatPeso(totalWithdrawals, 0)} out
                </span>
              </div>

              <p className="funds-date">
                Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString('en-PH', { 
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                }) : '-'}
                <span style={{ marginLeft: '8px', fontSize: '0.8rem', opacity: 0.7 }}>
                  (auto-refreshes every 30s)
                </span>
              </p>
            </>
          )}
        </div>

        {/* Thank You Roll Credits */}
        {donors.length > 0 && (
          <div className="thank-you-section">
            <h3 className="thank-you-title">Thank You for Your Contributions!</h3>
            <div className="credits-container">
              <div className="credits-scroll">
                {/* Duplicate the list for seamless loop */}
                {[...donors, ...donors].map((name, index) => (
                  <p key={index} className="donor-name">{name}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* How to Donate */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '20px' }} className="donate-heading">
            How to Donate
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>
            {/* Bank Transfer <div className="donate-card">
              <h4 className="donate-card-title">Bank Transfer</h4>
              <div className="donate-card-content">
                <p className="donate-bank-name">PNB (Philippine National Bank)</p>
                <p className="donate-label">Account Number</p>
                <p className="donate-value">307770014898</p>
                
                <p className="donate-label" style={{ marginTop: '16px' }}>Account Name(s)</p>
                <p className="donate-value">NARCISO F. JAVELOSA or</p>
                <p className="donate-value">MARY ROSE FRANCES M. UY</p>
              </div>
            </div> */}
            

            {/* GCash */}
            <div className="donate-card">
              <h4 className="donate-card-title">GCash</h4>
              <div className="donate-card-content">
                <p className="donate-label">Account Name</p>
                <p className="donate-value">[Name]</p>
                
                <p className="donate-label" style={{ marginTop: '16px' }}>Mobile Number</p>
                <p className="donate-value">0917-XXX-XXXX</p>
              </div>
              {/* Placeholder for QR code */}
              <div style={{
                width: '120px',
                height: '120px',
                background: '#f0f0f0',
                margin: '16px auto 0',
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

          {/* International Transfers - Separate Section */}
          <div className="intl-transfers-card">
            <h4 className="intl-transfers-header">For International Transfers</h4>
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
        </div>

        {/* Cost Transparency */}
        <div style={{ marginBottom: '32px' }}>
          <h3 className="budget-heading">
            25th Alumni Homecoming (2028)
          </h3>
          <p className="budget-target">
            Target Budget: {formatPeso(1700000, 0)}
          </p>
          <p className="budget-description">
            This budget prioritizes alumni participation, fair compensation, and a well-run milestone event held on school grounds.
          </p>
          
          <div className="budget-container">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Food & Catering */}
              <div className="budget-row-with-desc">
                <div className="budget-row">
                  <span className="budget-label">Food & Catering</span>
                  <span className="budget-amount">{formatPeso(680000, 0)}</span>
                </div>
                <p className="budget-desc">Meals, service staff, and logistics. Alumni-owned suppliers prioritized.</p>
              </div>
              
              {/* Event Infrastructure */}
              <div className="budget-row-with-desc">
                <div className="budget-row">
                  <span className="budget-label">Event Infrastructure</span>
                  <span className="budget-amount">{formatPeso(180000, 0)}</span>
                </div>
                <p className="budget-desc">Replaces venue rental. Ensures comfort, safety, and proper setup.</p>
              </div>
              
              {/* Sound, Lights & Power */}
              <div className="budget-row-with-desc">
                <div className="budget-row">
                  <span className="budget-label">Sound, Lights & Power</span>
                  <span className="budget-amount">{formatPeso(185000, 0)}</span>
                </div>
                <p className="budget-desc">Professional audio, lighting, and power for programs and performances.</p>
              </div>
              
              {/* Decorations & Anniversary Setup */}
              <div className="budget-row-with-desc">
                <div className="budget-row">
                  <span className="budget-label">Decorations & Setup</span>
                  <span className="budget-amount">{formatPeso(125000, 0)}</span>
                </div>
                <p className="budget-desc">25th-anniversary branding, backdrops, and memory elements.</p>
              </div>
              
              {/* Photo & Video */}
              <div className="budget-row-with-desc">
                <div className="budget-row">
                  <span className="budget-label">Photo & Video</span>
                  <span className="budget-amount">{formatPeso(95000, 0)}</span>
                </div>
                <p className="budget-desc">Professional coverage to preserve and share memories.</p>
              </div>
              
              {/* Tokens & Giveaways */}
              <div className="budget-row-with-desc">
                <div className="budget-row">
                  <span className="budget-label">Tokens & Giveaways</span>
                  <span className="budget-amount">{formatPeso(120000, 0)}</span>
                </div>
                <p className="budget-desc">Commemorative items for attendees, volunteers, and contributors.</p>
              </div>
              
              {/* Program, Security & Operations */}
              <div className="budget-row-with-desc">
                <div className="budget-row">
                  <span className="budget-label">Program & Operations</span>
                  <span className="budget-amount">{formatPeso(145000, 0)}</span>
                </div>
                <p className="budget-desc">Hosts, performers, marshals, coordination, permits, volunteer meals.</p>
              </div>
              
              {/* Contingency */}
              <div className="budget-row-with-desc">
                <div className="budget-row">
                  <span className="budget-label">Contingency & Buffer</span>
                  <span className="budget-amount">{formatPeso(170000, 0)}</span>
                </div>
                <p className="budget-desc">Reserved for weather, last-minute needs. Unused amount will be reported.</p>
              </div>
              
              {/* Divider */}
              <div className="budget-divider" />
              
              {/* Total */}
              <div className="budget-row budget-total-row">
                <span className="budget-total-label">Total Budget</span>
                <span className="budget-total-amount">{formatPeso(1700000, 0)}</span>
              </div>
            </div>
          </div>
          
          <p className="budget-footnote">
            * Estimates subject to change. Full accounting will be shared after the event.
          </p>
        </div>

        </div>
      </main>
      </div>
      <Footer />
    </div>
  );
}