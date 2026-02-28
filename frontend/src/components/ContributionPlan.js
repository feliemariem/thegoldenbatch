import React, { useState, useEffect, useRef } from 'react';
import { apiPut, apiGet } from '../api';
import '../styles/contributionPlan.css';

// Currency data grouped by region
const CURRENCY_GROUPS = [
  {
    region: 'Asia-Pacific',
    currencies: [
      { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
      { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
      { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
      { code: 'THB', name: 'Thai Baht', symbol: '฿' },
      { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
      { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
      { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
      { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' }
    ]
  },
  {
    region: 'Middle East',
    currencies: [
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
      { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
      { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
      { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
      { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب' },
      { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.' }
    ]
  },
  {
    region: 'Europe',
    currencies: [
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
      { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
      { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
      { code: 'DKK', name: 'Danish Krone', symbol: 'kr' }
    ]
  },
  {
    region: 'Americas',
    currencies: [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
      { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
      { code: 'ARS', name: 'Argentine Peso', symbol: '$' }
    ]
  },
  {
    region: 'Africa',
    currencies: [
      { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
      { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
      { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
      { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' }
    ]
  }
];

// Flatten currencies for easy lookup
const ALL_CURRENCIES = CURRENCY_GROUPS.flatMap(g => g.currencies);

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

// Format currency with proper symbol and 2 decimal places
function formatCurrency(amount, currencyCode, rates) {
  if (!rates || !rates[currencyCode]) return null;
  const converted = amount * rates[currencyCode];
  const currency = ALL_CURRENCIES.find(c => c.code === currencyCode);
  const symbol = currency ? currency.symbol : currencyCode;
  return `${symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ContributionPlan({ isOpen, onClose, onTierSaved, currentTier, currentPledge, user, scrollToTiers }) {
  const [selectedTier, setSelectedTier] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [batchProgress, setBatchProgress] = useState({ total_raised: 0, builder_count: 0, goal: 2100000 });
  const [selectedCurrency, setSelectedCurrency] = useState('PHP');
  const [exchangeRates, setExchangeRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const exchangeRatesCache = useRef(null);
  const tierHeadingRef = useRef(null);
  const progressRef = useRef(null);
  const allocationRef = useRef(null);
  const recognitionRef = useRef(null);

  // Fetch exchange rates (cached)
  useEffect(() => {
    const fetchRates = async () => {
      // Use cached rates if available
      if (exchangeRatesCache.current) {
        setExchangeRates(exchangeRatesCache.current);
        return;
      }

      setRatesLoading(true);
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/PHP');
        if (response.ok) {
          const data = await response.json();
          if (data.result === 'success') {
            exchangeRatesCache.current = data.rates;
            setExchangeRates(data.rates);
          }
        }
      } catch (err) {
        console.error('Failed to fetch exchange rates:', err);
      } finally {
        setRatesLoading(false);
      }
    };

    if (isOpen) fetchRates();
  }, [isOpen]);

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

  // Scroll to tier cards when scrollToTiers is true
  useEffect(() => {
    if (isOpen && scrollToTiers && tierHeadingRef.current) {
      setTimeout(() => {
        tierHeadingRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, 50);
    }
  }, [isOpen, scrollToTiers]);

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
    setShowRemoveConfirm(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleRemoveTier = async () => {
    setRemoving(true);
    setError('');

    try {
      const res = await apiPut('/api/me/builder-tier', {
        tier: null,
        pledge_amount: null
      });

      if (res.ok) {
        onTierSaved(null, null);
        handleClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove tier');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setRemoving(false);
      setShowRemoveConfirm(false);
    }
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

          {/* TOC Navigation */}
          <nav className="cp-toc">
            <button className="cp-toc-pill" onClick={() => progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Progress
            </button>
            <button className="cp-toc-pill" onClick={() => allocationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Allocation
            </button>
            <button className="cp-toc-pill" onClick={() => tierHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Tiers
            </button>
            <button className="cp-toc-pill" onClick={() => recognitionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Recognition
            </button>
          </nav>

          <main className="cp-main">
            {/* Progress Box */}
            <div className="cp-progress-box" ref={progressRef}>
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
              <p><b className="cp-green">Dear {user?.first_name || 'Batchmate'},</b></p>
              <p>As we prepare for our 25th Homecoming, we want to share a clear and complete picture of what we're building together.</p>
              <p>The ₱2.1M shown here represents our total batch vision — covering the Main Event, Teachers' Dinner, commemorative items, fundraising initiatives, and our Giving Back commitment. This is not an amount expected to come solely from direct contributions. We are using a <b>hybrid model</b>, combining batch contributions with income generated from selected initiatives.</p>
              <p>The Main Event remains the centerpiece of our milestone celebration, while our fundraising initiatives are structured to generate additional returns to support the overall plan. Our goal is transparency, balance, and a celebration worthy of 25 years.</p>
              <p className="cp-sign">— USLS-IS Batch 2003 Organizing Committee</p>
            </div>

            <div className="cp-gold-divider"></div>

            {/* Where Your Contribution Goes */}
            <h2 className="cp-section-title" ref={allocationRef}>Where your contribution goes</h2>
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
            <h2 className="cp-tier-heading" ref={tierHeadingRef}>Golden Batch Builders</h2>
            <p className="cp-section-subtitle cp-italic">We're all building this homecoming. Choose how you build.</p>
            <p className="cp-section-subtitle cp-italic">Each tier represents a different way of supporting the same goal — no one is 'higher,' just contributing differently.</p>
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
                        <div className="cp-breakdown-header">
                          <div className="cp-pledge-breakdown-title">Your contribution breakdown</div>
                          <div className="cp-currency-selector">
                            <label className="cp-currency-label">View in your currency</label>
                            <select
                              value={selectedCurrency}
                              onChange={(e) => setSelectedCurrency(e.target.value)}
                              className="cp-currency-dropdown"
                            >
                              {CURRENCY_GROUPS.map(group => (
                                <optgroup key={group.region} label={group.region}>
                                  {group.currencies.map(currency => (
                                    <option key={currency.code} value={currency.code}>
                                      {currency.code} — {currency.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="cp-breakdown-grid">
                          <div className="cp-breakdown-item">
                            <div className="cp-breakdown-value">₱{formatNumber(monthly)}</div>
                            {selectedCurrency !== 'PHP' && exchangeRates && (
                              <div className="cp-breakdown-converted">
                                {ratesLoading ? '...' : formatCurrency(monthly, selectedCurrency, exchangeRates)}
                              </div>
                            )}
                            <div className="cp-breakdown-label">per month</div>
                          </div>
                          <div className="cp-breakdown-item">
                            <div className="cp-breakdown-value">₱{formatNumber(weekly)}</div>
                            {selectedCurrency !== 'PHP' && exchangeRates && (
                              <div className="cp-breakdown-converted">
                                {ratesLoading ? '...' : formatCurrency(weekly, selectedCurrency, exchangeRates)}
                              </div>
                            )}
                            <div className="cp-breakdown-label">per week</div>
                          </div>
                          <div className="cp-breakdown-item">
                            <div className="cp-breakdown-value">₱{formatNumber(daily)}</div>
                            {selectedCurrency !== 'PHP' && exchangeRates && (
                              <div className="cp-breakdown-converted">
                                {ratesLoading ? '...' : formatCurrency(daily, selectedCurrency, exchangeRates)}
                              </div>
                            )}
                            <div className="cp-breakdown-label">per day</div>
                          </div>
                        </div>
                        <div className="cp-breakdown-remaining">
                          <strong>₱{formatNumber(amount)}</strong> over <strong>{months} months</strong> remaining
                          <br/>{getStartLabel()} — December 2028
                        </div>
                        {selectedCurrency !== 'PHP' && exchangeRates && (
                          <div className="cp-breakdown-total-converted">
                            ≈ {formatCurrency(amount, selectedCurrency, exchangeRates)} total
                          </div>
                        )}
                        {selectedCurrency !== 'PHP' && exchangeRates && (
                          <div className="cp-exchange-disclaimer">
                          Exchange rates are approximate and sourced from ExchangeRate-API. Actual rates at time of transfer may vary.
                          </div>
                        )}
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
                        <div className="cp-payment-detail-value">Philippine National Bank (PNB)</div>
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
                      <div className="cp-payment-card-label">International Transfers (SWIFT)</div>
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
            <div className="cp-recognition-section" ref={recognitionRef}>
              <h2 className="cp-tier-heading">Builder Recognition & Appreciation</h2>
              <p className="cp-section-subtitle">Every Builder is recognized. All recognition is opt-in — you choose whether your name appears publicly.</p>

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
                      <td className="detail">Named segment (opt-in)</td>
                      <td className="detail">Consolidated mention (opt-in)</td>
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
                  <p>Physical display at the venue entrance with Builder names organized by tier — listed only for those who opt in.</p>
                </div>
                <div className="cp-recog-card">
                  <div className="cp-recog-card-title">Souvenir Program</div>
                  <p>Dedicated page in the printed program with Builder names — listed only for those who opt in. Every attendee receives a copy.</p>
                </div>
                <div className="cp-recog-card">
                  <div className="cp-recog-card-title">Website Spotlight</div>
                  <p>Featured on thegoldenbatch2003.com — individual profiles for Cornerstones and Pillars (opt-in), grouped feature for Anchors.</p>
                </div>
                <div className="cp-recog-card">
                  <div className="cp-recog-card-title">Stage Acknowledgment</div>
                  <p>Cornerstones get a named program segment (opt-in). Pillars are acknowledged together during a consolidated moment (opt-in). Builders who prefer privacy are recognized in the program and ledger only.</p>
                </div>
                <div className="cp-recog-card full">
                  <div className="cp-recog-card-title">Giving Back Dedication</div>
                  <p>A permanent marker for Batch 2003's giving-back project to the school — Cornerstone Builders are acknowledged as founding supporters (opt-in). A legacy that outlasts the celebration.</p>
                </div>
              </div>

              <div className="cp-commemorate">
                <div className="cp-commemorate-title">Commemorative Keepsake</div>
                <p>Every Builder will receive a commemorative item as a token of gratitude — the form this takes is still being finalized by the committee. It could be anything from a custom piece to a collectible memento. Details will be announced once confirmed.</p>
              </div>
            </div>

            {/* Remove Tier Option - Only show if user already has a tier */}
            {currentTier && !confirmed && (
              <div className="cp-remove-tier-section">
                {!showRemoveConfirm ? (
                  <button
                    className="cp-btn-not-ready"
                    onClick={() => setShowRemoveConfirm(true)}
                  >
                    I'm not ready yet.
                  </button>
                ) : (
                  <div className="cp-remove-confirm">
                    <p className="cp-remove-confirm-text">
                      Are you sure? This will remove your current tier and pledge amount.
                    </p>
                    <div className="cp-remove-confirm-actions">
                      <button
                        className="cp-btn-remove-confirm"
                        onClick={handleRemoveTier}
                        disabled={removing}
                      >
                        {removing ? 'Removing...' : 'Yes, remove my tier'}
                      </button>
                      <button
                        className="cp-btn-remove-cancel"
                        onClick={() => setShowRemoveConfirm(false)}
                        disabled={removing}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </main>

          <footer className="cp-footer">
            <div className="cp-footer-text">USLS-IS Batch 2003 Organizing Committee</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
