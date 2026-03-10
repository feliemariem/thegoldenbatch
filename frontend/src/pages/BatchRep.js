import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import letterImage from '../images/batch-rep-letter.jpg';
import '../styles/batchrep.css';

// Access control phases:
// Phase 1: Only specific emails
// Phase 2: All admins
// Phase 3: All registered graduates
const BATCH_REP_PHASE = 1;

// Check if user has access based on current phase
const checkPhaseAccess = (user, isGrad) => {
  if (!user) return false;

  const userEmail = user.email?.toLowerCase();

  switch (BATCH_REP_PHASE) {
    case 1:
      const allowedEmails = [
        'felie@fnrcore.com'
      ];
      return allowedEmails.includes(userEmail);
    case 2:
      return user.isAdmin === true;
    case 3:
      return isGrad === true;
    default:
      return false;
  }
};

// Batch-rep deadline: March 14, 2026 at 8:00 AM PHT (UTC+8)
const BATCH_REP_DEADLINE = new Date('2026-03-14T08:00:00+08:00');

const getDaysUntilDeadline = () => {
  const now = new Date();
  const diffTime = BATCH_REP_DEADLINE - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function BatchRep() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [hasSubmittedPos1, setHasSubmittedPos1] = useState(false);
  const [hasSubmittedPos2, setHasSubmittedPos2] = useState(false);
  const [isGrad, setIsGrad] = useState(false);

  // Willingness gate state (two positions)
  const [showWillingnessModal, setShowWillingnessModal] = useState(false);
  const [willingnessPos1, setWillingnessPos1] = useState(null); // null | true | false
  const [willingnessPos2, setWillingnessPos2] = useState(null);
  const [willingnessSubmitting, setWillingnessSubmitting] = useState(false);
  const [roleOpen1, setRoleOpen1] = useState(false);
  const [roleOpen2, setRoleOpen2] = useState(false);

  // Section states
  const [letterOpen, setLetterOpen] = useState(false);

  // Position 1 form state
  const [selection1, setSelection1] = useState('confirm');
  const [nomineeName1, setNomineeName1] = useState('');
  const [nomineeRationale1, setNomineeRationale1] = useState('');
  const [nomineeMasterListId1, setNomineeMasterListId1] = useState(null);
  const [nomineeSearch1, setNomineeSearch1] = useState('');
  const [nominees1, setNominees1] = useState([]);
  const [showDropdown1, setShowDropdown1] = useState(false);
  const [submitting1, setSubmitting1] = useState(false);
  const [submitError1, setSubmitError1] = useState('');
  const [submitSuccess1, setSubmitSuccess1] = useState(false);

  // Position 2 form state
  const [selection2, setSelection2] = useState('confirm');
  const [nomineeName2, setNomineeName2] = useState('');
  const [nomineeRationale2, setNomineeRationale2] = useState('');
  const [nomineeMasterListId2, setNomineeMasterListId2] = useState(null);
  const [nomineeSearch2, setNomineeSearch2] = useState('');
  const [nominees2, setNominees2] = useState([]);
  const [showDropdown2, setShowDropdown2] = useState(false);
  const [submitting2, setSubmitting2] = useState(false);
  const [submitError2, setSubmitError2] = useState('');
  const [submitSuccess2, setSubmitSuccess2] = useState(false);

  const dropdownRef1 = useRef(null);
  const dropdownRef2 = useRef(null);
  const searchTimeoutRef1 = useRef(null);
  const searchTimeoutRef2 = useRef(null);

  // Fetch status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await apiGet('/api/batch-rep/status');
        const data = await res.json();
        if (res.ok) {
          setStatus(data.status);
          setHasSubmittedPos1(data.hasSubmittedPos1 || false);
          setHasSubmittedPos2(data.hasSubmittedPos2 || false);
          setIsGrad(data.isGrad);
          setWillingnessPos1(data.willingnessPos1 ?? null);
          setWillingnessPos2(data.willingnessPos2 ?? null);
        }
      } catch (err) {
        console.error('Error fetching batch-rep status:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Handle hash navigation on mount
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // If navigating to official-letter, open it
        if (hash === 'official-letter') {
          setLetterOpen(true);
        }
      }, 100);
    }
  }, [location.hash]);

  // Search graduates for typeahead
  const searchGraduates = useCallback(async (query, setNominees, setShowDropdown) => {
    if (query.length < 2) {
      setNominees([]);
      setShowDropdown(false);
      return;
    }

    try {
      const res = await apiGet(`/api/batch-rep/graduates/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) {
        setNominees(data);
        setShowDropdown(data.length > 0);
      }
    } catch (err) {
      console.error('Error searching graduates:', err);
    }
  }, []);

  // Debounced search for Position 1
  const handleNomineeSearchChange1 = (e) => {
    const value = e.target.value;
    setNomineeSearch1(value);
    setNomineeName1('');

    if (searchTimeoutRef1.current) clearTimeout(searchTimeoutRef1.current);
    searchTimeoutRef1.current = setTimeout(() => {
      searchGraduates(value, setNominees1, setShowDropdown1);
    }, 200);
  };

  // Debounced search for Position 2
  const handleNomineeSearchChange2 = (e) => {
    const value = e.target.value;
    setNomineeSearch2(value);
    setNomineeName2('');

    if (searchTimeoutRef2.current) clearTimeout(searchTimeoutRef2.current);
    searchTimeoutRef2.current = setTimeout(() => {
      searchGraduates(value, setNominees2, setShowDropdown2);
    }, 200);
  };

  const selectNominee1 = (nominee) => {
    setNomineeName1(nominee.display_name || nominee.name);
    setNomineeSearch1(nominee.display_name || nominee.name);
    setNomineeMasterListId1(nominee.master_list_id || nominee.id);
    setShowDropdown1(false);
    setSelection1('nominate');
  };

  const selectNominee2 = (nominee) => {
    setNomineeName2(nominee.display_name || nominee.name);
    setNomineeSearch2(nominee.display_name || nominee.name);
    setNomineeMasterListId2(nominee.master_list_id || nominee.id);
    setShowDropdown2(false);
    setSelection2('nominate');
  };

  const clearNominee1 = () => {
    setNomineeName1('');
    setNomineeSearch1('');
    setNomineeMasterListId1(null);
  };

  const clearNominee2 = () => {
    setNomineeName2('');
    setNomineeSearch2('');
    setNomineeMasterListId2(null);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef1.current && !dropdownRef1.current.contains(e.target)) {
        setShowDropdown1(false);
      }
      if (dropdownRef2.current && !dropdownRef2.current.contains(e.target)) {
        setShowDropdown2(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleNavClick = (e, hash) => {
    e.preventDefault();
    window.history.pushState(null, '', `#${hash}`);

    // Open letter if clicking on official-letter link
    if (hash === 'official-letter') {
      setLetterOpen(true);
    }

    setTimeout(() => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleSeeOfficialLetter = (e) => {
    e.preventDefault();
    setLetterOpen(true);
    setTimeout(() => {
      const element = document.getElementById('official-letter');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleWillingnessSave = async () => {
    if (willingnessPos1 === null || willingnessPos2 === null) return;

    setWillingnessSubmitting(true);
    try {
      const res = await apiPost('/api/batch-rep/willingness', {
        position1: willingnessPos1,
        position2: willingnessPos2
      });
      if (res.ok) {
        setShowWillingnessModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWillingnessSubmitting(false);
    }
  };

  const handleSubmitPos1 = async () => {
    setSubmitError1('');

    if (!selection1) {
      setSubmitError1('Please confirm your selection before submitting.');
      return;
    }

    if (selection1 === 'nominate' && !nomineeName1.trim()) {
      setSubmitError1('Please select a nominee from the list.');
      return;
    }

    setSubmitting1(true);

    try {
      const res = await apiPost('/api/batch-rep/submit', {
        position: 1,
        selection: selection1,
        nominee_name: selection1 === 'nominate' ? nomineeName1 : null,
        nominee_master_list_id: selection1 === 'nominate' ? nomineeMasterListId1 : null,
        comments: selection1 === 'nominate' ? (nomineeRationale1.trim() || null) : null
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitSuccess1(true);
      setHasSubmittedPos1(true);

      // Auto-scroll to Position 2 after successful submission
      setTimeout(() => {
        const pos2Element = document.getElementById('position-2');
        if (pos2Element) {
          pos2Element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    } catch (err) {
      setSubmitError1(err.message);
    } finally {
      setSubmitting1(false);
    }
  };

  const handleSubmitPos2 = async () => {
    setSubmitError2('');

    if (!selection2) {
      setSubmitError2('Please confirm your selection before submitting.');
      return;
    }

    if (selection2 === 'nominate' && !nomineeName2.trim()) {
      setSubmitError2('Please select a nominee from the list.');
      return;
    }

    setSubmitting2(true);

    try {
      const res = await apiPost('/api/batch-rep/submit', {
        position: 2,
        selection: selection2,
        nominee_name: selection2 === 'nominate' ? nomineeName2 : null,
        nominee_master_list_id: selection2 === 'nominate' ? nomineeMasterListId2 : null,
        comments: selection2 === 'nominate' ? (nomineeRationale2.trim() || null) : null
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitSuccess2(true);
      setHasSubmittedPos2(true);
    } catch (err) {
      setSubmitError2(err.message);
    } finally {
      setSubmitting2(false);
    }
  };

  // Check if willingness gate has been answered
  const hasAnsweredWillingness = willingnessPos1 !== null && willingnessPos2 !== null;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container batchrep-page">
          <div className="card">
            <p>Loading...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="container batchrep-page">
          <div className="card">
            <h1 className="page-title-gold">Sign In Required</h1>
            <p className="subtitle">Please log in to view and respond to this batch announcement.</p>
            <button className="btn-primary" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  const hasAccess = checkPhaseAccess(user, isGrad);

  if (!hasAccess) {
    return (
      <>
        <Navbar />
        <div className="container batchrep-page">
          <div className="card">
            <h1 className="page-title-gold">Access Restricted</h1>
            <p className="subtitle">This announcement is not yet available for your account.</p>
            <button className="btn-secondary" onClick={() => navigate('/profile')}>
              Back to Profile
            </button>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container batchrep-page">
        <div className="card">
          <h1 className="page-title-gold">Batch 2003 · Official Positions</h1>

          {/* Show willingness status banner if already answered */}
          {isGrad && hasAnsweredWillingness && (
            <div className="batchrep-notice" style={{ marginBottom: '16px', background: 'var(--color-status-positive-bg)', borderColor: 'var(--color-status-positive)' }}>
              <span style={{ color: 'var(--color-status-positive)' }}>✓</span>{' '}
              Your willingness responses have been recorded.{' '}
              <button
                onClick={() => setShowWillingnessModal(true)}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-hover)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}
              >
                Change my answers
              </button>
            </div>
          )}

          {/* Rest of page - hidden until willingness answered (for grads) */}
          {(!isGrad || hasAnsweredWillingness) && (
            <>
              {/* Nav Pills */}
              <nav className="batchrep-section-nav">
                <a href="#overview" onClick={(e) => handleNavClick(e, 'overview')}>
                  Overview
                </a>
                <a href="#position-1" onClick={(e) => handleNavClick(e, 'position-1')}>
                  Alumni Assoc. Rep
                </a>
                <a href="#position-2" onClick={(e) => handleNavClick(e, 'position-2')}>
                  Batch Rep
                </a>
              </nav>

              {/* Submit Response Button */}
              <button
                className="batchrep-cta-btn"
                onClick={() => isGrad && !hasAnsweredWillingness ? setShowWillingnessModal(true) : document.getElementById('position-1')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ width: '100%', textAlign: 'center', marginBottom: '24px' }}
              >
                Submit Response →
              </button>

              {/* Overview / Context Card */}
              <div className="batchrep-response-card" id="overview">
                <div className="batchrep-response-header">
                  <h3>Overview</h3>
                </div>
                <div className="batchrep-response-body">
                  <p>
                    The USLS Alumni Association has asked our batch to put forward an official representative — someone who will sit on the alumni board and eventually serve as <strong>Alumni Association President</strong> during our 25th Jubilee in 2028.
                  </p>
                  <p>
                    After clarifying with the alumni office, we learned the role can be split into two: an <strong>Alumni Association Representative</strong> (school-facing) and a <strong>Batch Representative</strong> (batch-facing). The organizing committee is nominating its two co-chairs for each position.
                  </p>
                  <p>
                    While the Organizing Committee believes our nominees are well-suited for their respective roles, we recognize and value every batchmate's voice. If you have someone else in mind who you feel is equally capable and willing to take this on, we encourage you to put their name forward. This is ultimately the batch's decision.
                  </p>

                  <div className="batchrep-overview-divider">
                    <ol className="batchrep-overview-steps">
                      <li>Review the nominations below and let us know where you stand.</li>
                      <li>Confirm or nominate someone else for each position.</li>
                      <li>If another nominee comes in for either position — and that person has confirmed their willingness to serve — that post goes to a batch vote.</li>
                    </ol>
                  </div>

                  <div className="batchrep-overview-divider batchrep-overview-footer">
                    <a
                      href="#official-letter"
                      onClick={handleSeeOfficialLetter}
                      className="batchrep-overview-letter-link"
                    >
                      📄 See Official Letter →
                    </a>
                  </div>

                  <div className="batchrep-deadline-notice">
                    Deadline: <strong>March 14, 2026 · closes 11:59 PM PHT</strong>. If no other nominations are raised by this date and the majority confirms, both nominees will be confirmed for their respective positions.
                  </div>
                </div>
              </div>

              {/* Official Letter Collapsible */}
              <div className={`batchrep-collapsible ${letterOpen ? 'open' : ''}`} id="official-letter">
                <button className="batchrep-collapsible-trigger" onClick={() => setLetterOpen(!letterOpen)}>
                  <span>Official Letter - USLS Alumni Association Bacolod, Inc.</span>
                  <span className="batchrep-collapsible-arrow">▼</span>
                </button>
                <div className="batchrep-collapsible-body">
                  <div className="batchrep-letter-wrap">
                    <img src={letterImage} alt="Official letter from USLS Alumni Association Bacolod, Inc." />
                  </div>
                </div>
              </div>

              {/* Position 1: Alumni Association Representative */}
              <div className="batchrep-nominee-card" id="position-1">
                <div className="batchrep-nominee-header">
                  <span>Position 1 · Alumni Association Representative</span>
                </div>
                <div className="batchrep-nominee-body">
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-primary)', opacity: 0.8, marginBottom: '4px' }}>COMMITTEE NOMINEE</div>
                  <div className="batchrep-nominee-name">Bianca Jison</div>
                  <div className="batchrep-nominee-blurb">
                    Initiated the formation of the organizing committee in 2023 and co-led its strategic planning and operations ever since. Has been the batch's local anchor, attends local events, builds connections on the ground, and has been the direct line to the USLS Alumni Association, including attending meetings on behalf of the batch.
                  </div>
                  <div className="batchrep-nominee-roles">
                    <div className="batchrep-nominee-role">
                      <span className="batchrep-role-badge">SY 2026–2027</span>
                      <span>Batch 2003 Rep to Alumni Board</span>
                    </div>
                    <div className="batchrep-nominee-role">
                      <span className="batchrep-role-badge">2027</span>
                      <span>Alumni Association VP</span>
                    </div>
                    <div className="batchrep-nominee-role">
                      <span className="batchrep-role-badge">2028</span>
                      <span>Alumni Association President</span>
                    </div>
                  </div>

                  {/* Roles & Responsibilities Collapsible */}
                  <div className={`batchrep-collapsible ${roleOpen1 ? 'open' : ''}`} style={{ marginTop: '16px', marginBottom: '8px' }}>
                    <button className="batchrep-collapsible-trigger" onClick={() => setRoleOpen1(!roleOpen1)} style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.85rem' }}>Role & Responsibilities</span>
                      <span className="batchrep-collapsible-arrow">▼</span>
                    </button>
                    <div className="batchrep-collapsible-body" style={{ fontSize: '0.85rem' }}>
                      <ul>
                        <li>Represents Batch 2003 on the USLS Alumni Association Board of Directors for SY 2026-2027</li>
                        <li>Attends board meetings and alumni events in person at the Alumni Office, USLS, Bacolod City</li>
                        <li>Acts as the official liaison between the batch and the alumni office</li>
                        <li>Coordinates with the USLS Alumni Association on batch-related concerns and updates</li>
                        <li>Acts on behalf of the batch in all Alumni Association matters for the stated term</li>
                        <li>Follows the succession ladder: Representative → Vice President → Alumni Association President (2028)</li>
                        <li>Presides over the General Alumni Homecoming as Alumni Association President in December 2028</li>
                        <li>Represents the batch in school and community engagements as needed</li>
                        <li>Local presence required (preferably Bacolod or nearby cities)</li>
                      </ul>
                      <p style={{ fontStyle: 'italic', marginTop: '12px', marginBottom: 0, color: 'var(--color-text-secondary)' }}>
                        The Alumni Association Representative will not be starting from scratch. There is already an organizing committee in place that has been working since 2023 — fully committed and ready to support whoever takes on this role.
                      </p>
                    </div>
                  </div>

                  {/* Response Form for Position 1 */}
                  <div className="batchrep-form-section">
                    {submitSuccess1 || hasSubmittedPos1 ? (
                      <div className="batchrep-success" style={{ padding: '16px 0' }}>
                        <div className="batchrep-success-icon" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>✓</div>
                        <p style={{ marginBottom: '12px' }}>Response recorded for Position 1.</p>
                        {status === 'active' && (
                          <button
                            className="btn-secondary"
                            onClick={() => { setSubmitSuccess1(false); setHasSubmittedPos1(false); }}
                            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                          >
                            Edit my response
                          </button>
                        )}
                      </div>
                    ) : status !== 'active' ? (
                      <div className="batchrep-message">
                        <p>Submissions are now closed.</p>
                      </div>
                    ) : !isGrad ? (
                      <div className="batchrep-message">
                        <p>Only registered graduates can submit responses.</p>
                      </div>
                    ) : (
                      <>
                        <label
                          className={`batchrep-confirm-option ${selection1 === 'confirm' ? 'selected' : ''}`}
                          onClick={() => setSelection1('confirm')}
                        >
                          <input
                            type="radio"
                            name="selection1"
                            value="confirm"
                            checked={selection1 === 'confirm'}
                            onChange={() => setSelection1('confirm')}
                          />
                          <span className="batchrep-confirm-text">I confirm Bianca Jison as Alumni Association Representative</span>
                        </label>

                        <label
                          className={`batchrep-confirm-option ${selection1 === 'nominate' ? 'selected' : ''}`}
                          onClick={() => setSelection1('nominate')}
                        >
                          <input
                            type="radio"
                            name="selection1"
                            value="nominate"
                            checked={selection1 === 'nominate'}
                            onChange={() => setSelection1('nominate')}
                          />
                          <span className="batchrep-confirm-text">I want to nominate someone else</span>
                        </label>

                        {selection1 === 'nominate' && (
                          <div className="batchrep-nominate-section" style={{ marginTop: '16px' }}>
                            <div className="form-group">
                              {nomineeName1 ? (
                                <div className="batchrep-selected-nominee">
                                  <div className="batchrep-selected-nominee-info">
                                    <span className="batchrep-selected-nominee-check">✓</span>
                                    <span className="batchrep-selected-nominee-name">{nomineeName1}</span>
                                  </div>
                                  <button type="button" onClick={clearNominee1} className="batchrep-selected-nominee-clear">Clear</button>
                                </div>
                              ) : (
                                <div className="batchrep-typeahead" ref={dropdownRef1}>
                                  <input
                                    type="text"
                                    placeholder="Search batchmate by name... (local to Bacolod or nearby cities)"
                                    value={nomineeSearch1}
                                    onChange={handleNomineeSearchChange1}
                                    onFocus={() => nomineeSearch1.length >= 2 && nominees1.length > 0 && setShowDropdown1(true)}
                                  />
                                  {showDropdown1 && (
                                    <div className="batchrep-typeahead-dropdown">
                                      {nominees1.length === 0 ? (
                                        <div className="batchrep-typeahead-empty">No matching graduates found</div>
                                      ) : (
                                        nominees1.map((nominee) => (
                                          <div key={nominee.id || nominee.master_list_id} className="batchrep-typeahead-item" onClick={() => selectNominee1(nominee)}>
                                            {nominee.display_name || nominee.name}
                                            {nominee.section && <span style={{ color: 'var(--color-text-secondary)', marginLeft: '8px', fontSize: '0.8rem' }}>({nominee.section})</span>}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                              <textarea
                                placeholder="Share why you're nominating them (optional)"
                                value={nomineeRationale1}
                                onChange={(e) => setNomineeRationale1(e.target.value)}
                                rows={2}
                                style={{ width: '100%', resize: 'vertical' }}
                              />
                            </div>
                          </div>
                        )}

                        {submitError1 && <div className="error">{submitError1}</div>}

                        <button className="btn-primary" onClick={handleSubmitPos1} disabled={submitting1}>
                          {submitting1 ? 'Submitting...' : 'Submit Response for Position 1 →'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Position 2: Batch Representative */}
              <div className="batchrep-nominee-card" id="position-2">
                <div className="batchrep-nominee-header">
                  <span>Position 2 · Batch Representative</span>
                </div>
                <div className="batchrep-nominee-body">
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-primary)', opacity: 0.8, marginBottom: '4px' }}>COMMITTEE NOMINEE</div>
                  <div className="batchrep-nominee-name">Felie Magbanua</div>
                  <div className="batchrep-nominee-blurb">
                    Co-led the strategic planning and operations of the organizing committee since 2023. Formalized the committee structure, defined roles and scopes, onboarded additional committee members, and built the platform that keeps everything organized, moving, and transparent.
                  </div>
                  <div className="batchrep-nominee-roles">
                    <div className="batchrep-nominee-role">
                      <span className="batchrep-role-badge">2026–2028</span>
                      <span>Batch 2003 Representative</span>
                    </div>
                  </div>

                  {/* Roles & Responsibilities Collapsible */}
                  <div className={`batchrep-collapsible ${roleOpen2 ? 'open' : ''}`} style={{ marginTop: '16px', marginBottom: '8px' }}>
                    <button className="batchrep-collapsible-trigger" onClick={() => setRoleOpen2(!roleOpen2)} style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.85rem' }}>Role & Responsibilities</span>
                      <span className="batchrep-collapsible-arrow">▼</span>
                    </button>
                    <div className="batchrep-collapsible-body" style={{ fontSize: '0.85rem' }}>
                      <ul>
                        <li>Leads Batch 2003 as its official Batch President</li>
                        <li>Drives batch engagement, participation, and fundraising toward the 25th Jubilee</li>
                        <li>Coordinates the organizing committee and all sub-committees through to the homecoming</li>
                        <li>Primary point of contact for batchmates on homecoming-related matters</li>
                        <li>Works closely with the Alumni Association Representative on matters requiring both roles</li>
                        <li>Helps drive participation, fundraising, and engagement among batchmates in the lead-up to 2028</li>
                        <li>Remote participation accepted — no Bacolod presence required</li>
                      </ul>
                      <p style={{ fontStyle: 'italic', marginTop: '12px', marginBottom: 0, color: 'var(--color-text-secondary)' }}>
                        The Batch Representative will not be starting from scratch. There is already an organizing committee in place that has been working since 2023 — fully committed and ready to support whoever takes on this role.
                      </p>
                    </div>
                  </div>

                  {/* Response Form for Position 2 */}
                  <div className="batchrep-form-section">
                    {submitSuccess2 || hasSubmittedPos2 ? (
                      <div className="batchrep-success" style={{ padding: '16px 0' }}>
                        <div className="batchrep-success-icon" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}>✓</div>
                        <p style={{ marginBottom: '12px' }}>Response recorded for Position 2.</p>
                        {status === 'active' && (
                          <button
                            className="btn-secondary"
                            onClick={() => { setSubmitSuccess2(false); setHasSubmittedPos2(false); }}
                            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                          >
                            Edit my response
                          </button>
                        )}
                      </div>
                    ) : status !== 'active' ? (
                      <div className="batchrep-message">
                        <p>Submissions are now closed.</p>
                      </div>
                    ) : !isGrad ? (
                      <div className="batchrep-message">
                        <p>Only registered graduates can submit responses.</p>
                      </div>
                    ) : (
                      <>
                        <label
                          className={`batchrep-confirm-option ${selection2 === 'confirm' ? 'selected' : ''}`}
                          onClick={() => setSelection2('confirm')}
                        >
                          <input
                            type="radio"
                            name="selection2"
                            value="confirm"
                            checked={selection2 === 'confirm'}
                            onChange={() => setSelection2('confirm')}
                          />
                          <span className="batchrep-confirm-text">I confirm Felie Magbanua as Batch Representative</span>
                        </label>

                        <label
                          className={`batchrep-confirm-option ${selection2 === 'nominate' ? 'selected' : ''}`}
                          onClick={() => setSelection2('nominate')}
                        >
                          <input
                            type="radio"
                            name="selection2"
                            value="nominate"
                            checked={selection2 === 'nominate'}
                            onChange={() => setSelection2('nominate')}
                          />
                          <span className="batchrep-confirm-text">I want to nominate someone else</span>
                        </label>

                        {selection2 === 'nominate' && (
                          <div className="batchrep-nominate-section" style={{ marginTop: '16px' }}>
                            <div className="form-group">
                              {nomineeName2 ? (
                                <div className="batchrep-selected-nominee">
                                  <div className="batchrep-selected-nominee-info">
                                    <span className="batchrep-selected-nominee-check">✓</span>
                                    <span className="batchrep-selected-nominee-name">{nomineeName2}</span>
                                  </div>
                                  <button type="button" onClick={clearNominee2} className="batchrep-selected-nominee-clear">Clear</button>
                                </div>
                              ) : (
                                <div className="batchrep-typeahead" ref={dropdownRef2}>
                                  <input
                                    type="text"
                                    placeholder="Search batchmate by name..."
                                    value={nomineeSearch2}
                                    onChange={handleNomineeSearchChange2}
                                    onFocus={() => nomineeSearch2.length >= 2 && nominees2.length > 0 && setShowDropdown2(true)}
                                  />
                                  {showDropdown2 && (
                                    <div className="batchrep-typeahead-dropdown">
                                      {nominees2.length === 0 ? (
                                        <div className="batchrep-typeahead-empty">No matching graduates found</div>
                                      ) : (
                                        nominees2.map((nominee) => (
                                          <div key={nominee.id || nominee.master_list_id} className="batchrep-typeahead-item" onClick={() => selectNominee2(nominee)}>
                                            {nominee.display_name || nominee.name}
                                            {nominee.section && <span style={{ color: 'var(--color-text-secondary)', marginLeft: '8px', fontSize: '0.8rem' }}>({nominee.section})</span>}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                              <textarea
                                placeholder="Share why you're nominating them (optional)"
                                value={nomineeRationale2}
                                onChange={(e) => setNomineeRationale2(e.target.value)}
                                rows={2}
                                style={{ width: '100%', resize: 'vertical' }}
                              />
                            </div>
                          </div>
                        )}

                        {submitError2 && <div className="error">{submitError2}</div>}

                        <button className="btn-primary" onClick={handleSubmitPos2} disabled={submitting2}>
                          {submitting2 ? 'Submitting...' : 'Submit Response for Position 2 →'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="batchrep-confidential">
                <span>🔒</span>
                <span>Responses are confidential. Results will be shared with the batch once the window closes.</span>
              </div>

              <div className="batchrep-page-footer">
                USLS-IS · 25th Alumni Homecoming · December 16, 2028
              </div>
            </>
          )}

          {/* Willingness Gate - show for grads who haven't answered yet */}
          {isGrad && !hasAnsweredWillingness && (
            <div className="batchrep-response-card" style={{ marginTop: '24px' }}>
              <div className="batchrep-response-header">
                <h3>One quick question before you proceed</h3>
              </div>
              <div className="batchrep-response-body">
                <p style={{ marginBottom: '24px' }}>
                  If nominated for either of the following positions, would you be willing to serve?
                </p>

                {/* Position 1 Block */}
                <div className="batchrep-willingness-block">
                  <div className="batchrep-willingness-position-label">POSITION 1</div>
                  <div className="batchrep-willingness-position-title">Alumni Association Representative</div>

                  <div className={`batchrep-collapsible ${roleOpen1 ? 'open' : ''}`} style={{ marginBottom: '16px' }}>
                    <button className="batchrep-collapsible-trigger" onClick={() => setRoleOpen1(!roleOpen1)} style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.85rem' }}>Role & Responsibilities</span>
                      <span className="batchrep-collapsible-arrow">▼</span>
                    </button>
                    <div className="batchrep-collapsible-body" style={{ fontSize: '0.85rem' }}>
                      <ul>
                        <li>Represents Batch 2003 on the USLS Alumni Association Board of Directors for SY 2026-2027</li>
                        <li>Attends board meetings and alumni events in person at the Alumni Office, USLS, Bacolod City</li>
                        <li>Acts as the official liaison between the batch and the alumni office</li>
                        <li>Coordinates with the USLS Alumni Association on batch-related concerns and updates</li>
                        <li>Acts on behalf of the batch in all Alumni Association matters for the stated term</li>
                        <li>Follows the succession ladder: Representative → Vice President → Alumni Association President (2028)</li>
                        <li>Presides over the General Alumni Homecoming as Alumni Association President in December 2028</li>
                        <li>Represents the batch in school and community engagements as needed</li>
                        <li>Local presence required (preferably Bacolod or nearby cities)</li>
                      </ul>
                    </div>
                  </div>

                  <div className="batchrep-willingness-buttons">
                    <button
                      className={willingnessPos1 === true ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => setWillingnessPos1(true)}
                    >
                      Yes, I'm willing
                    </button>
                    <button
                      className={willingnessPos1 === false ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => setWillingnessPos1(false)}
                    >
                      Not at this time
                    </button>
                  </div>
                </div>

                {/* Position 2 Block */}
                <div className="batchrep-willingness-block">
                  <div className="batchrep-willingness-position-label">POSITION 2</div>
                  <div className="batchrep-willingness-position-title">Batch Representative</div>

                  <div className={`batchrep-collapsible ${roleOpen2 ? 'open' : ''}`} style={{ marginBottom: '16px' }}>
                    <button className="batchrep-collapsible-trigger" onClick={() => setRoleOpen2(!roleOpen2)} style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '0.85rem' }}>Role & Responsibilities</span>
                      <span className="batchrep-collapsible-arrow">▼</span>
                    </button>
                    <div className="batchrep-collapsible-body" style={{ fontSize: '0.85rem' }}>
                      <ul>
                        <li>Leads Batch 2003 as its official Batch President</li>
                        <li>Drives batch engagement, participation, and fundraising toward the 25th Jubilee</li>
                        <li>Coordinates the organizing committee and all sub-committees through to the homecoming</li>
                        <li>Primary point of contact for batchmates on homecoming-related matters</li>
                        <li>Works closely with the Alumni Association Representative on matters requiring both roles</li>
                        <li>Helps drive participation, fundraising, and engagement among batchmates in the lead-up to 2028</li>
                        <li>Remote participation accepted — no Bacolod presence required</li>
                      </ul>
                    </div>
                  </div>

                  <div className="batchrep-willingness-buttons">
                    <button
                      className={willingnessPos2 === true ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => setWillingnessPos2(true)}
                    >
                      Yes, I'm willing
                    </button>
                    <button
                      className={willingnessPos2 === false ? 'btn-primary' : 'btn-secondary'}
                      onClick={() => setWillingnessPos2(false)}
                    >
                      Not at this time
                    </button>
                  </div>
                </div>

                <p className="batchrep-willingness-hint">
                  You can change this anytime.
                </p>

                <button
                  className="btn-primary"
                  onClick={handleWillingnessSave}
                  disabled={willingnessPos1 === null || willingnessPos2 === null || willingnessSubmitting}
                  style={{
                    opacity: (willingnessPos1 === null || willingnessPos2 === null) ? 0.4 : 1,
                    pointerEvents: (willingnessPos1 === null || willingnessPos2 === null) ? 'none' : 'auto'
                  }}
                >
                  {willingnessSubmitting ? 'Saving...' : 'Save & Continue →'}
                </button>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </div>

      {/* Willingness Gate Modal (for editing answers) */}
      {showWillingnessModal && (
        <div className="batchrep-modal-overlay" onClick={() => setShowWillingnessModal(false)}>
          <div className="batchrep-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="batchrep-modal-bar"></div>
            <div className="batchrep-modal-body">
              <div className="batchrep-modal-badge">Batch 2003 · Official Positions</div>
              <h2 className="batchrep-modal-title">One quick question before you proceed</h2>
              <p className="batchrep-modal-desc">
                If nominated for either of the following positions, would you be willing to serve?
              </p>

              {/* Position 1 Block */}
              <div className="batchrep-willingness-block modal">
                <div className="batchrep-willingness-position-label">POSITION 1</div>
                <div className="batchrep-willingness-position-title modal">Alumni Association Representative</div>

                <div className={`batchrep-collapsible ${roleOpen1 ? 'open' : ''}`} style={{ marginBottom: '12px' }}>
                  <button className="batchrep-collapsible-trigger" onClick={() => setRoleOpen1(!roleOpen1)} style={{ padding: '10px 14px', fontSize: '0.85rem' }}>
                    <span>Role & Responsibilities</span>
                    <span className="batchrep-collapsible-arrow">▼</span>
                  </button>
                  <div className="batchrep-collapsible-body" style={{ fontSize: '0.8rem', padding: '0 14px 14px' }}>
                    <ul style={{ margin: 0 }}>
                      <li>Represents Batch 2003 on the USLS Alumni Association Board of Directors for SY 2026-2027</li>
                      <li>Attends board meetings and alumni events in person at the Alumni Office, USLS, Bacolod City</li>
                      <li>Acts as the official liaison between the batch and the alumni office</li>
                      <li>Coordinates with the USLS Alumni Association on batch-related concerns and updates</li>
                      <li>Acts on behalf of the batch in all Alumni Association matters for the stated term</li>
                      <li>Follows the succession ladder: Representative → Vice President → Alumni Association President (2028)</li>
                      <li>Presides over the General Alumni Homecoming as Alumni Association President in December 2028</li>
                      <li>Represents the batch in school and community engagements as needed</li>
                      <li>Local presence required (preferably Bacolod or nearby cities)</li>
                    </ul>
                  </div>
                </div>

                <div className="batchrep-willingness-buttons modal">
                  <button
                    className={willingnessPos1 === true ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setWillingnessPos1(true)}
                  >
                    Yes, I'm willing
                  </button>
                  <button
                    className={willingnessPos1 === false ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setWillingnessPos1(false)}
                  >
                    Not at this time
                  </button>
                </div>
              </div>

              {/* Position 2 Block */}
              <div className="batchrep-willingness-block modal">
                <div className="batchrep-willingness-position-label">POSITION 2</div>
                <div className="batchrep-willingness-position-title modal">Batch Representative</div>

                <div className={`batchrep-collapsible ${roleOpen2 ? 'open' : ''}`} style={{ marginBottom: '12px' }}>
                  <button className="batchrep-collapsible-trigger" onClick={() => setRoleOpen2(!roleOpen2)} style={{ padding: '10px 14px', fontSize: '0.85rem' }}>
                    <span>Role & Responsibilities</span>
                    <span className="batchrep-collapsible-arrow">▼</span>
                  </button>
                  <div className="batchrep-collapsible-body" style={{ fontSize: '0.8rem', padding: '0 14px 14px' }}>
                    <ul style={{ margin: 0 }}>
                      <li>Leads Batch 2003 as its official Batch President</li>
                      <li>Drives batch engagement, participation, and fundraising toward the 25th Jubilee</li>
                      <li>Coordinates the organizing committee and all sub-committees through to the homecoming</li>
                      <li>Primary point of contact for batchmates on homecoming-related matters</li>
                      <li>Works closely with the Alumni Association Representative on matters requiring both roles</li>
                      <li>Helps drive participation, fundraising, and engagement among batchmates in the lead-up to 2028</li>
                      <li>Remote participation accepted — no Bacolod presence required</li>
                    </ul>
                  </div>
                </div>

                <div className="batchrep-willingness-buttons modal">
                  <button
                    className={willingnessPos2 === true ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setWillingnessPos2(true)}
                  >
                    Yes, I'm willing
                  </button>
                  <button
                    className={willingnessPos2 === false ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => setWillingnessPos2(false)}
                  >
                    Not at this time
                  </button>
                </div>
              </div>

              <p className="batchrep-willingness-hint">
                You can change this anytime.
              </p>

              <button
                className="batchrep-modal-btn"
                onClick={handleWillingnessSave}
                disabled={willingnessPos1 === null || willingnessPos2 === null || willingnessSubmitting}
                style={{
                  opacity: (willingnessPos1 === null || willingnessPos2 === null) ? 0.4 : 1,
                  pointerEvents: (willingnessPos1 === null || willingnessPos2 === null) ? 'none' : 'auto'
                }}
              >
                {willingnessSubmitting ? 'Saving...' : 'Save & Continue →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
