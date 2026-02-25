import React, { useState, useEffect } from 'react';
import { apiPut, apiGet } from '../api';
import '../styles/contributionPlan.css';

const TIERS = {
  cornerstone: { label: 'Cornerstone', min: 25000, max: null },
  pillar: { label: 'Pillar', min: 18000, max: 24000 },
  anchor: { label: 'Anchor', min: 10000, max: 17000 },
  root: { label: 'Root', min: null, max: null }
};

// Calculate months remaining from today to Dec 2028
function getMonthsRemaining() {
  const now = new Date();
  const start = new Date(2026, 0, 1);
  const end = new Date(2028, 11, 31);
  const from = now < start ? start : now;
  if (from >= end) return 1;
  const months = (end.getFullYear() - from.getFullYear()) * 12 + (end.getMonth() - from.getMonth());
  return Math.max(months, 1);
}

function getStartLabel() {
  const now = new Date();
  const start = new Date(2026, 0, 1);
  const from = now < start ? start : now;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames[from.getMonth()] + ' ' + from.getFullYear();
}

function formatNumber(num) {
  return num.toLocaleString();
}

export default function ContributionPlan({ isOpen, onClose, onTierSaved, currentTier, currentPledge, user }) {
  const [selectedTier, setSelectedTier] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [batchProgress, setBatchProgress] = useState({ total_raised: 0, builder_count: 0, goal: 2100000 });

  // Fetch batch progress
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await apiGet('/api/ledger/total-raised');
        if (res.ok) {
          const data = await res.json();
          setBatchProgress(data);
        }
      } catch (err) {
        console.error('Failed to fetch batch progress:', err);
      }
    };
    if (isOpen) fetchProgress();
  }, [isOpen]);

  // Pre-select current tier if returning
  useEffect(() => {
    if (isOpen && currentTier && TIERS[currentTier]) {
      setSelectedTier(currentTier);
      if (currentPledge && currentTier !== 'root') {
        setPledgeAmount(formatNumber(currentPledge));
      }
    }
  }, [isOpen, currentTier, currentPledge]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const months = getMonthsRemaining();

  const handleTierSelect = (tier) => {
    if (confirmed) return;
    setSelectedTier(tier);
    setPledgeAmount('');
    setError('');
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw) {
      setPledgeAmount(parseInt(raw).toLocaleString());
    } else {
      setPledgeAmount('');
    }
    setError('');
  };

  const getRawAmount = () => {
    return parseInt(pledgeAmount.replace(/[^0-9]/g, '')) || 0;
  };

  const validatePledge = () => {
    if (!selectedTier || selectedTier === 'root') return { valid: true, message: '' };
    const config = TIERS[selectedTier];
    const amount = getRawAmount();

    if (!pledgeAmount) return { valid: false, message: '' };

    if (config.min && amount < config.min) {
      return { valid: false, message: `Minimum for ${config.label} is ₱${formatNumber(config.min)}` };
    }
    if (config.max && amount > config.max) {
      const nextTier = selectedTier === 'anchor' ? 'Pillar' : 'Cornerstone';
      return { valid: true, message: `₱${formatNumber(amount)} qualifies for ${nextTier}! Consider upgrading.`, isUpgrade: true };
    }
    return { valid: true, message: '' };
  };

  const validation = validatePledge();
  const canConfirm = selectedTier === 'root' || (validation.valid && getRawAmount() > 0);

  const handleConfirm = async () => {
    if (!selectedTier || saving) return;

    const amount = selectedTier === 'root' ? null : getRawAmount();

    setSaving(true);
    setError('');

    try {
      const res = await apiPut('/api/me/builder-tier', {
        tier: selectedTier,
        pledge_amount: amount
      });

      if (res.ok) {
        setConfirmed(true);
        onTierSaved(selectedTier, amount);
        // Refresh progress to update builder count
        const progressRes = await apiGet('/api/ledger/total-raised');
        if (progressRes.ok) {
          setBatchProgress(await progressRes.json());
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save tier');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedTier(null);
    setPledgeAmount('');
    setConfirmed(false);
    setError('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const amount = getRawAmount();
  const monthly = amount > 0 ? Math.ceil(amount / months) : 0;
  const weekly = amount > 0 ? Math.ceil(amount / (months * 4.33)) : 0;
  const daily = amount > 0 ? Math.ceil(amount / (months * 30.44)) : 0;

  return (
    <div className="cp-overlay" onClick={handleClose}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cp-close" onClick={handleClose}>&times;</button>

        <div className="cp-scroll">
          {/* Header */}
          <header className="cp-header">
            <div className="cp-badge">Contribution & Funding Plan</div>
            <div className="cp-header-content">
              <div className="cp-header-left">
                <h1 className="cp-site-title"><span className="cp-green-text">USLS-IS</span> <span className="cp-gold-text">2003</span></h1>
                <div className="cp-subtitle">25th Alumni Homecoming · Dec. 16, 2028 · Santuario de La Salle, Bacolod City</div>
                <div className="cp-pillars">
                  <span className="cp-pillar-pill">Reconnect</span>
                  <span className="cp-pillar-pill">Celebrate</span>
                  <span className="cp-pillar-pill">Network</span>
                  <span className="cp-pillar-pill">Give Back</span>
                </div>
              </div>
              <div className="cp-header-right">
                <div className="cp-label">Funding Target</div>
                <div className="cp-funding-target">₱{batchProgress.goal.toLocaleString()}</div>
              </div>
            </div>
          </header>

          <main className="cp-main">
            {/* Progress Box */}
            <div className="cp-progress-box">
              <div className="cp-progress-label">Our Progress</div>
              <div className="cp-progress-row">
                <div className="cp-progress-amount">₱{batchProgress.total_raised.toLocaleString()}</div>
                <div className="cp-progress-pct">{((batchProgress.total_raised / batchProgress.goal) * 100).toFixed(1)}%</div>
              </div>
              <div className="cp-progress-sub">
                <span>raised so far</span>
                <span>of ₱{batchProgress.goal.toLocaleString()} goal</span>
              </div>
              <div className="cp-progress-bar-track">
                <div className="cp-progress-bar-fill" style={{ width: `${(batchProgress.total_raised / batchProgress.goal) * 100}%` }}></div>
              </div>
              <div className="cp-progress-timeline">January 2026 — December 2028</div>
            </div>

            {/* Letter */}
            <div className="cp-letter">
              <p><b className="cp-green">Dear Batchmates,</b></p>
              <p>As we prepare for our 25th Homecoming, we want to share a clear and complete picture of what we're building together.</p>
              <p>The ₱2.1M shown here represents our total batch vision — covering the Main Event, Teachers' Dinner, commemorative items, fundraising initiatives, and our Giving Back commitment. This is not an amount expected to come solely from direct contributions. We are using a <b>hybrid model</b>, combining batch contributions with income generated from selected initiatives.</p>
              <p>The Main Event remains the centerpiece of our milestone celebration, while our fundraising initiatives are structured to generate additional returns to support the overall plan. Our goal is transparency, balance, and a celebration worthy of 25 years.</p>
              <p className="cp-sign">— USLS-IS Batch 2003 Organizing Committee</p>
            </div>

            <div className="cp-gold-divider"></div>

            {/* Where Your Contribution Goes */}
            <h2 className="cp-section-title">Where your contribution goes</h2>
            <p className="cp-section-subtitle">Total plan supported by contributions and fundraising. ₱2,100,000 Full Batch Vision Target.</p>

            {/* Core Celebration */}
            <div className="cp-alloc-group">
              <div className="cp-alloc-section-label">Core Celebration</div>
              <div className="cp-alloc-row">
                <div className="cp-alloc-items">
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">🎉</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">Main Event</div>
                      <div className="cp-alloc-desc">Primary celebration covering venue, catering, production, and full program execution.</div>
                    </div>
                    <span className="cp-alloc-pct">50%</span>
                  </div>
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">🎓</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">Teachers' Dinner</div>
                      <div className="cp-alloc-desc">A separate evening dedicated to the teachers who shaped us. Our way of saying thank you, long overdue.</div>
                    </div>
                    <span className="cp-alloc-pct">12%</span>
                  </div>
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">👕</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">Merch & Commemorative Items</div>
                      <div className="cp-alloc-desc">Every batchmate gets a shirt. Premium items sold separately help offset the cost.</div>
                    </div>
                    <span className="cp-alloc-pct">8%</span>
                  </div>
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">💚</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">Charity / Giving Back</div>
                      <div className="cp-alloc-desc">A portion of what we raise goes back to the school and its community.</div>
                    </div>
                    <span className="cp-alloc-pct">7%</span>
                  </div>
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">🔒</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">Contingency & Buffer</div>
                      <div className="cp-alloc-desc">Reserved buffer to protect the batch from unforeseen costs.</div>
                    </div>
                    <span className="cp-alloc-pct">3%</span>
                  </div>
                </div>
                <div className="cp-big-pct-block">
                  <div className="cp-big-pct">80%</div>
                  <div className="cp-big-pct-label">of total batch vision</div>
                </div>
              </div>
              <div className="cp-alloc-note">
                <div className="cp-alloc-bar"><div className="cp-alloc-bar-fill green" style={{ width: '80%' }}></div></div>
                80% of our total plan funds the core celebration — the Main Event, Teachers' Dinner, and commemorative items.
              </div>
            </div>

            {/* Fundraising Initiatives */}
            <div className="cp-alloc-group">
              <div className="cp-alloc-section-label">Fundraising Initiatives</div>
              <div className="cp-alloc-row">
                <div className="cp-alloc-items">
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">⛳</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">La Sallian Golf</div>
                      <div className="cp-alloc-desc">A 2-day event at Negros Occidental Golf & Country Club (formerly Marapara) bringing La Sallians together from across the nation.</div>
                    </div>
                    <span className="cp-alloc-pct">10%</span>
                  </div>
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">🏃</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">La Sallian Run</div>
                      <div className="cp-alloc-desc">A tradition started by our own peers, held first quarter of 2028.</div>
                    </div>
                    <span className="cp-alloc-pct">6%</span>
                  </div>
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">⚽</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">In Memoriam Football Cup</div>
                      <div className="cp-alloc-desc">A tribute to the batchmates we've lost, played in their honor.</div>
                    </div>
                    <span className="cp-alloc-pct">4%</span>
                  </div>
                </div>
                <div className="cp-big-pct-block">
                  <div className="cp-big-pct gold">20%</div>
                  <div className="cp-big-pct-label">revenue initiative</div>
                </div>
              </div>
              <div className="cp-alloc-note">
                Upfront operating allocation. Designed to generate sponsorship and entry-fee returns to support the overall fund.
                <div className="cp-alloc-bar" style={{ marginTop: '12px' }}><div className="cp-alloc-bar-fill gold" style={{ width: '20%' }}></div></div>
                20% is allocated to launch the Golf tournament, designed to attract sponsors and generate returns to support the overall fund.
              </div>
            </div>

            <div className="cp-gold-divider"></div>

            {/* Builder Tiers */}
            <h2 className="cp-tier-heading">Golden Batch Builders</h2>
            <p className="cp-section-subtitle cp-italic">We're all building this homecoming. Choose how you build.</p>
            <p className="cp-builders-count">{batchProgress.builder_count} Builder{batchProgress.builder_count !== 1 ? 's' : ''} already in.</p>
            <p className="cp-tier-hint">Tap a tier to begin.</p>

            <div className="cp-tier-grid">
              {/* Cornerstone */}
              <div
                className={`cp-tier-card cornerstone ${selectedTier === 'cornerstone' ? 'selected' : ''}`}
                onClick={() => handleTierSelect('cornerstone')}
              >
                <div className="cp-tier-check">✓</div>
                <div className="cp-tier-label">Cornerstone</div>
                <div className="cp-tier-tagline">The foundation everything else is built on.</div>
                <div className="cp-tier-amount">₱25,000+</div>
                <div className="cp-tier-monthly">≈ ₱694 / month · 36 months</div>
                <div className="cp-tier-desc">Covers a full program segment of the Main Event, including venue and production.</div>
                <div className="cp-tier-flex-note">Flexible installments welcome.</div>
              </div>

              {/* Pillar */}
              <div
                className={`cp-tier-card pillar ${selectedTier === 'pillar' ? 'selected' : ''}`}
                onClick={() => handleTierSelect('pillar')}
              >
                <div className="cp-tier-check">✓</div>
                <div className="cp-tier-label">Pillar</div>
                <div className="cp-tier-tagline">Holding this reunion up.</div>
                <div className="cp-tier-amount">₱18,000 – ₱24,000</div>
                <div className="cp-tier-monthly">≈ ₱500 – ₱667 / month · 36 months</div>
                <div className="cp-tier-desc">Fully funds a major event component such as the Teachers' Dinner or staging.</div>
                <div className="cp-tier-flex-note">Flexible installments welcome.</div>
              </div>

              {/* Anchor */}
              <div
                className={`cp-tier-card anchor ${selectedTier === 'anchor' ? 'selected' : ''}`}
                onClick={() => handleTierSelect('anchor')}
              >
                <div className="cp-tier-check">✓</div>
                <div className="cp-tier-label">Anchor</div>
                <div className="cp-tier-tagline">Keeping us grounded and moving forward.</div>
                <div className="cp-tier-amount">₱10,000 – ₱17,000</div>
                <div className="cp-tier-monthly">≈ ₱278 – ₱472 / month · 36 months</div>
                <div className="cp-tier-desc">Supports venue logistics, commemorative items, and program execution.</div>
                <div className="cp-tier-flex-note">Flexible installments welcome.</div>
              </div>

              {/* Root */}
              <div
                className={`cp-tier-card root ${selectedTier === 'root' ? 'selected' : ''}`}
                onClick={() => handleTierSelect('root')}
              >
                <div className="cp-tier-check">✓</div>
                <div className="cp-tier-label">Root</div>
                <div className="cp-tier-tagline">Every contribution builds our 25-year legacy. You are part of it.</div>
                <div className="cp-tier-amount">Open amount</div>
                <div className="cp-tier-monthly">Any pace · Any amount</div>
                <div className="cp-tier-desc">Strengthens the collective fund and secures the success of our celebration.</div>
                <div className="cp-tier-flex-note">Flexible installments welcome.</div>
              </div>
            </div>

            {/* Pledge Panel */}
            <div className={`cp-pledge-panel ${selectedTier && !confirmed ? 'open' : ''}`}>
              <div className="cp-pledge-inner">
                <div className="cp-pledge-header">
                  <div className={`cp-pledge-tier-badge ${selectedTier || ''}`}>
                    {selectedTier ? TIERS[selectedTier].label : ''}
                  </div>
                  <div className="cp-pledge-title">
                    {selectedTier === 'root' ? 'Contribute at your own pace' : 'How much would you like to contribute?'}
                  </div>
                </div>

                {/* Amount input (hidden for Root) */}
                {selectedTier && selectedTier !== 'root' && (
                  <div className="cp-pledge-amount-section">
                    <div className="cp-pledge-amount-label">Your pledge amount</div>
                    <div className="cp-pledge-amount-hint">
                      {selectedTier === 'cornerstone' ? 'Minimum ₱25,000' :
                       `₱${formatNumber(TIERS[selectedTier].min)} – ₱${formatNumber(TIERS[selectedTier].max)}`}
                    </div>
                    <div className="cp-pledge-input-row">
                      <div className="cp-pledge-input-wrapper">
                        <span className="cp-pledge-currency">₱</span>
                        <input
                          type="text"
                          className={`cp-pledge-input ${!validation.valid && validation.message ? 'error' : ''}`}
                          placeholder="Enter your amount"
                          value={pledgeAmount}
                          onChange={handleAmountChange}
                          inputMode="numeric"
                        />
                      </div>
                      {amount > 0 && (
                        <div className="cp-pledge-monthly-calc">
                          ≈ ₱{formatNumber(monthly)} / month over {months} months
                        </div>
                      )}
                    </div>
                    <div className={`cp-pledge-error ${validation.isUpgrade ? 'upgrade' : ''}`}>
                      {validation.message}
                    </div>

                    {/* Dynamic breakdown */}
                    {amount > 0 && (
                      <div className="cp-pledge-breakdown visible">
                        <div className="cp-pledge-breakdown-title">Your contribution breakdown</div>
                        <div className="cp-breakdown-grid">
                          <div className="cp-breakdown-item">
                            <div className="cp-breakdown-value">₱{formatNumber(monthly)}</div>
                            <div className="cp-breakdown-label">per month</div>
                          </div>
                          <div className="cp-breakdown-item">
                            <div className="cp-breakdown-value">₱{formatNumber(weekly)}</div>
                            <div className="cp-breakdown-label">per week</div>
                          </div>
                          <div className="cp-breakdown-item">
                            <div className="cp-breakdown-value">₱{formatNumber(daily)}</div>
                            <div className="cp-breakdown-label">per day</div>
                          </div>
                        </div>
                        <div className="cp-breakdown-remaining">
                          <strong>₱{formatNumber(amount)}</strong> over <strong>{months} months</strong> remaining
                          <br/>{getStartLabel()} — December 2028
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Root message */}
                {selectedTier === 'root' && (
                  <div className="cp-pledge-root-message">
                    <strong>No fixed commitment needed.</strong> Contribute at your own pace, in any amount. Every peso builds our 25-year legacy. Your contributions will be tracked on your profile — no target, no pressure.
                  </div>
                )}

                {/* Payment Methods */}
                <div className="cp-payment-methods">
                  <div className="cp-payment-methods-title">Payment Methods</div>
                  <div className="cp-payment-grid">
                    <div className="cp-payment-card">
                      <div className="cp-payment-card-label">Bank Deposit</div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Bank</div>
                        <div className="cp-payment-detail-value">PNB (Philippine National Bank - Bacolod)</div>
                      </div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Account Names</div>
                        <div className="cp-payment-detail-value">Narciso Javelosa III or Mary Rose Frances Uy</div>
                      </div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Account Number</div>
                        <div className="cp-payment-detail-value">307770014898</div>
                      </div>
                    </div>
                    <div className="cp-payment-card">
                      <div className="cp-payment-card-label">For International Transfers</div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Bank</div>
                        <div className="cp-payment-detail-value">PNB Bacolod Lacson Branch</div>
                      </div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Address</div>
                        <div className="cp-payment-detail-value">10th Lacson Street, Bacolod City, Negros Occidental 6100</div>
                      </div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Tel</div>
                        <div className="cp-payment-detail-value">(63) (034) 432-0605 / 434-8007</div>
                      </div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">SWIFT Code</div>
                        <div className="cp-payment-detail-value">PNBMPHMM</div>
                      </div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Routing No</div>
                        <div className="cp-payment-detail-value">040080019</div>
                      </div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Email</div>
                        <div className="cp-payment-detail-value">bacolod_lacson@pnb.com.ph</div>
                      </div>
                      <div className="cp-payment-detail">
                        <div className="cp-payment-detail-label">Website</div>
                        <div className="cp-payment-detail-value">pnb.com.ph</div>
                      </div>
                    </div>
                  </div>
                  <div className="cp-payment-note">
                    <strong>Important:</strong> After making a payment, upload your receipt on your profile page. The committee will verify and credit your account within 48 hours. Include your full name in the transfer reference for faster processing.
                  </div>
                  <div className="cp-payment-fees-note">
                    Transfer fees and applicable taxes are shouldered by sender.
                  </div>
                </div>

                {error && <div className="cp-error-message">{error}</div>}

                {/* Actions */}
                <div className="cp-pledge-actions">
                  <button
                    className="cp-btn-confirm"
                    onClick={handleConfirm}
                    disabled={!canConfirm || saving}
                  >
                    {saving ? 'Saving...' : 'Count Me In'}
                  </button>
                  <button className="cp-btn-change" onClick={handleReset}>Change Tier</button>
                </div>
              </div>
            </div>

            {/* Success Panel */}
            <div className={`cp-success-panel ${confirmed ? 'open' : ''}`}>
              <div className="cp-success-inner">
                <div className="cp-success-icon">🏗️</div>
                <div className="cp-success-title">You're a Golden Batch Builder!</div>
                <div className="cp-success-message">
                  {selectedTier === 'root'
                    ? "You're in! Your contributions will be tracked on your profile — contribute at your own pace. Every peso counts."
                    : `Your commitment of ₱${formatNumber(getRawAmount())} as a ${TIERS[selectedTier]?.label} Builder has been recorded. That's ≈ ₱${formatNumber(monthly)}/month over ${months} months. You'll see your progress on your profile page.`
                  }
                </div>
                <div className="cp-success-tier-summary">
                  <span>{selectedTier ? TIERS[selectedTier].label : ''}</span> ·
                  <span className="amount">{selectedTier === 'root' ? 'Open' : `₱${formatNumber(getRawAmount())}`}</span>
                </div>
                <button className="cp-btn-start-over" onClick={handleReset}>Change my selection</button>
              </div>
            </div>

            {/* Info boxes */}
            <div className="cp-info-row">
              <div className="cp-info-box green-border">
                <div className="cp-info-box-title green">Note on Fundraising Events</div>
                <p>La Sallian Golf, La Sallian Run, and In Memoriam Football Cup are classified as fundraising initiatives. While they require upfront operating costs — covered within the 20% allocation — they are designed to generate revenue through entry fees and sponsorships. The percentages shown reflect gross allocation, not net cost. Any returns generated by these events go back into the overall fund, effectively reducing the batch's total contribution burden.</p>
              </div>
              <div className="cp-info-box gold-border">
                <div className="cp-info-box-title gold">Flexible monthly commitments.</div>
                <p>You can contribute in monthly installments from January 2026 through December 2028 — that's 36 months to reach your chosen tier. Every peso counts.</p>
              </div>
            </div>

            {/* Recognition */}
            <div className="cp-recognition-section">
              <h2 className="cp-tier-heading">Builder Recognition</h2>
              <p className="cp-section-subtitle">Every Builder is recognized. Greater commitments carry additional visibility and legacy distinction.</p>

              <div className="cp-table-wrapper">
                <table className="cp-recognition-table">
                  <thead>
                    <tr>
                      <th>Recognition</th>
                      <th className="gold-col">Cornerstone</th>
                      <th className="gold-col">Pillar</th>
                      <th>Anchor</th>
                      <th>Root</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Builder's Wall</td>
                      <td className="check">✓</td>
                      <td className="check">✓</td>
                      <td className="check">✓</td>
                      <td className="check">✓</td>
                    </tr>
                    <tr>
                      <td>Souvenir Program</td>
                      <td className="check">✓</td>
                      <td className="check">✓</td>
                      <td className="check">✓</td>
                      <td className="check">✓</td>
                    </tr>
                    <tr>
                      <td>Website Spotlight</td>
                      <td className="detail">Individual feature</td>
                      <td className="detail">Individual feature</td>
                      <td className="detail">Grouped feature</td>
                      <td className="detail">Funds page credits</td>
                    </tr>
                    <tr>
                      <td>Stage Acknowledgment</td>
                      <td className="detail">Named segment</td>
                      <td className="detail">Consolidated mention</td>
                      <td className="dash">—</td>
                      <td className="dash">—</td>
                    </tr>
                    <tr>
                      <td>Giving Back Dedication</td>
                      <td className="check">✓</td>
                      <td className="dash">—</td>
                      <td className="dash">—</td>
                      <td className="dash">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="cp-recog-grid">
                <div className="cp-recog-card">
                  <div className="cp-recog-card-title">Builder's Wall</div>
                  <p>Physical display at the venue entrance with all Builder names organized by tier.</p>
                </div>
                <div className="cp-recog-card">
                  <div className="cp-recog-card-title">Souvenir Program</div>
                  <p>Dedicated page in the printed program with all Builder names. Every attendee receives a copy.</p>
                </div>
                <div className="cp-recog-card">
                  <div className="cp-recog-card-title">Website Spotlight</div>
                  <p>Featured on thegoldenbatch2003.com — individual profiles for Cornerstones and Pillars, grouped feature for Anchors.</p>
                </div>
                <div className="cp-recog-card">
                  <div className="cp-recog-card-title">Stage Acknowledgment</div>
                  <p>Cornerstones get a named program segment with their name on screen. Pillars are acknowledged together during a consolidated moment.</p>
                </div>
                <div className="cp-recog-card full">
                  <div className="cp-recog-card-title">Giving Back Dedication</div>
                  <p>A permanent plaque or marker for Batch 2003's giving-back project to the school — with Cornerstone names individually recognized as its founding contributors. A legacy that outlasts the celebration.</p>
                </div>
              </div>

              <div className="cp-commemorate">
                <div className="cp-commemorate-title">Commemorative Keepsake</div>
                <p>Every Builder will receive a commemorative item as a token of gratitude — the form this takes is still being finalized by the committee. It could be anything from a custom piece to a collectible memento. Details will be announced once confirmed.</p>
              </div>
            </div>

          </main>

          <footer className="cp-footer">
            <div className="cp-footer-text">USLS-IS Batch 2003 Organizing Committee</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
