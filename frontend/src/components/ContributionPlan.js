import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
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
  const [recognitionPublic, setRecognitionPublic] = useState(true);
  const [openFaqs, setOpenFaqs] = useState([]);
  const toggleFaq = (id) => setOpenFaqs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const exchangeRatesCache = useRef(null);
  const tierHeadingRef = useRef(null);
  const progressRef = useRef(null);
  const allocationRef = useRef(null);
  const recognitionRef = useRef(null);
  const faqRef = useRef(null);

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
        pledge_amount: amount,
        recognition_public: recognitionPublic
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
            <button className="cp-toc-pill" onClick={() => faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              FAQ
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
              <p>The ₱2.1M shown here represents our total batch vision — covering the Main Event, Teachers' Dinner, commemorative items, fundraising initiatives, and our Giving Back commitment. This figure is based on itemized budget estimates for each component. This is not an amount expected to come solely from direct contributions. We are using a <b>hybrid model</b>, combining batch contributions with income generated from selected initiatives.</p>
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
                    <span className="cp-alloc-pct">2%</span>
                  </div>
                  <div className="cp-alloc-item">
                    <span className="cp-alloc-icon">🏀</span>
                    <div className="cp-alloc-details">
                      <div className="cp-alloc-name">In Memoriam Basketball Cup</div>
                      <div className="cp-alloc-desc">A tribute to a batchmate we lost, played in their honor.</div>
                    </div>
                    <span className="cp-alloc-pct">2%</span>
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

                {/* Recognition Opt-in Toggle */}
                <div className="cp-recognition-toggle">
                  <label className="cp-recognition-label">
                    <input
                      type="checkbox"
                      checked={recognitionPublic}
                      onChange={(e) => setRecognitionPublic(e.target.checked)}
                      className="cp-recognition-checkbox"
                    />
                    <span className="cp-recognition-text">Display my name in Builder recognition (Builder's Wall, program, website, stage)</span>
                  </label>
                  <div className="cp-recognition-note">You can change this anytime from your profile.</div>
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
                <p>La Sallian Golf, La Sallian Run, In Memoriam Football Cup, and In Memoriam Basketball Cup are classified as fundraising initiatives. While they require upfront operating costs — covered within the 20% allocation — they are designed to generate revenue through entry fees and sponsorships. The percentages shown reflect gross allocation, not net cost. Any returns generated by these events go back into the overall fund, effectively reducing the batch's total contribution burden.</p>
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

            {/* FAQ Section */}
            <div className="cp-faq-section" ref={faqRef}>
              <h2 className="cp-faq-heading">Frequently Asked Questions</h2>

              {/* FAQ Navigation Pills */}
              <nav className="cp-faq-nav">
                <a href="#about-the-plan" className="cp-faq-nav-pill">About the Plan</a>
                <a href="#about-the-tiers" className="cp-faq-nav-pill">About the Tiers</a>
                <a href="#about-payment" className="cp-faq-nav-pill">About Payment</a>
                <a href="#about-recognition" className="cp-faq-nav-pill">About Recognition</a>
                <a href="#about-fundraising" className="cp-faq-nav-pill">About Fundraising</a>
                <a href="#general" className="cp-faq-nav-pill">General</a>
                {user && !user.is_graduate && (
                  <a href="#friends-of-batch" className="cp-faq-nav-pill">Friends of Batch</a>
                )}
              </nav>

              {/* About the Plan */}
              <div className="cp-faq-group" id="about-the-plan">
                <div className="cp-faq-group-title">About the Plan</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('plan-1')}>
                    <span>What is the ₱2.1M for?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('plan-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('plan-1') ? 'open' : ''}`}>
                    That covers everything — the Main Event, Teachers' Dinner, shirts and keepsakes for every batchmate, our giving back project, seed money for the fundraising events, and a buffer just in case. It's the full picture of what we're building together.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('plan-2')}>
                    <span>How much do you actually need from us?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('plan-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('plan-2') ? 'open' : ''}`}>
                    We need about 100 batchmates to contribute to cover the core celebration. The fundraising events help close the gap to ₱2.1M. The more we raise from contributions, the less pressure we put on those events to carry the load.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('plan-3')}>
                    <span>Is this just for the party?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('plan-3') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('plan-3') ? 'open' : ''}`}>
                    No. It also covers the Teachers' Dinner, shirts and keepsakes for every batchmate, something we're giving back to the school, seed money to get our fundraising events going, and a buffer just in case.
                  </div>
                </div>
              </div>

              {/* About the Tiers */}
              <div className="cp-faq-group" id="about-the-tiers">
                <div className="cp-faq-group-title">About the Tiers</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-1')}>
                    <span>What are the tiers?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-1') ? 'open' : ''}`}>
                    We have four. Cornerstone, Pillar, Anchor, and Root. They're not rankings. Think of it like a building — every part carries weight. A Root is not less than a Cornerstone. They just carry different loads in the same foundation. Whatever tier you pick, you're a Builder.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-2')}>
                    <span>Why are there tiers?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-2') ? 'open' : ''}`}>
                    Because not everyone is in the same financial situation and that's okay. We still want everyone to be part of this. The tiers give you a range to choose from based on what works for you. Whatever you pick, it all goes into the same fund that makes this celebration happen. And the more we collect from contributions, the less pressure we put on the fundraising events to carry the gap.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-3')}>
                    <span>What's the difference between the tiers?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-3') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-3') ? 'open' : ''}`}>
                    It's how much you personally commit to the collective fund. All contributions go into the same pot that covers the entire celebration. The tiers tell us your share of the load — and the higher the tier, the more you're recognized for it.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-4')}>
                    <span>What does Cornerstone get me?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-4') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-4') ? 'open' : ''}`}>
                    ₱25,000 and up. You're carrying one of the biggest individual loads in the batch. Your contribution goes into the heart of the Main Event — the venue, production, and program. And because you're giving the most, you also get the fullest recognition, including a permanent spot on the Giving Back Dedication at the school.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-5')}>
                    <span>What about Pillar?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-5') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-5') ? 'open' : ''}`}>
                    ₱18,000 to ₱24,000. You're funding a significant part of the core celebration. Serious commitment, and you get stage acknowledgment and your own spotlight on the website.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-6')}>
                    <span>And Anchor?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-6') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-6') ? 'open' : ''}`}>
                    ₱10,000 to ₱17,000. Still a real, meaningful share of what makes this celebration happen. You're on the Builder's Wall and in the souvenir program.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-7')}>
                    <span>What if I can't commit to a fixed amount?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-7') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-7') ? 'open' : ''}`}>
                    Pick Root. No minimum, no pressure. Whatever you give goes into the same collective fund. You're still helping build this. You're still a Builder.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-8')}>
                    <span>Can I change my tier later?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-8') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-8') ? 'open' : ''}`}>
                    Yes, anytime from your profile.
                  </div>
                </div>
              </div>

              {/* About Payment */}
              <div className="cp-faq-group" id="about-payment">
                <div className="cp-faq-group-title">About Payment</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('payment-1')}>
                    <span>How do I pay?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('payment-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('payment-1') ? 'open' : ''}`}>
                    For local transfers, deposit to our PNB account under Narciso Javelosa III or Mary Rose Frances Uy, account number 307770014898. For international transfers, we have SWIFT details through PNB Bacolod Lacson Branch. All the details are in the contribution plan on your profile page.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('payment-2')}>
                    <span>Does it have to be all at once?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('payment-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('payment-2') ? 'open' : ''}`}>
                    No. You have until December 2028 — that's {getMonthsRemaining()} months from now. Pay in parts, at whatever pace works for you. The plan shows you what it looks like monthly, weekly, even daily so you can plan ahead.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('payment-3')}>
                    <span>How does my payment get recorded?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('payment-3') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('payment-3') ? 'open' : ''}`}>
                    After you pay, upload a photo of your receipt on your profile page. The committee verifies it within 48 hours. Once verified, it shows up in your contribution progress and the batch Fund page. Make sure your full name is in the transfer reference so it gets matched to you quickly. Nothing gets credited until the receipt is verified.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('payment-4')}>
                    <span>Who handles the money?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('payment-4') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('payment-4') ? 'open' : ''}`}>
                    Contributions go to a PNB account under our co-signatories, Atty. Narciso Javelosa III and our Treasurer, Mary Rose Frances Uy. Every deposit is tracked on the platform. You can see the batch total anytime on the <Link to="/funds" className="cp-faq-link">Fund page</Link>. We want every peso accounted for and visible.
                  </div>
                </div>
              </div>

              {/* About Recognition */}
              <div className="cp-faq-group" id="about-recognition">
                <div className="cp-faq-group-title">About Recognition</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('recog-1')}>
                    <span>Will my name be public?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('recog-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('recog-1') ? 'open' : ''}`}>
                    Only if you want it to be. When you select your tier inside the Contribution Plan, there's a toggle at the bottom before you confirm. Switch it on and your name goes on the Builder's Wall, souvenir program, website, and stage acknowledgment. Switch it off and your contribution still counts, your name just stays private. You can change this anytime from your profile.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('recog-2')}>
                    <span>What is the Builder's Wall?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('recog-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('recog-2') ? 'open' : ''}`}>
                    A physical display at the venue entrance on the night of the event. Every guest sees it when they walk in.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('recog-3')}>
                    <span>What is the Giving Back Dedication?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('recog-3') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('recog-3') ? 'open' : ''}`}>
                    A permanent marker at the school for our giving back project. Cornerstone Builders who opt in are listed as founding supporters. It stays there long after the event is over.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('recog-4')}>
                    <span>What is the commemorative keepsake?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('recog-4') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('recog-4') ? 'open' : ''}`}>
                    Every Builder gets one. The committee is still deciding what it will be. We'll let everyone know once it's confirmed.
                  </div>
                </div>
              </div>

              {/* About Fundraising */}
              <div className="cp-faq-group" id="about-fundraising">
                <div className="cp-faq-group-title">About the Fundraising Events</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('fund-1')}>
                    <span>What are the fundraising events?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('fund-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('fund-1') ? 'open' : ''}`}>
                    La Sallian Golf, La Sallian Run, In Memoriam Football Cup, and In Memoriam Basketball Cup. Whatever they earn from entry fees and sponsors goes back into the fund. That's what helps us reach ₱2.1M without putting all the pressure on direct contributions alone.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('fund-2')}>
                    <span>Do I have to join them?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('fund-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('fund-2') ? 'open' : ''}`}>
                    No. They're completely separate from your Builder tier. We'll share details for each one when the time comes.
                  </div>
                </div>
              </div>

              {/* General */}
              <div className="cp-faq-group" id="general">
                <div className="cp-faq-group-title">General</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('gen-1')}>
                    <span>What if the target isn't reached?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('gen-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('gen-1') ? 'open' : ''}`}>
                    The core celebration is protected first. The plan is built so that even in a conservative scenario, the Main Event, Teachers' Dinner, and everything that matters most will still happen. The fundraising events and contingency buffer exist exactly for this reason.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('gen-2')}>
                    <span>Where can I see how much has been raised?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('gen-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('gen-2') ? 'open' : ''}`}>
                    Two places. The progress bar is live on the contribution plan inside your profile. There's also a dedicated <Link to="/funds" className="cp-faq-link">Fund page</Link> that shows the full picture — every verified contribution, where the money is going, and the running total. Once a payment is verified by the committee, it shows up there. Nothing is hidden. You'll always know where the batch stands.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('gen-3')}>
                    <span>I still have questions.</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('gen-3') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('gen-3') ? 'open' : ''}`}>
                    Head to your <Link to="/inbox" className="cp-faq-link">Inbox</Link> and use Contact Committee — we'll get back to you. You can also check the <Link to="/committee" className="cp-faq-link">Committee page</Link> to see who's who and reach out to them outside the platform.
                  </div>
                </div>
              </div>

              {/* Friends of Batch - Only for non-graduates */}
              {user && !user.is_graduate && (
                <div className="cp-faq-group" id="friends-of-batch">
                  <div className="cp-faq-group-title">For Friends of Batch</div>

                  <div className="cp-faq-item">
                    <button className="cp-faq-question" onClick={() => toggleFaq('fob-1')}>
                      <span>I'm not a graduate. Can I still contribute?</span>
                      <span className={`cp-faq-arrow ${openFaqs.includes('fob-1') ? 'open' : ''}`}>▼</span>
                    </button>
                    <div className={`cp-faq-answer ${openFaqs.includes('fob-1') ? 'open' : ''}`}>
                      Yes, and we're grateful if you do. Friends of Batch are welcome to support the celebration. There's no requirement and no pressure — this is completely voluntary. If you choose to contribute, you'll be recognized as a Friend of Batch sponsor in the souvenir program, Builder's Wall, and website. The same opt-in rules apply.
                    </div>
                  </div>

                  <div className="cp-faq-item">
                    <button className="cp-faq-question" onClick={() => toggleFaq('fob-2')}>
                      <span>Do I pick a tier as a Friend of Batch?</span>
                      <span className={`cp-faq-arrow ${openFaqs.includes('fob-2') ? 'open' : ''}`}>▼</span>
                    </button>
                    <div className={`cp-faq-answer ${openFaqs.includes('fob-2') ? 'open' : ''}`}>
                      You can use the same tiers as a reference for how much you'd like to give. But there's no obligation to hit any minimum. Whatever you're comfortable with is welcome.
                    </div>
                  </div>

                  <div className="cp-faq-item">
                    <button className="cp-faq-question" onClick={() => toggleFaq('fob-3')}>
                      <span>Will I be recognized the same way as graduates?</span>
                      <span className={`cp-faq-arrow ${openFaqs.includes('fob-3') ? 'open' : ''}`}>▼</span>
                    </button>
                    <div className={`cp-faq-answer ${openFaqs.includes('fob-3') ? 'open' : ''}`}>
                      You'll be listed separately as a Friend of Batch sponsor, not grouped with the Builder tiers. But you're still recognized and still appreciated. Every contribution goes into the same fund that makes this celebration happen.
                    </div>
                  </div>
                </div>
              )}
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
