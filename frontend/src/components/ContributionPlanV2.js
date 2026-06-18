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
  beyond: { label: 'Beyond', min: 100000, max: null },
  cornerstone: { label: 'Cornerstone', min: 50000, max: 99999 },
  pillar: { label: 'Pillar', min: 25000, max: 49999 },
  anchor: { label: 'Anchor', min: 10000, max: 24999 },
  root: { label: 'Root', min: null, max: null }
};

const TIER_TAGLINES = {
  beyond: 'For those who want to go above and beyond.',
  cornerstone: 'The foundation everything else is built on.',
  pillar: 'Holding this reunion up.',
  anchor: 'Keeping us grounded and moving forward.',
  root: 'Every contribution builds our 25-year legacy.'
};

// Calculate months remaining from today to Dec 2028
function getMonthsRemaining() {
  const now = new Date();
  const start = new Date(2026, 0, 1);
  const end = new Date(2028, 5, 30);
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

export default function ContributionPlanV2({ isOpen, onClose, onTierSaved, currentTier, currentPledge, user, scrollToTiers }) {
  const [selectedTier, setSelectedTier] = useState(null);
  const [expandedTier, setExpandedTier] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [batchProgress, setBatchProgress] = useState({ total_raised: 0, builder_count: 0, goal: 2500000 });
  const [selectedCurrency, setSelectedCurrency] = useState('PHP');
  const [exchangeRates, setExchangeRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [recognitionPublic, setRecognitionPublic] = useState(true);
  const [openFaqs, setOpenFaqs] = useState([]);
  const [letterOpen, setLetterOpen] = useState(false);
  const toggleFaq = (id) => setOpenFaqs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const exchangeRatesCache = useRef(null);
  const tierHeadingRef = useRef(null);
  const allocationRef = useRef(null);
  const faqRef = useRef(null);
  const pledgePanelRef = useRef(null);

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
          setBatchProgress({ ...data, goal: 2500000 });
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

  const handleTierCardClick = (tier) => {
    if (confirmed) return;
    // Toggle expanded panel
    if (expandedTier === tier) {
      setExpandedTier(null);
    } else {
      setExpandedTier(tier);
    }
  };

  const handleCountMeIn = () => {
    setSelectedTier(expandedTier);
    setExpandedTier(null);
    setPledgeAmount('');
    setError('');
    setTimeout(() => {
      pledgePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
      return { valid: false, message: `${config.label} starts at ₱${formatNumber(config.min)}.` };
    }
    if (config.max && amount > config.max) {
      return { valid: false, message: `${config.label} goes up to ₱${formatNumber(config.max)}. To give more, pick another tier.` };
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
          const data = await progressRes.json();
          setBatchProgress({ ...data, goal: 2500000 });
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
    setExpandedTier(null);
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

  // Get monthly estimate for tier card (uses dynamic months remaining, not hardcoded)
  const getTierMonthlyEstimate = (tier) => {
    const config = TIERS[tier];
    if (tier === 'root') return 'Any pace · Any amount';
    const minMonthly = config.min ? Math.ceil(config.min / months) : 0;
    return `≈ ₱${formatNumber(minMonthly)}+ / month · ${months} months`;
  };

  // Get amount display for tier card
  const getTierAmountDisplay = (tier) => {
    const config = TIERS[tier];
    if (tier === 'root') return 'Open amount';
    return `₱${formatNumber(config.min)}+`;
  };

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
                <div className="cp-label">Core Events Target</div>
                <div className="cp-funding-target">₱{batchProgress.goal.toLocaleString()}</div>
              </div>
            </div>
          </header>

          {/* TOC Navigation */}
          <nav className="cp-toc">
            <button className="cp-toc-pill" onClick={() => tierHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Tiers
            </button>
            <button className="cp-toc-pill" onClick={() => allocationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Allocation
            </button>
            <button className="cp-toc-pill" onClick={() => faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              FAQ
            </button>
          </nav>

          <main className="cp-main">
            {/* Progress Box */}
            {/* Letter */}
            <div className="cp-letter">
              <button
                className="cp-letter-toggle"
                onClick={() => setLetterOpen(o => !o)}
                aria-expanded={letterOpen}
              >
                <span className="cp-letter-toggle-text">
                  <span className="cp-letter-eyebrow">A message from the committee</span>
                  <span className="cp-letter-teaser">Why we're doing this, and how it's funded.</span>
                </span>
                <span className={`cp-letter-arrow ${letterOpen ? 'open' : ''}`}>▼</span>
              </button>
              <div className={`cp-letter-body ${letterOpen ? 'open' : ''}`}>
                <p><b className="cp-green">Dear {user?.first_name || 'Batchmate'},</b></p>
                <p>This December 16, 2028, Batch 2003 hosts the USLS General Alumni Homecoming as Silver Jubilarians. 25 years later, we get to be the ones who bring everyone home. We want to make it count.</p>
                <p>We aim to cover our Core Events: the Homecoming Dinner, the Teachers' Tribute, a Family Day we're planning, and our batch donation. Each one planned and estimated, not guessed.</p>
                <p>We fund it through a <b>hybrid model</b>. Direct contributions from the batch, plus net proceeds from events we run separately. Every verified peso is tracked and visible on our <Link to="/funds" className="cp-faq-link">Fund page</Link>.</p>
                <p>Contributions are encouraged by June 2028 but accepted through December 2028. June gives us a clear budget picture before we lock vendors and production for the December event. After June still counts. Pick the tier that fits, pledge at your own pace, and let's bring everyone home.</p>
                <p className="cp-sign">— USLS-IS Batch 2003 Organizing Committee</p>
              </div>
            </div>

            <div className="cp-gold-divider"></div>

            {/* Builder Tiers */}
            <h2 className="cp-tier-heading" ref={tierHeadingRef}>Golden Batch Builders</h2>
            <p className="cp-section-subtitle cp-italic">We're all building this homecoming. Choose how you build.</p>
            <p className="cp-section-subtitle cp-italic">Each tier represents a different way of supporting the same goal — no one is 'higher,' just contributing differently.</p>
            <p className="cp-builders-count">{batchProgress.builder_count} Builder{batchProgress.builder_count !== 1 ? 's' : ''} already in.</p>
            <p className="cp-tier-hint">Tap a tier to begin.</p>

            {/* Minimal Tier Cards Grid */}
            <div className="cp-tier-grid-scroll">
              <div className="cp-tier-grid-inner">

                <div
                  className={`cp-tier-card-beyond ${(expandedTier ? expandedTier === 'beyond' : selectedTier === 'beyond') ? 'selected' : ''}`}
                  onClick={() => handleTierCardClick('beyond')}
                >
                  <div className="cp-tier-check">✓</div>
                  <div className="cp-tier-card-beyond-label">Beyond</div>
                  <div className="cp-tier-card-beyond-amount">₱100,000+</div>
                </div>

                <div
                  className={`cp-tier-card cornerstone ${(expandedTier ? expandedTier === 'cornerstone' : selectedTier === 'cornerstone') ? 'selected' : ''}`}
                  onClick={() => handleTierCardClick('cornerstone')}
                >
                  <div className="cp-tier-check">✓</div>
                  <div className="cp-tier-label">Cornerstone</div>
                  <div className="cp-tier-amount">₱50,000+</div>
                </div>

                <div
                  className={`cp-tier-card pillar ${(expandedTier ? expandedTier === 'pillar' : selectedTier === 'pillar') ? 'selected' : ''}`}
                  onClick={() => handleTierCardClick('pillar')}
                >
                  <div className="cp-tier-check">✓</div>
                  <div className="cp-tier-label">Pillar</div>
                  <div className="cp-tier-amount">₱25,000+</div>
                </div>

                <div
                  className={`cp-tier-card anchor ${(expandedTier ? expandedTier === 'anchor' : selectedTier === 'anchor') ? 'selected' : ''}`}
                  onClick={() => handleTierCardClick('anchor')}
                >
                  <div className="cp-tier-check">✓</div>
                  <div className="cp-tier-label">Anchor</div>
                  <div className="cp-tier-amount">₱10,000+</div>
                </div>

                <div
                  className={`cp-tier-card root ${(expandedTier ? expandedTier === 'root' : selectedTier === 'root') ? 'selected' : ''}`}
                  onClick={() => handleTierCardClick('root')}
                >
                  <div className="cp-tier-check">✓</div>
                  <div className="cp-tier-label">Root</div>
                  <div className="cp-tier-amount">Open amount</div>
                </div>

              </div>
            </div>

            {/* Expanded Detail Panel */}
            {expandedTier && !confirmed && (
              <div className="cp-expand-panel">
                <div className="cp-expand-tagline">
                  "{TIER_TAGLINES[expandedTier]}"
                </div>
                <div className="cp-expand-estimate">
                  {getTierMonthlyEstimate(expandedTier)}
                </div>
                <div className="cp-expand-inclusions">
                  Inclusions to be announced soon.
                </div>
                <button className="cp-expand-cta" onClick={handleCountMeIn}>
                  Count Me In
                </button>
              </div>
            )}

            {/* Pledge Panel */}
            <div className={`cp-pledge-panel ${selectedTier && !confirmed ? 'open' : ''}`} ref={pledgePanelRef}>
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
                    <div className="cp-pledge-amount-label">Enter amount</div>
                    <div className="cp-pledge-amount-hint">
                      {selectedTier === 'beyond'
                        ? 'Beyond: ₱100,000 and up'
                        : `${TIERS[selectedTier].label}: ₱${formatNumber(TIERS[selectedTier].min)} to ₱${formatNumber(TIERS[selectedTier].max)}`}
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
                          <br/>{getStartLabel()} — June 2028
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
                    {saving ? 'Saving...' : 'Confirm My Pledge'}
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

            <div className="cp-gold-divider"></div>

            {/* Where Your Contribution Goes - Simplified */}
            <h2 className="cp-section-title" ref={allocationRef}>Where your contribution goes</h2>
            <div className="cp-info-row" style={{ marginBottom: '24px', marginTop: '16px' }}>
              <div className="cp-info-box green-border" style={{ flex: 1 }}>
                <div className="cp-info-box-title green" style={{ marginBottom: '8px' }}>Core Events</div>
                <p style={{ margin: 0 }}>The main homecoming and everything that makes the night happen. Details to be announced soon.</p>
              </div>
              <div className="cp-info-box gold-border" style={{ flex: 1 }}>
                <div className="cp-info-box-title gold" style={{ marginBottom: '8px' }}>Fundraising / Special Events</div>
                <p style={{ margin: 0 }}>Events we run to raise funds, and the giving-back work beyond the batch. Details to be announced soon.</p>
              </div>
            </div>

            <div className="cp-info-row">
              <div className="cp-info-box gold-border" style={{ flex: 1 }}>
                <div className="cp-info-box-title gold">Flexible monthly commitments.</div>
                <p>You can contribute in monthly installments from January 2026 through June 2028 — that's {getMonthsRemaining()} months. We strongly encourage contributions to be completed by June so we can finalize our budget for December.</p>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="cp-faq-section" ref={faqRef}>
              <h2 className="cp-faq-heading">Frequently Asked Questions</h2>

              <nav className="cp-faq-nav">
                <a href="#about-the-plan" className="cp-faq-nav-pill">About the Plan</a>
                <a href="#about-the-tiers" className="cp-faq-nav-pill">About the Tiers</a>
                <a href="#how-its-funded" className="cp-faq-nav-pill">How It's Funded</a>
                <a href="#about-payment" className="cp-faq-nav-pill">About Payment</a>
                <a href="#about-recognition" className="cp-faq-nav-pill">About Recognition</a>
                <a href="#general" className="cp-faq-nav-pill">General</a>
              </nav>

              {/* About the Plan */}
              <div className="cp-faq-group" id="about-the-plan">
                <div className="cp-faq-group-title">About the Plan</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('plan-1')}>
                    <span>What is the ₱2.5M for?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('plan-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('plan-1') ? 'open' : ''}`}>
                    Our Core Events: the Homecoming Dinner, the Teachers' Tribute, a Family Day we're planning, and our batch donation. Each one planned and estimated, not guessed.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('plan-2')}>
                    <span>Why this amount?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('plan-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('plan-2') ? 'open' : ''}`}>
                    We'd rather plan it right once than come back later asking for more. The ₱2.5M covers inflation between now and 2028, a strategic reserve, and the full program, so the number holds up instead of falling short. Anything we raise beyond it goes toward our annual traditions and giving-back work, the outreach beyond the batch. It stays visible on the Fund page and is discussed openly with the batch. Nothing sits idle, and nobody gets a second ask down the line.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('plan-3')}>
                    <span>Is it a fixed amount?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('plan-3') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('plan-3') ? 'open' : ''}`}>
                    No. We're all in different seasons of life, and we want everyone to be part of this regardless of where you're at. Pick the tier that honestly fits you, from Root with no set amount up to Beyond. What matters is that we get there together, every contribution moves us closer, and the more we each give what we can, the lighter it is for everyone.
                  </div>
                </div>
              </div>

              {/* About the Tiers */}
              <div className="cp-faq-group" id="about-the-tiers">
                <div className="cp-faq-group-title">About the Tiers</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-1')}>
                    <span>Do bigger contributors get more say?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-1') ? 'open' : ''}`}>
                    No. The tiers aren't rankings, they're just different ways of contributing to the same goal. A Root is not less than a Beyond, just a different role in the same build. Contribution is ownership, not control. Everyone has the same voice, whatever they give.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('tiers-2')}>
                    <span>Can I change my tier later?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('tiers-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('tiers-2') ? 'open' : ''}`}>
                    Yes, anytime from your profile. Pick what fits you now, and adjust whenever your season changes.
                  </div>
                </div>
              </div>

              {/* How It's Funded */}
              <div className="cp-faq-group" id="how-its-funded">
                <div className="cp-faq-group-title">How It's Funded</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('fund-1')}>
                    <span>How is this funded? Is it all on us?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('fund-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('fund-1') ? 'open' : ''}`}>
                    No. It's a hybrid. Three sources carry it together: direct contributions from the batch (the builder tiers), net proceeds from fundraising events we run separately, and sponsorships from partners and local businesses. The more we raise from the other two, the lighter the load on direct contributions.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('fund-2')}>
                    <span>How do I know the money is safe?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('fund-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('fund-2') ? 'open' : ''}`}>
                    You don't have to take our word for it. Every verified contribution is on the <Link to="/funds" className="cp-faq-link">Fund page</Link>, checked against the account. You can see the running total anytime.
                  </div>
                </div>
              </div>

              {/* About Payment */}
              <div className="cp-faq-group" id="about-payment">
                <div className="cp-faq-group-title">About Payment</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('pay-1')}>
                    <span>Does it have to be paid all at once?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('pay-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('pay-1') ? 'open' : ''}`}>
                    No. Contributions are encouraged by June 2028 but accepted through December 2028. June gives us a clear budget picture before we lock vendors for the December event. Pay at whatever pace works, the plan shows you monthly, weekly, even daily.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('pay-2')}>
                    <span>How does my payment get recorded?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('pay-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('pay-2') ? 'open' : ''}`}>
                    Upload your receipt on your profile after you pay. The committee verifies it within 48 hours, then it shows in your progress and on the Fund page. Put your full name in the transfer reference so it gets matched to you quickly.
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
                    Only if you want it to be. When you confirm your tier, there's a toggle before you submit. Switch it on and your name goes into our Builder recognition. Switch it off and your contribution still counts, your name just stays private. You can change this anytime from your profile.
                  </div>
                </div>
              </div>

              {/* General */}
              <div className="cp-faq-group" id="general">
                <div className="cp-faq-group-title">General</div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('gen-1')}>
                    <span>Where can I see how much has been raised?</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('gen-1') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('gen-1') ? 'open' : ''}`}>
                    The <Link to="/funds" className="cp-faq-link">Fund page</Link> shows the full picture — every verified contribution and the running total. Once a payment is verified by the committee, it shows up there. Nothing is hidden. You'll always know where the batch stands.
                  </div>
                </div>

                <div className="cp-faq-item">
                  <button className="cp-faq-question" onClick={() => toggleFaq('gen-2')}>
                    <span>I still have questions.</span>
                    <span className={`cp-faq-arrow ${openFaqs.includes('gen-2') ? 'open' : ''}`}>▼</span>
                  </button>
                  <div className={`cp-faq-answer ${openFaqs.includes('gen-2') ? 'open' : ''}`}>
                    Head to your <Link to="/inbox" className="cp-faq-link">Inbox</Link> and use Contact Committee — we'll get back to you. You can also check the <Link to="/committee" className="cp-faq-link">Committee page</Link> to see who's who.
                  </div>
                </div>
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
