import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import letterImage from '../images/batch-rep-letter.jpg';
import '../styles/batchrep.css';

// Access control phases:
// Phase 1: Only specific emails (super-admin override via user?.id === 71 AND required)
// Phase 2: Non-registry admins only (committee members with enabled non-registry permissions)
//          Registry-only admins do NOT qualify — they must not see this page at their level
// Phase 3: All registered GRADUATES only — non-graduate registrants are excluded
const BATCH_REP_PHASE = 3;

// isGrad — derived from master_list section check on the backend
// hasNonRegistryPermissions — already on user object from AuthContext,
//   true only if admin has at least one enabled non-registry permission
//   (excludes invites_export, masterlist_edit, masterlist_upload, masterlist_export, registered_export)
const checkPhaseAccess = (user, isGrad) => {
  if (!user) return false;
  const userEmail = user.email?.toLowerCase();

  switch (BATCH_REP_PHASE) {
    case 1:
      // Phase 1: email allowlist
      const allowedEmails = ['felie@fnrcore.com'];
      return allowedEmails.includes(userEmail);
    case 2:
      // Phase 2: non-registry admins only
      // user.isAdmin must be true AND must have non-registry permissions enabled
      // registry-only admins (invites, masterlist, export) are excluded
      return user.isAdmin === true && user.hasNonRegistryPermissions === true;
    case 3:
      // Phase 3: graduates only
      // non-graduate registrants (section IS NULL or 'Non-Graduate') return false
      return isGrad === true;
    default:
      return false;
  }
};

// Voting deadline: March 29, 2026 at 11:59 PM PHT (UTC+8)
const VOTING_DEADLINE = new Date('2026-03-29T23:59:00+08:00');

