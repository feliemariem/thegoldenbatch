import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/profileNew.css';
import '../styles/committee.css';
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
      setDonors(
        (data.donors || []).slice().sort((a, b) => {
          const lastA = a.trim().split(' ').pop();
          const lastB = b.trim().split(' ').pop();
          return lastA.localeCompare(lastB);
        })
      );
    } catch (err) {
      console.error('Failed to fetch donors');
    }
  };

  // Redirect non-graduates away from Funds page
  useEffect(() => {
    if (user && !user.is_graduate) {
      navigate('/profile');
    }
  }, [user, navigate]);

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
          <div className="committee-header" style={{ marginBottom: '0' }}>
            <h2>25th Alumni Homecoming Fund</h2>
          </div>

          {/* Total Funds Display */}
          <div className="funds-balance-card">
            <p className="funds-label">Current Balance</p>
            {loading ? (
              <p className="funds-total-loading">{['Hulat!', 'Dali lang gid ha?', 'Wait lang...'][Math.floor(Math.random() * 3)]}</p>
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
                      style={{ width: `${Math.min((balance / 2500000) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="funds-progress-text">
                    {((balance / 2500000) * 100).toFixed(1)}% of {formatPeso(2500000, 0)} Core Events Target
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
            <h3 className="donate-heading" style={{ textAlign: 'center'}}>Payment Methods</h3>

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
              <h3 className="thank-you-title">Thank You for Your Contributions</h3>
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
              Supported by contributions, fundraising, and sponsorships. {formatPeso(2500000, 0)} Core Events Target.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '20px' }}>
              <div className="donate-card" style={{ borderLeft: '4px solid #006633', borderRadius: '0 8px 8px 0' }}>
                <h4 className="donate-card-title" style={{ color: '#006633', marginBottom: '8px' }}>Core Events</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: 0 }}>The main homecoming and everything that makes the night happen. Details to be announced soon.</p>
              </div>

              <div className="donate-card" style={{ borderLeft: '4px solid #CFB53B', borderRadius: '0 8px 8px 0' }}>
                <h4 className="donate-card-title" style={{ color: '#CFB53B', marginBottom: '8px' }}>Fundraising / Special Events</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: 0 }}>Events we run to raise funds, and the giving-back work beyond the batch. Details to be announced soon.</p>
              </div>
            </div>
          </div>

        </div>
      </main>
      </div>
      <Footer />
    </div>
  );
}