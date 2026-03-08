import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import letterImage from '../images/batch-rep-letter.jpg';
import '../styles/batchrep.css';

// Map hash to section key
const HASH_TO_SECTION = {
  'official-letter': 'letter',
  'about-nomination': 'nomination',
  'responsibilities': 'role',
  'response': 'response'
};

// Access control phases:
// Phase 1: Only felie@fnrcore.com
// Phase 2: All admins
// Phase 3: All registered graduates
const BATCH_REP_PHASE = 1;

// Check if user has access based on current phase
const checkPhaseAccess = (user, isGrad) => {
  if (!user) return false;

  const userEmail = user.email?.toLowerCase();

  switch (BATCH_REP_PHASE) {
    case 1:
      // Phase 1: Only specific emails
      const allowedEmails = [
        'felie@fnrcore.com',
        'coycoy.cordova@gmail.com',
        'emvjanklow@gmail.com',
        'williamkramer27@gmail.com',
        'jmrnv07@gmail.com',
        'chayamalonso@gmail.com',
        'nqa.attynea@gmail.com',
        'eckkee03@gmail.com'
      ];
      return allowedEmails.includes(userEmail);
    case 2:
      // Phase 2: All admins
      return user.isAdmin === true;
    case 3:
      // Phase 3: All registered graduates
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
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isGrad, setIsGrad] = useState(false);

  // All sections collapsed by default
  const [openSections, setOpenSections] = useState({});
  const [selection, setSelection] = useState('confirm');
  const [comments, setComments] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeSearch, setNomineeSearch] = useState('');
  const [nominees, setNominees] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const dropdownRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await apiGet('/api/batch-rep/status');
        const data = await res.json();
        if (res.ok) {
          setStatus(data.status);
          setHasSubmitted(data.hasSubmitted);
          setIsGrad(data.isGrad);
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

  // Handle hash-based section expansion on mount
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && HASH_TO_SECTION[hash]) {
      const sectionKey = HASH_TO_SECTION[hash];
      setOpenSections(prev => ({ ...prev, [sectionKey]: true }));

      // Scroll to section after render
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash]);

  // Search graduates for typeahead
  const searchGraduates = useCallback(async (query) => {
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

  // Debounced search
  const handleNomineeSearchChange = (e) => {
    const value = e.target.value;
    setNomineeSearch(value);
    setNomineeName('');

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchGraduates(value);
    }, 200);
  };

  const selectNominee = (nominee) => {
    setNomineeName(nominee.name);
    setNomineeSearch(nominee.name);
    setShowDropdown(false);
    setSelection('nominate');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleNavClick = (e, hash) => {
    e.preventDefault();
    const sectionKey = HASH_TO_SECTION[hash];

    // Update URL hash
    window.history.pushState(null, '', `#${hash}`);

    // Open section if it's a collapsible
    if (sectionKey && sectionKey !== 'response') {
      setOpenSections(prev => ({ ...prev, [sectionKey]: true }));
    }

    // Scroll to section
    setTimeout(() => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleSubmit = async () => {
    setSubmitError('');

    if (!selection) {
      setSubmitError('Please confirm your selection before submitting.');
      return;
    }

    if (selection === 'nominate' && !nomineeName.trim()) {
      setSubmitError('Please select a nominee from the list.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiPost('/api/batch-rep/submit', {
        selection,
        nominee_name: selection === 'nominate' ? nomineeName : null,
        comments: comments.trim() || null
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitSuccess(true);
      setHasSubmitted(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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

  // Check access based on current phase
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
          <h1 className="page-title-gold">Batch 2003 Representative</h1>
          <p className="subtitle">
            The USLS Alumni Association has formally requested we submit a Batch 2003 Representative — who will also serve as Alumni Association President during our 25th Jubilee in 2028.
          </p>

          {/* Section Navigation */}
          <nav className="batchrep-section-nav">
            <a href="#official-letter" onClick={(e) => handleNavClick(e, 'official-letter')}>
              Official Letter
            </a>
            <a href="#about-nomination" onClick={(e) => handleNavClick(e, 'about-nomination')}>
              About Nomination
            </a>
            <a href="#responsibilities" onClick={(e) => handleNavClick(e, 'responsibilities')}>
              Role
            </a>
          </nav>

          {/* CTA Button - separate from nav pills */}
          <a href="#response" onClick={(e) => handleNavClick(e, 'response')} className="batchrep-cta-btn">
            Submit Response →
          </a>

          {/* Deadline */}
          <div className="batchrep-deadline">
            Feedback window closes <strong>March 14, 2026 at 8:00 AM PHT</strong>
            {getDaysUntilDeadline() > 0 && (
              <span className="deadline-countdown"> · {getDaysUntilDeadline()} day{getDaysUntilDeadline() !== 1 ? 's' : ''} left</span>
            )}. If no concerns or other nominations are raised by this date, Bianca Jison will be confirmed as our official Batch Representative.
          </div>

          {/* Official Letter - Collapsible */}
          <div className={`batchrep-collapsible ${openSections.letter ? 'open' : ''}`} id="official-letter">
            <button className="batchrep-collapsible-trigger" onClick={() => toggleSection('letter')}>
              <span>Official Letter - USLS Alumni Association Bacolod, Inc.</span>
              <span className="batchrep-collapsible-arrow">▼</span>
            </button>
            <div className="batchrep-collapsible-body">
              <div className="batchrep-letter-wrap">
                <img src={letterImage} alt="Official letter from USLS Alumni Association Bacolod, Inc." />
              </div>
            </div>
          </div>

          {/* Nominee Card - Always visible */}
          <div className="batchrep-nominee-card">
            <div className="batchrep-nominee-header">
              <span>Proposed Batch Representative</span>
            </div>
            <div className="batchrep-nominee-body">
              <div className="batchrep-nominee-name">Bianca Jison</div>
              <div className="batchrep-nominee-sub">GS 1999 · HS 2003</div>
              <div className="batchrep-nominee-roles">
                <div className="batchrep-nominee-role">
                  <span className="batchrep-role-badge">NOW</span>
                  <span>Batch 2003 Representative to the USLS Alumni Association Officers and Board of Directors for SY 2026-2027</span>
                </div>
                <div className="batchrep-nominee-role">
                  <span className="batchrep-role-badge">2028</span>
                  <span>President of the USLS Alumni Association Bacolod, Inc. during our 25th Jubilee Homecoming</span>
                </div>
              </div>
            </div>
          </div>

          {/* About Nomination - Collapsible */}
          <div className={`batchrep-collapsible ${openSections.nomination ? 'open' : ''}`} id="about-nomination">
            <button className="batchrep-collapsible-trigger" onClick={() => toggleSection('nomination')}>
              <span>About This Nomination</span>
              <span className="batchrep-collapsible-arrow">▼</span>
            </button>
            <div className="batchrep-collapsible-body">
              <p>
                The Organizing Committee proposes <strong>Bianca Jison</strong> as our Batch Representative in recognition of the initiative she has shown in proactively taking on many of the responsibilities associated with the role.
              </p>
              <p>
                She has been coordinating with the organizing committee and the alumni office, helping organize our batch and move preparations forward for our 25th Jubilee.
              </p>
              <p>
                While the Organizing Committee believes Bianca can effectively fulfill this role, we recognize and value every batchmate's voice in this decision. If you have someone else in mind who you feel is equally capable and willing to take this on, we encourage you to put their name forward. This is ultimately the batch's decision.
              </p>
              <div className="batchrep-notice">
                <strong>Please note:</strong> At the request of the USLS Alumni Association, the Batch Representative is preferred to be locally based in Bacolod, as this person will be required to attend board meetings in person and will eventually serve as Alumni Association President during our 25th Jubilee in 2028.
              </div>
            </div>
          </div>

          {/* Role & Responsibilities - Collapsible */}
          <div className={`batchrep-collapsible ${openSections.role ? 'open' : ''}`} id="responsibilities">
            <button className="batchrep-collapsible-trigger" onClick={() => toggleSection('role')}>
              <span>Role & Responsibilities</span>
              <span className="batchrep-collapsible-arrow">▼</span>
            </button>
            <div className="batchrep-collapsible-body">
              <ul>
                <li>Represent Batch 2003 in the USLS Alumni Association Officers and Board of Directors for SY 2026-2027</li>
                <li>Attend regular alumni board meetings in person at the Alumni Office, USLS, Bacolod City</li>
                <li>Act on behalf of the batch in all Alumni Association matters for the stated term</li>
                <li>Coordinate with the USLS Alumni Association on batch-related concerns and updates</li>
                <li>Serve as the official liaison between Batch 2003 and the alumni office</li>
                <li>Assume the position of President of the USLS Alumni Association Bacolod, Inc. during our 25th Jubilee in 2028</li>
                <li>Preside over the General Alumni Homecoming as the hosting batch president in December 2028</li>
                <li>Work closely with the organizing committee on all preparations leading up to the 25th Jubilee Homecoming</li>
                <li>Represent the batch in school and community engagements as needed</li>
                <li>Help drive participation, fundraising, and engagement among batchmates in the lead-up to 2028</li>
              </ul>
              <div className="batchrep-reassurance">
                The Batch Representative will not be starting from scratch. There is already an organizing committee in place that has been working since 2023 — fully committed and ready to support whoever takes on this role.
              </div>
            </div>
          </div>

          {/* Response Form - Always visible */}
          <div className="batchrep-response-card" id="response">
            <div className="batchrep-response-header">
              <h3>Your Response</h3>
              <p>Registered graduates only · Responses are confidential</p>
            </div>
            <div className="batchrep-response-body">
              {submitSuccess || hasSubmitted ? (
                <div className="batchrep-success">
                  <div className="batchrep-success-icon">✓</div>
                  <p>Thank you for your response.</p>
                  <button className="btn-secondary" onClick={() => navigate('/profile')}>
                    Back to Profile
                  </button>
                </div>
              ) : status !== 'active' ? (
                <div className="batchrep-message">
                  <p>Submissions are now closed.</p>
                  <button className="btn-secondary" onClick={() => navigate('/profile')}>
                    Back to Profile
                  </button>
                </div>
              ) : !isGrad ? (
                <div className="batchrep-message">
                  <p>Only registered graduates can submit responses.</p>
                  <button className="btn-secondary" onClick={() => navigate('/profile')}>
                    Back to Profile
                  </button>
                </div>
              ) : (
                <>
                  <p>
                    The organizing committee proposes Bianca Jison as our Batch Representative. Please confirm below. If you have feedback or would like to nominate someone else, you may use the optional fields.
                  </p>

                  <label
                    className={`batchrep-confirm-option ${selection === 'confirm' ? 'selected' : ''}`}
                    onClick={() => setSelection('confirm')}
                  >
                    <input
                      type="radio"
                      name="selection"
                      value="confirm"
                      checked={selection === 'confirm'}
                      onChange={() => setSelection('confirm')}
                    />
                    <span className="batchrep-confirm-text">I confirm Bianca Jison as our Batch Representative</span>
                  </label>

                  <div className="form-group">
                    <label>Feedback or comments <span style={{ fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                    <textarea
                      placeholder="Share any feedback here..."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={3}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Nominate someone else <span style={{ fontWeight: 400, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                    <div className="batchrep-local-reminder">
                      Your nominee must be locally based in Bacolod to be eligible.
                    </div>
                    <div className="batchrep-typeahead" ref={dropdownRef}>
                      <input
                        type="text"
                        placeholder="Type a name to search graduates..."
                        value={nomineeSearch}
                        onChange={handleNomineeSearchChange}
                        onFocus={() => nomineeSearch.length >= 2 && nominees.length > 0 && setShowDropdown(true)}
                      />
                      {showDropdown && (
                        <div className="batchrep-typeahead-dropdown">
                          {nominees.length === 0 ? (
                            <div className="batchrep-typeahead-empty">No matching graduates found</div>
                          ) : (
                            nominees.map((nominee) => (
                              <div
                                key={nominee.id}
                                className="batchrep-typeahead-item"
                                onClick={() => selectNominee(nominee)}
                              >
                                {nominee.name}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {submitError && (
                    <div className="error">{submitError}</div>
                  )}

                  <button
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit Response'}
                  </button>

                  <div className="batchrep-confidential">
                    <span>🔒</span>
                    <span>Responses are confidential. Results will be shared with the batch once the window closes.</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="batchrep-page-footer">
            USLS-IS · 25th Alumni Homecoming · December 16, 2028
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