export default function BatchRepVoting() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [existingVote, setExistingVote] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [rolesOpen1, setRolesOpen1] = useState(false);
  const [rolesOpen2, setRolesOpen2] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [whyVotingOpen, setWhyVotingOpen] = useState(false);
  // true only if backend confirms master_list section is non-null and not 'Non-Graduate'
  const [isGrad, setIsGrad] = useState(false);
  // Countdown state
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Auto-scroll target — jumps to submit button when candidate is selected
  const submitBtnRef = useRef(null);

  // Phase 1: BOTH checkPhaseAccess AND user?.id === 71 must pass
  // When advancing to Phase 2: remove `&& user?.id === 71`
  // When advancing to Phase 3: remove `&& user?.id === 71`, ensure isGrad is populated
  // One-off exception: nicolo2100@gmail.com is a non-grad friend of the batch
  // granted voting access manually alongside the phase check
  const hasAccess = checkPhaseAccess(user, isGrad) ||
    user?.email?.toLowerCase() === 'nicolo2100@gmail.com';

  // Check if deadline has passed
  const isDeadlinePassed = new Date() > VOTING_DEADLINE;

  // Fetch voting status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await apiGet('/api/batch-rep/round2/status');
        if (res.ok) {
          const data = await res.json();
          setHasVoted(data.hasVoted);
          setExistingVote(data.vote);
          setIsGrad(data.isGrad ?? false); // set for Phase 3 graduate-only gate
        }
      } catch (err) {
        console.error('Error fetching round2 status:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [user, hasAccess]);

  // Countdown timer
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const diff = VOTING_DEADLINE - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return { days, hours, minutes, seconds };
    };

    setTimeRemaining(calculateTimeRemaining());

    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Scroll to submit button as soon as a candidate is selected
  useEffect(() => {
    if (selectedCandidate && submitBtnRef.current) {
      submitBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedCandidate]);

  // Handle vote submission
  const handleSubmit = async () => {
    if (!selectedCandidate || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiPost('/api/batch-rep/round2/vote', {
        candidate_name: selectedCandidate
      });

      if (res.ok) {
        setHasVoted(true);
        setExistingVote({ candidate_name: selectedCandidate });
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit vote');
      }
    } catch (err) {
      console.error('Error submitting vote:', err);
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container batchrep-page">
          <div className="card">
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              Loading...
            </p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Render access denied
  if (!hasAccess) {
    return (
      <>
        <Navbar />
        <div className="container batchrep-page">
          <div className="card">
            <div className="batchrep-message">
              <p>You don't have access to this page.</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
              >
                Go to Profile
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container batchrep-page">
        {/* Header */}
        <div className="card">
          <h1 className="page-title-gold" style={{ marginBottom: '8px' }}>
            Round 2 Voting
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Cast your vote for Alumni Association Representative
          </p>

          {/* Countdown Timer */}
          {!isDeadlinePassed && (
            <div className="batchrep-timer-box" style={{
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: 'var(--color-text-secondary)',
                marginBottom: '12px'
              }}>
                Voting Ends In
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                {[
                  { value: timeRemaining.days, label: 'Days' },
                  { value: timeRemaining.hours, label: 'Hours' },
                  { value: timeRemaining.minutes, label: 'Minutes' },
                  { value: timeRemaining.seconds, label: 'Seconds' }
                ].map((item, idx) => (
                  <div key={idx} style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.75rem',
                      fontWeight: '700',
                      fontFamily: 'var(--font-heading)',
                      color: 'var(--color-hover)',
                      lineHeight: '1'
                    }}>
                      {String(item.value).padStart(2, '0')}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginTop: '4px'
                    }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isDeadlinePassed && (
            <div className="batchrep-deadline">
              <strong>Voting has ended.</strong> The deadline was March 29, 2026 at 11:59 PM PHT.
            </div>
          )}

        {/* Why we're voting overview - Collapsible */}
        <div className={`batchrep-collapsible ${whyVotingOpen ? 'open' : ''}`}>
          <button className="batchrep-collapsible-trigger" onClick={() => setWhyVotingOpen(!whyVotingOpen)}>
            <span>Why we're voting</span>
            <span className="batchrep-collapsible-arrow">▼</span>
          </button>
          <div className="batchrep-collapsible-body">
            <p style={{ marginBottom: '12px' }}>
              The USLS Alumni Association has asked our batch to put forward an official representative.
              In Round 1, the organizing committee presented its two co-chairs as nominees —{' '}
              <strong>Bianca Jison</strong> for Alumni Association Representative and{' '}
              <strong>Felie Magbanua</strong> for Batch Representative.
            </p>
            <p style={{ marginBottom: '12px' }}>
              For <strong>Position 2 (Batch Representative)</strong>, no willing nominations came in.
              Felie is confirmed uncontested.
            </p>
            <p style={{ marginBottom: '0' }}>
              For <strong>Position 1 (Alumni Association Representative)</strong>, a batchmate confirmed
              their willingness to serve if nominated. Per the Round 1 process, this moves to a batch
              vote—bringing us here. This is ultimately the batch's decision.
            </p>
            <div className="batchrep-overview-divider batchrep-overview-footer" style={{ marginTop: '16px', paddingTop: '16px' }}>
              <a
                href="#official-letter"
                onClick={(e) => { e.preventDefault(); setLetterOpen(true); }}
                className="batchrep-overview-letter-link"
              >
                📄 See Official Letter →
              </a>
            </div>
          </div>
        </div>

        {/* Official Letter Collapsible */}
        <div className={`batchrep-collapsible ${letterOpen ? 'open' : ''}`}>
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

        {/* Position 1: Alumni Association Representative - Voting */}
        <div className="batchrep-nominee-card">
          <div className="batchrep-nominee-header">
            <span>Position 1 · Alumni Association Representative</span>
          </div>
          <div className="batchrep-nominee-body">
            <div className={`batchrep-collapsible ${rolesOpen1 ? 'open' : ''}`} style={{ marginBottom: '8px' }}>
              <button className="batchrep-collapsible-trigger" onClick={() => setRolesOpen1(!rolesOpen1)} style={{ padding: '12px 16px' }}>
                <span style={{ fontSize: '0.85rem' }}>Role & Responsibilities</span>
                <span className="batchrep-collapsible-arrow">▼</span>
              </button>
              <div className="batchrep-collapsible-body" style={{ fontSize: '0.85rem' }}>
                <ul>
                  <li>Serves as the batch's official representative within the Alumni Association structure</li>
                  <li>Attends alumni association meetings and represents the batch in alumni matters. Local presence required (preferably Bacolod or nearby cities)</li>
                  <li>Coordinates directly with the Alumni Association board and alumni office</li>
                  <li>Communicates alumni-level updates and requirements to the Batch Rep and organizing committee</li>
                  <li>Represents the batch in official alumni events, ceremonies, and institutional activities</li>
                  <li>Follows the alumni leadership ladder: AA Rep → Vice President → Alumni Association President (during the Jubilee)</li>
                  <li>Helps ensure the batch fulfills its responsibilities as the Jubilee host batch</li>
                </ul>
              </div>
            </div>

            <div className="batchrep-voting-section">
            {hasVoted ? (
              <div className="batchrep-success">
                <div className="batchrep-success-icon">✓</div>
                <p style={{ marginBottom: '8px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  Vote submitted.
                </p>
                <p style={{ marginBottom: '0' }}>
                  You voted for <strong style={{ color: 'var(--color-hover)' }}>{existingVote?.candidate_name}</strong>.
                  Your vote has been recorded and cannot be changed. Results will be announced after the deadline.
                </p>
              </div>
            ) : isDeadlinePassed ? (
              <div className="batchrep-message">
                <p><strong>Voting is Now Closed.</strong> The deadline was March 29, 2026 at 11:59 PM PHT.</p>
                <p>Results will be announced by the organizing committee.</p>
              </div>
            ) : (
              <>
                {/* Bianca Jison */}
                <div
                  onClick={() => setSelectedCandidate('Bianca Jison')}
                  className={`batchrep-confirm-option batchrep-candidate-card ${selectedCandidate === 'Bianca Jison' ? 'selected' : ''}`}
                  style={{ padding: '16px', cursor: 'pointer', marginBottom: '12px' }}
                >
                  <input
                    type="radio"
                    name="candidate"
                    checked={selectedCandidate === 'Bianca Jison'}
                    onChange={() => setSelectedCandidate('Bianca Jison')}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="batchrep-candidate-info">
                    <div className="batchrep-nominee-name voting">Bianca Jison</div>
                    <span className="batchrep-role-badge">Committee Nominee</span>
                  </div>
                </div>

                {/* Mel Andrea Rivero */}
                <div
                  onClick={() => setSelectedCandidate('Mel Andrea Rivero')}
                  className={`batchrep-confirm-option batchrep-candidate-card ${selectedCandidate === 'Mel Andrea Rivero' ? 'selected' : ''}`}
                  style={{ padding: '16px', cursor: 'pointer', marginBottom: '0' }}
                >
                  <input
                    type="radio"
                    name="candidate"
                    checked={selectedCandidate === 'Mel Andrea Rivero'}
                    onChange={() => setSelectedCandidate('Mel Andrea Rivero')}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="batchrep-candidate-info">
                    <div className="batchrep-nominee-name voting">Mel Andrea Rivero</div>
                    <span className="batchrep-role-badge" style={{ color: 'var(--color-status-positive)', background: 'rgba(39, 174, 96, 0.15)' }}>Willing / Nominated</span>
                  </div>
                </div>

                <div className="batchrep-deadline-notice" style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    🔒 Responses are confidential
                  </div>
                  Votes are final and cannot be changed. Majority wins by deadline:{' '}
                  <strong>March 29, 2026 · 11:59 PM PHT</strong>.
                </div>

                {error && (
                  <div style={{
                    background: 'var(--color-status-negative-bg)', border: '1px solid var(--color-status-negative)',
                    borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
                    color: 'var(--color-status-negative)', fontSize: '0.9rem'
                  }}>
                    {error}
                  </div>
                )}

                <button
                  ref={submitBtnRef}
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!selectedCandidate || submitting}
                  style={{ width: '100%' }}
                >
                  {submitting ? 'Submitting...' : 'Submit Vote'}
                </button>
              </>
            )}
            </div>
          </div>
        </div>

        {/* Position 2: Batch Representative - Confirmed/Uncontested */}
        <div className="batchrep-nominee-card">
          <div className="batchrep-nominee-header">
            <span>Position 2 · Batch Representative</span>
          </div>

          <div className="batchrep-nominee-body">
            <div className={`batchrep-collapsible ${rolesOpen2 ? 'open' : ''}`} style={{ marginBottom: '8px' }}>
              <button className="batchrep-collapsible-trigger" onClick={() => setRolesOpen2(!rolesOpen2)} style={{ padding: '12px 16px' }}>
                <span style={{ fontSize: '0.85rem' }}>Role & Responsibilities</span>
                <span className="batchrep-collapsible-arrow">▼</span>
              </button>
              <div className="batchrep-collapsible-body" style={{ fontSize: '0.85rem' }}>
                <ul>
                  <li>Represents Batch 2003 to the batch itself and serves as the main point of contact for batchmates</li>
                  <li>Leads batch coordination and engagement leading up to the Jubilee and other batch initiatives</li>
                  <li>Works closely with the organizing committee to plan activities, gatherings, and participation</li>
                  <li>Communicates updates, decisions, and announcements to the batch</li>
                  <li>Mobilizes batch participation in alumni events, registration drives, and batch projects</li>
                  <li>Coordinates with the AA Rep when alumni matters affect the batch</li>
                  <li>Helps maintain unity and participation within the batch community</li>
                  <li>Remote participation accepted. No Bacolod presence required</li>
                </ul>
              </div>
            </div>
            {/* Confirmed uncontested header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'var(--color-status-positive)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '1.25rem', flexShrink: '0'
              }}>
                ✓
              </div>
              <div>
                <div className="batchrep-nominee-name voting">Felie Magbanua</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-status-positive)', fontWeight: '600' }}>
                  Confirmed
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', margin: 0 }}>
              The position is uncontested and therefore confirmed.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="batchrep-page-footer">
          USLS-IS · 25th Alumni Homecoming · December 16, 2028
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
