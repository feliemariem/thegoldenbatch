import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import '../styles/batchrep.css';

// Letter image - place batch-rep-letter.png in src/images/
let letterImage = null;
try {
  letterImage = require('../images/batch-rep-letter.png');
} catch (e) {
  // Image not yet added
}

export default function BatchRep() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isGrad, setIsGrad] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const [openSections, setOpenSections] = useState({ nomination: true });
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
          setHasAccess(data.hasAccess);
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

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      if (!openSections[sectionId.replace('section-', '')]) {
        setOpenSections(prev => ({ ...prev, [sectionId.replace('section-', '')]: true }));
      }
      setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
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
      <div className="batchrep-page">
        <div className="batchrep-main">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="batchrep-page">
        <div className="batchrep-header">
          <div className="batchrep-header-crest">&#9884;</div>
          <div className="batchrep-header-text">
            <h1>The Golden Batch - USLS IS 2003</h1>
            <p>thegoldenbatch2003.com</p>
          </div>
        </div>
        <div className="batchrep-main">
          <div className="batchrep-access-denied">
            <h2>Sign In Required</h2>
            <p>Please log in to view and respond to this batch announcement.</p>
            <button className="batchrep-btn-primary" onClick={() => navigate('/login')}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="batchrep-page">
        <div className="batchrep-header">
          <div className="batchrep-header-crest">&#9884;</div>
          <div className="batchrep-header-text">
            <h1>The Golden Batch - USLS IS 2003</h1>
            <p>thegoldenbatch2003.com</p>
          </div>
        </div>
        <div className="batchrep-main">
          <div className="batchrep-access-denied">
            <h2>Access Restricted</h2>
            <p>This announcement is not yet available for your account.</p>
            <button className="batchrep-btn-secondary" onClick={() => navigate('/profile')}>
              Back to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="batchrep-page">
      <div className="batchrep-header">
        <div className="batchrep-header-crest">&#9884;</div>
        <div className="batchrep-header-text">
          <h1>The Golden Batch - USLS IS 2003</h1>
          <p>thegoldenbatch2003.com</p>
        </div>
      </div>

      <nav className="batchrep-quick-nav">
        <button onClick={() => scrollToSection('section-letter')}>Official Letter</button>
        <button onClick={() => scrollToSection('section-nomination')}>About Nomination</button>
        <button onClick={() => scrollToSection('section-role')}>Role & Responsibilities</button>
        <button onClick={() => scrollToSection('section-response')} className="primary">Submit Response</button>
      </nav>

      <div className="batchrep-main">
        <div className="batchrep-official-badge">Official Batch Action Required</div>

        <div className="batchrep-title-block">
          <h2>Batch 2003 Batch Representative</h2>
          <p>The USLS Alumni Association Bacolod, Inc. has formally requested that we submit one representative from Batch 2003. Below is the official letter and our proposed nominee.</p>
        </div>

        {/* Deadline */}
        <div className="batchrep-deadline-bar">
          <span>Feedback window closes <strong>March 10, 2026 at 8:00 AM PHT</strong>. If no concerns or other nominations are raised by this date, Bianca Jison will be confirmed as our official Batch Representative.</span>
        </div>

        {/* Official Letter */}
        <div className={`batchrep-collapsible ${openSections.letter ? 'open' : ''}`} id="section-letter">
          <button className="batchrep-collapsible-trigger" onClick={() => toggleSection('letter')}>
            <span className="trigger-left">Official Letter - USLS Alumni Association Bacolod, Inc.</span>
            <span className="batchrep-collapsible-arrow">&#9660;</span>
          </button>
          <div className="batchrep-collapsible-body">
            <div className="batchrep-letter-img-wrap">
              {letterImage ? (
                <img src={letterImage} alt="Official letter from USLS Alumni Association Bacolod, Inc." />
              ) : (
                <div className="batchrep-letter-placeholder">
                  <p>Official letter image will be displayed here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nominee Card */}
        <div className="batchrep-nominee-card">
          <div className="batchrep-nominee-header">
            <span>Proposed Batch Representative</span>
          </div>
          <div className="batchrep-nominee-body">
            <div className="batchrep-nominee-name">Bianca Jison</div>
            <div className="batchrep-nominee-sub">USLS-IS High School Batch 2003</div>
            <div className="batchrep-nominee-roles">
              <div className="batchrep-nominee-role">
                <span className="batchrep-role-icon">Now</span>
                Batch 2003 Representative to the USLS Alumni Association Officers and Board of Directors for SY 2026-2027
              </div>
              <div className="batchrep-nominee-role">
                <span className="batchrep-role-icon">2028</span>
                President of the USLS Alumni Association Bacolod, Inc. during our 25th Jubilee Homecoming
              </div>
            </div>
          </div>
        </div>

        {/* About Nomination */}
        <div className={`batchrep-collapsible ${openSections.nomination ? 'open' : ''}`} id="section-nomination">
          <button className="batchrep-collapsible-trigger" onClick={() => toggleSection('nomination')}>
            <span className="trigger-left">About This Nomination</span>
            <span className="batchrep-collapsible-arrow">&#9660;</span>
          </button>
          <div className="batchrep-collapsible-body">
            <p>The Organizing Committee proposes <strong>Bianca Jison</strong> as our Batch Representative in recognition of the initiative she has shown in proactively taking on many of the responsibilities associated with the role.</p>
            <p style={{ marginTop: '10px' }}>She has been coordinating with the organizing committee and the alumni office, helping organize our batch and move preparations forward for our 25th Jubilee.</p>
            <p style={{ marginTop: '10px' }}>While the Organizing Committee believes Bianca can effectively fulfill this role, we recognize and value every batchmate's voice in this decision. If you have someone else in mind who you feel is equally capable and willing to take this on, we encourage you to put their name forward. This is the batch's decision as much as it is ours.</p>
            <div className="batchrep-local-notice">
              <span className="batchrep-local-notice-icon">&#128205;</span>
              <span><strong>Please note:</strong> At the request of the USLS Alumni Association, the Batch Representative is preferred to be locally based in Bacolod, as this person will be required to attend board meetings in person and will eventually serve as Alumni Association President during our 25th Jubilee in 2028.</span>
            </div>
          </div>
        </div>

        {/* Role & Responsibilities */}
        <div className={`batchrep-collapsible ${openSections.role ? 'open' : ''}`} id="section-role">
          <button className="batchrep-collapsible-trigger" onClick={() => toggleSection('role')}>
            <span className="trigger-left">Role & Responsibilities</span>
            <span className="batchrep-collapsible-arrow">&#9660;</span>
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
              <span>The Batch Representative will not be starting from scratch. There is already an organizing committee in place that has been working since 2023 - fully committed and ready to support whoever takes on this role.</span>
            </div>
          </div>
        </div>

        {/* Feedback Form */}
        <div className="batchrep-feedback-card" id="section-response">
          <div className="batchrep-feedback-header">
            <h3>Your response</h3>
            <p>Registered graduates only - Responses are confidential</p>
          </div>
          <div className="batchrep-feedback-body">
            {submitSuccess || hasSubmitted ? (
              <div className="batchrep-success-message">
                <div className="batchrep-success-icon">&#10003;</div>
                <h4>Thank you!</h4>
                <p>Your response has been recorded. Results will be shared with the batch once the feedback window closes.</p>
                <button className="batchrep-btn-secondary" onClick={() => navigate('/profile')}>
                  Back to Profile
                </button>
              </div>
            ) : status !== 'active' ? (
              <div className="batchrep-closed-message">
                <p>Submissions are currently closed.</p>
                <button className="batchrep-btn-secondary" onClick={() => navigate('/profile')}>
                  Back to Profile
                </button>
              </div>
            ) : !isGrad ? (
              <div className="batchrep-closed-message">
                <p>Only registered graduates can submit responses.</p>
                <button className="batchrep-btn-secondary" onClick={() => navigate('/profile')}>
                  Back to Profile
                </button>
              </div>
            ) : (
              <>
                <p>The organizing committee proposes Bianca Jison as our Batch Representative. Please confirm below. If you have feedback or would like to nominate someone else, you may use the optional fields.</p>

                <div className="batchrep-feedback-options">
                  <label
                    className={`batchrep-feedback-option ${selection === 'confirm' ? 'selected' : ''}`}
                    onClick={() => setSelection('confirm')}
                  >
                    <input
                      type="radio"
                      name="feedback"
                      value="confirm"
                      checked={selection === 'confirm'}
                      onChange={() => setSelection('confirm')}
                    />
                    <div>
                      <div className="batchrep-feedback-option-text">I confirm Bianca Jison as our Batch Representative</div>
                    </div>
                  </label>
                </div>

                <div className="batchrep-simple-field">
                  <label>Feedback or comments <span className="optional">optional</span></label>
                  <textarea
                    placeholder="Share any feedback here..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                </div>

                <div className="batchrep-simple-field">
                  <label>Nominate someone else <span className="optional">optional</span></label>
                  <div className="batchrep-local-reminder">Your nominee must be locally based in Bacolod to be eligible.</div>
                  <div className="batchrep-typeahead-wrap" ref={dropdownRef}>
                    <input
                      type="text"
                      placeholder="Type a name to search graduates..."
                      value={nomineeSearch}
                      onChange={handleNomineeSearchChange}
                      onFocus={() => nomineeSearch.length >= 2 && nominees.length > 0 && setShowDropdown(true)}
                    />
                    {showDropdown && (
                      <div className="batchrep-typeahead-dropdown open">
                        {nominees.length === 0 ? (
                          <div className="batchrep-typeahead-empty">No matching graduates found</div>
                        ) : (
                          nominees.map((nominee) => (
                            <div
                              key={nominee.id}
                              className="batchrep-typeahead-item"
                              onClick={() => {
                                selectNominee(nominee);
                                setSelection('nominate');
                              }}
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
                  <div className="batchrep-error-message">{submitError}</div>
                )}

                <button
                  className="batchrep-submit-btn"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>

                <div className="batchrep-confidential-note">
                  <span>Responses are confidential. Results will be shared with the batch once the window closes.</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="batchrep-footer">
          USLS-IS High School Batch 2003 - 25th Alumni Homecoming - December 16, 2028
        </div>
      </div>
    </div>
  );
}
