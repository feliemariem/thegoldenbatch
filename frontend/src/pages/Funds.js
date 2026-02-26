import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/profileNew.css';
import { api } from '../api';

export default function Funds() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [donors, setDonors] = useState([]);

  const PESO = '\u20B1';

  const fetchBalance = async () => {
    try {
      const res = await api('/api/ledger/balance');
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
      const res = await api('/api/ledger/donors');
      const data = await res.json();
      setDonors(data.donors || []);
    } catch (err) {
      console.error('Failed to fetch donors');
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchDonors();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  const creditsContainerRef = useRef(null);
  const creditsScrollRef = useRef(null);

  useEffect(() => {
    if (!creditsScrollRef.current || !creditsContainerRef.current) return;
    if (donors.length === 0) return;

    let animationId;
    let position = 0;
    const speed = 0.5; // pixels per frame

    const animate = () => {
      position += speed;
      const halfHeight = creditsScrollRef.current.scrollHeight / 2;
      if (position >= halfHeight) position = 0;
      creditsScrollRef.current.style.transform = `translateY(-${position}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [donors]);

  const formatPeso = (amount, decimals = 2) => {
    return PESO + amount.toLocaleString('en-PH', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  return (
    <div className="container admin-container">
      <Navbar />
      <div className="card">
      <main className="profile-main">
        <div className="card funds-content funds-card">
          <h2 className="funds-page-title">USLS-IS 2003</h2>
          <p className="funds-page-subtitle">25th Alumni Homecoming Fund</p>

          {/* Total Funds Display */}
          <div className="funds-balance-card">
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
                      style={{ width: `${Math.min((balance / 2100000) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="funds-progress-text">
                    {((balance / 2100000) * 100).toFixed(1)}% of {formatPeso(2100000, 0)} goal
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

          {/* CTA: Go to Contribution Plan */}
          <div style={{
            textAlign: 'center',
            margin: '32px 0'
          }}>
            <button
              onClick={() => navigate('/profile-preview')}
              className="funds-cta-btn"
            >
              View Contribution Plan & Choose Your Tier
            </button>
            <p style={{
              fontSize: '0.82rem',
              color: 'var(--color-text-secondary)',
              marginTop: '8px'
            }}>
              Pick your Builder tier, see the breakdown, and commit — all from your profile.
            </p>
          </div>

          {/* Payment Methods */}
          <div style={{ marginBottom: '32px' }}>
            <h3 className="donate-heading">Payment Methods</h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px'
            }}>
              {/* Bank Deposit */}
              <div className="donate-card">
                <h4 className="donate-card-title">Bank Deposit</h4>
                <div className="donate-card-content">
                  <p className="donate-label">Bank</p>
                  <p className="donate-value">Philippine National Bank (PNB)</p>

                  <p className="donate-label" style={{ marginTop: '16px' }}>Account Names</p>
                  <p className="donate-value">Narciso Javelosa III or Mary Rose Frances Uy</p>

                  <p className="donate-label" style={{ marginTop: '16px' }}>Account Number</p>
                  <p className="donate-value">307770014898</p>
                </div>
              </div>

              {/* International Transfers */}
              <div className="donate-card">
                <h4 className="donate-card-title">International Transfers (SWIFT)</h4>
                <div className="donate-card-content">
                  <p className="donate-label">Bank</p>
                  <p className="donate-value">PNB Bacolod Lacson Branch</p>

                  <p className="donate-label" style={{ marginTop: '12px' }}>Address</p>
                  <p className="donate-value">10th Lacson Street, Bacolod City, Negros Occidental 6100</p>

                  <p className="donate-label" style={{ marginTop: '12px' }}>Tel</p>
                  <p className="donate-value">(63) (034) 432-0605 / 434-8007</p>

                  <p className="donate-label" style={{ marginTop: '12px' }}>SWIFT Code</p>
                  <p className="donate-value">PNBMPHMM</p>

                  <p className="donate-label" style={{ marginTop: '12px' }}>Routing No</p>
                  <p className="donate-value">040080019</p>

                  <p className="donate-label" style={{ marginTop: '12px' }}>Email</p>
                  <p className="donate-value">bacolod_lacson@pnb.com.ph</p>
                </div>
              </div>
            </div>

            <p className="receipt-note" style={{ marginTop: '16px' }}>
              <strong>Important:</strong> After making a payment, upload your receipt on your profile page. The committee will verify and credit your account within 48 hours. Include your full name in the transfer reference for faster processing.
            </p>
            <p className="receipt-note" style={{ marginTop: '8px', opacity: 0.7 }}>
              Transfer fees and applicable taxes are shouldered by sender.
            </p>
          </div>

          {/* Thank You Roll Credits */}
          {donors.length > 0 && (
            <div className="thank-you-section">
              <h3 className="thank-you-title">Golden Batch Builders</h3>
              <div className="credits-container" ref={creditsContainerRef}>
                <div className="credits-scroll" ref={creditsScrollRef}>
                  {[...donors, ...donors].map((name, index) => (
                    <p key={index} className="donor-name">{name}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Where Your Contribution Goes — Events Breakdown */}
          <div style={{ marginBottom: '32px' }}>
            <h3 className="budget-heading">Where Your Contribution Goes</h3>
            <p className="budget-description">
              Total plan supported by contributions and fundraising. {formatPeso(2100000, 0)} Full Batch Vision Target.
            </p>

            {/* Core Celebration — 80% */}
            <div className="funds-alloc-group">
              <div className="funds-alloc-section-label">Core Celebration</div>
              <div className="funds-alloc-row">
                <div className="funds-alloc-items">
                  <div className="funds-alloc-item">
                    <span className="funds-alloc-icon">🎉</span>
                    <div className="funds-alloc-details">
                      <div className="funds-alloc-name">Main Event</div>
                      <div className="funds-alloc-desc">Primary celebration covering venue, catering, production, and full program execution.</div>
                    </div>
                    <span className="funds-alloc-pct">50%</span>
                  </div>
                  <div className="funds-alloc-item">
                    <span className="funds-alloc-icon">🎓</span>
                    <div className="funds-alloc-details">
                      <div className="funds-alloc-name">Teachers' Dinner</div>
                      <div className="funds-alloc-desc">A separate evening dedicated to the teachers who shaped us. Our way of saying thank you, long overdue.</div>
                    </div>
                    <span className="funds-alloc-pct">12%</span>
                  </div>
                  <div className="funds-alloc-item">
                    <span className="funds-alloc-icon">👕</span>
                    <div className="funds-alloc-details">
                      <div className="funds-alloc-name">Merch & Commemorative Items</div>
                      <div className="funds-alloc-desc">Every batchmate gets a shirt. Premium items sold separately help offset the cost.</div>
                    </div>
                    <span className="funds-alloc-pct">8%</span>
                  </div>
                  <div className="funds-alloc-item">
                    <span className="funds-alloc-icon">💚</span>
                    <div className="funds-alloc-details">
                      <div className="funds-alloc-name">Charity / Giving Back</div>
                      <div className="funds-alloc-desc">A portion of what we raise goes back to the school and its community.</div>
                    </div>
                    <span className="funds-alloc-pct">7%</span>
                  </div>
                  <div className="funds-alloc-item">
                    <span className="funds-alloc-icon">🔒</span>
                    <div className="funds-alloc-details">
                      <div className="funds-alloc-name">Contingency & Buffer</div>
                      <div className="funds-alloc-desc">Reserved buffer to protect the batch from unforeseen costs.</div>
                    </div>
                    <span className="funds-alloc-pct">3%</span>
                  </div>
                </div>
                <div className="funds-alloc-big-pct">
                  <div className="funds-alloc-big-num">80%</div>
                  <div className="funds-alloc-big-label">of total batch vision</div>
                </div>
              </div>
              <div className="funds-alloc-note">
                <div className="funds-alloc-bar"><div className="funds-alloc-bar-fill green" style={{ width: '80%' }} /></div>
                80% of our total plan funds the core celebration — the Main Event, Teachers' Dinner, and commemorative items.
              </div>
            </div>

            {/* Fundraising Initiatives — 20% */}
            <div className="funds-alloc-group">
              <div className="funds-alloc-section-label gold">Fundraising Initiatives</div>
              <div className="funds-alloc-row">
                <div className="funds-alloc-items">
                  <div className="funds-alloc-item">
                    <span className="funds-alloc-icon">⛳</span>
                    <div className="funds-alloc-details">
                      <div className="funds-alloc-name">La Sallian Golf</div>
                      <div className="funds-alloc-desc">A 2-day event at Negros Occidental Golf & Country Club bringing La Sallians together from across the nation.</div>
                    </div>
                    <span className="funds-alloc-pct gold">10%</span>
                  </div>
                  <div className="funds-alloc-item">
                    <span className="funds-alloc-icon">🏃</span>
                    <div className="funds-alloc-details">
                      <div className="funds-alloc-name">La Sallian Run</div>
                      <div className="funds-alloc-desc">A tradition started by our own peers, held first quarter of 2028.</div>
                    </div>
                    <span className="funds-alloc-pct gold">6%</span>
                  </div>
                  <div className="funds-alloc-item">
                    <span className="funds-alloc-icon">⚽</span>
                    <div className="funds-alloc-details">
                      <div className="funds-alloc-name">In Memoriam Football Cup</div>
                      <div className="funds-alloc-desc">A tribute to the batchmates we've lost, played in their honor.</div>
                    </div>
                    <span className="funds-alloc-pct gold">4%</span>
                  </div>
                </div>
                <div className="funds-alloc-big-pct gold-block">
                  <div className="funds-alloc-big-num gold">20%</div>
                  <div className="funds-alloc-big-label">revenue initiative</div>
                </div>
              </div>
              <div className="funds-alloc-note">
                <div className="funds-alloc-bar"><div className="funds-alloc-bar-fill gold" style={{ width: '20%' }} /></div>
                Upfront operating allocation. Designed to generate sponsorship and entry-fee returns to support the overall fund.
              </div>
            </div>

            <p className="budget-footnote" style={{ marginTop: '16px' }}>
              Note on fundraising events: The percentages shown reflect gross allocation, not net cost. Any returns generated go back into the overall fund.
            </p>
          </div>

        </div>
      </main>
      </div>
      <Footer />
    </div>
  );
}