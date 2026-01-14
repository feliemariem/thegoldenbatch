import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../images/lasalle.jpg';

export default function Funds() {
  const [balance, setBalance] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchBalance = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/ledger/balance');
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

  useEffect(() => {
    fetchBalance();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <div className="card">
        <img src={logo} alt="USLS Logo" className="logo" />
        <h1 style={{ textAlign: 'center' }}>USLS-IS Batch 2003</h1>
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
                ₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  {((balance / 1700000) * 100).toFixed(1)}% of ₱1,700,000 goal
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
                  ↑ ₱{totalDeposits.toLocaleString('en-PH', { minimumFractionDigits: 0 })} in
                </span>
                <span style={{ color: '#f87171' }}>
                  ↓ ₱{totalWithdrawals.toLocaleString('en-PH', { minimumFractionDigits: 0 })} out
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

        {/* How to Donate */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '20px' }} className="donate-heading">
            💚 How to Donate
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>
            {/* Bank Transfer */}
            <div className="donate-card">
              <p style={{ fontSize: '1.5rem', marginBottom: '12px' }}>🏦</p>
              <h4 className="donate-card-title">Bank Transfer</h4>
              <p className="donate-card-text">
                <strong>BDO</strong><br />
                Account Name: [Account Name]<br />
                Account No: [Account Number]
              </p>
            </div>

            {/* GCash */}
            <div className="donate-card">
              <p style={{ fontSize: '1.5rem', marginBottom: '12px' }}>📱</p>
              <h4 className="donate-card-title">GCash</h4>
              <p className="donate-card-text">
                <strong>[Name]</strong><br />
                0917-XXX-XXXX
              </p>
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
        </div>

        {/* Note */}
        <p className="donate-note">
          Please send a screenshot of your donation to our Facebook page or email for confirmation.
        </p>

        {/* Cost Transparency */}
        <div style={{ marginBottom: '32px' }}>
          <h3 className="budget-heading">
            📊 25th Alumni Homecoming (2028)
          </h3>
          <p className="budget-target">
            Target Budget: ₱1,700,000
          </p>
          <p className="budget-description">
            This budget prioritizes alumni participation, fair compensation, and a well-run milestone event held on school grounds.
          </p>
          
          <div className="budget-container">
            <p className="budget-hint">
              💡 Tap or hover on each item for details
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Food & Catering */}
              <div 
                className="budget-row"
                title="Meals, service staff, and logistics for the entire event. Wherever possible, alumni-owned or batch-connected suppliers will be prioritized."
              >
                <span className="budget-label">🍽️ Food & Catering</span>
                <span className="budget-amount">₱680,000</span>
              </div>
              
              {/* Event Infrastructure */}
              <div 
                className="budget-row"
                title="What replaces venue rental. Ensures comfort, safety, and proper setup for all attendees."
              >
                <span className="budget-label">🏗️ Event Infrastructure</span>
                <span className="budget-amount">₱180,000</span>
              </div>
              
              {/* Sound, Lights & Power */}
              <div 
                className="budget-row"
                title="Professional audio, lighting, and power supply so programs, performances, and speeches run smoothly."
              >
                <span className="budget-label">🎤 Sound, Lights & Power</span>
                <span className="budget-amount">₱185,000</span>
              </div>
              
              {/* Decorations & Anniversary Setup */}
              <div 
                className="budget-row"
                title="25th-anniversary branding, backdrops, and memory elements that make the event meaningful."
              >
                <span className="budget-label">🎨 Decorations & Setup</span>
                <span className="budget-amount">₱125,000</span>
              </div>
              
              {/* Photo & Video */}
              <div 
                className="budget-row"
                title="Professional coverage to preserve memories and share the event with batchmates who can't attend."
              >
                <span className="budget-label">📸 Photo & Video</span>
                <span className="budget-amount">₱95,000</span>
              </div>
              
              {/* Tokens & Giveaways */}
              <div 
                className="budget-row"
                title="Commemorative items for attendees, volunteers, and contributors."
              >
                <span className="budget-label">🎁 Tokens & Giveaways</span>
                <span className="budget-amount">₱120,000</span>
              </div>
              
              {/* Program, Security & Operations */}
              <div 
                className="budget-row"
                title="Hosts, performers, event marshals, coordination, permits, and volunteer meals."
              >
                <span className="budget-label">🛡️ Program & Operations</span>
                <span className="budget-amount">₱145,000</span>
              </div>
              
              {/* Contingency */}
              <div 
                className="budget-row"
                title="Reserved for weather, last-minute needs, or unavoidable cost increases. Any unused amount will be transparently reported."
              >
                <span className="budget-label">🔒 Contingency & Buffer</span>
                <span className="budget-amount">₱170,000</span>
              </div>
              
              {/* Divider */}
              <div className="budget-divider" />
              
              {/* Total */}
              <div className="budget-row budget-total-row">
                <span className="budget-total-label">Total Budget</span>
                <span className="budget-total-amount">₱1,700,000</span>
              </div>
            </div>
          </div>
          
          <p className="budget-footnote">
            * Estimates subject to change. Full accounting will be shared after the event.
          </p>
        </div>

        {/* Back to Profile */}
        <p style={{ textAlign: 'center' }}>
          <Link to="/profile" className="btn-link">← Back to Profile</Link>
        </p>
      </div>
    </div>
  );
}