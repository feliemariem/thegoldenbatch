import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/batchrep.css';

// Access control phases:
// Phase 1: Only specific emails
// Phase 2: All admins
// Phase 3: All registered graduates
const BATCH_REP_PHASE = 1;

// Check if user has access based on current phase
const checkPhaseAccess = (user) => {
  if (!user) return false;

  const userEmail = user.email?.toLowerCase();

  switch (BATCH_REP_PHASE) {
    case 1:
      const allowedEmails = ['felie@fnrcore.com'];
      return allowedEmails.includes(userEmail);
    case 2:
      return user.isAdmin === true;
    case 3:
      return true; // All registered users
    default:
      return false;
  }
};

// Voting deadline: March 30, 2026 at 11:59 PM PHT (UTC+8)
const VOTING_DEADLINE = new Date('2026-03-30T23:59:00+08:00');

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
  const [aboutOpenBianca, setAboutOpenBianca] = useState(false);
  const [aboutOpenMel, setAboutOpenMel] = useState(false);
  const [rolesOpen2, setRolesOpen2] = useState(false);
  const [aboutOpenFelie, setAboutOpenFelie] = useState(false);

  // Countdown state
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Check access - both phase access AND user.id === 71
  const hasAccess = checkPhaseAccess(user) && user?.id === 71;

  // Fetch voting status
  useEffect(() => {
    const fetchStatus = async () => {
      if (!user || !hasAccess) {
        setLoading(false);
        return;
      }

      try {
        const res = await apiGet('/api/batch-rep/round2/status');
        if (res.ok) {
          const data = await res.json();
          setHasVoted(data.hasVoted);
          setExistingVote(data.vote);
        }
      } catch (err) {
        console.error('Error fetching round2 status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
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

  // Check if deadline has passed
  const isDeadlinePassed = new Date() > VOTING_DEADLINE;

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
            <div style={{
              background: 'linear-gradient(135deg, rgba(139, 105, 20, 0.12) 0%, rgba(207, 181, 59, 0.08) 100%)',
              border: '1px solid rgba(207, 181, 59, 0.25)',
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center'
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
              <strong>Voting has ended.</strong> The deadline was March 30, 2026 at 11:59 PM PHT.
            </div>
          )}

        {/* Why we're voting overview */}
        <div className="batchrep-response-card">
          <div className="batchrep-response-header">
            <h3>Why we're voting</h3>
          </div>
          <div className="batchrep-response-body" style={{ padding: '20px' }}>
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
              For <strong>Position 1 (Alumni Association Representative)</strong>, a batchmate stepped
              forward, confirmed their willingness to serve, and is now on the ballot as an alternative
              nominee. That triggers a batch vote — and this is ultimately the batch's decision.
            </p>
          </div>
        </div>

        {/* Position 1: Alumni Association Representative - Voting */}
        <div className="batchrep-nominee-card">
          <div className="batchrep-position-top" style={{ borderRadius: '14px 14px 0 0' }}>
            <div className="batchrep-position-info">
              <div className="batchrep-position-num">Position 1</div>
              <div className="batchrep-position-title">Alumni Association Representative</div>
            </div>
            <button
              className={`batchrep-roles-toggle ${rolesOpen1 ? 'open' : ''}`}
              onClick={() => setRolesOpen1(!rolesOpen1)}
            >
              Roles <span className="arrow">▼</span>
            </button>
          </div>

          <div className={`batchrep-roles-content ${rolesOpen1 ? 'open' : ''}`}>
            <ul>
              <li>Serves as the batch's official representative within the Alumni Association structure</li>
              <li>Attends alumni association meetings and represents the batch in alumni matters. Local presence required (preferably Bacolod or nearby cities)</li>
              <li>Coordinates directly with the Alumni Association board and alumni office</li>
              <li>Communicates alumni-level updates and requirements to the Batch Rep and organizing committee</li>
              <li>Represents the batch in official alumni events, ceremonies, and institutional activities</li>
              <li>Follows the alumni leadership ladder: AA Rep → Vice President → Alumni Association President (during the Jubilee)</li>
              <li>Helps ensure the batch fulfills its responsibilities as the Jubilee host batch</li>
            </ul>
            <p className="batchrep-roles-note">
              The Alumni Association Representative will not be starting from scratch. There is already an organizing committee in place that has been working since 2023, fully committed and ready to support whoever takes on this role.
            </p>
          </div>

          <div className="batchrep-response-body" style={{ padding: '20px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Two candidates — select one to cast your vote
            </p>

            {hasVoted ? (
              <div className="batchrep-success">
                <div className="batchrep-success-icon">✓</div>
                <h3 style={{ color: 'var(--color-text-primary)', marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>
                  Vote Submitted
                </h3>
                <p>
                  You voted for <strong style={{ color: 'var(--color-hover)' }}>{existingVote?.candidate_name}</strong>.
                  <br />
                  Your vote has been recorded and cannot be changed.
                </p>
              </div>
            ) : isDeadlinePassed ? (
              <div className="batchrep-message">
                <p>You did not cast a vote before the deadline.</p>
              </div>
            ) : (
              <>
                {/* Bianca Jison */}
                <div
                  onClick={() => setSelectedCandidate('Bianca Jison')}
                  className={`batchrep-confirm-option ${selectedCandidate === 'Bianca Jison' ? 'selected' : ''}`}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px', cursor: 'pointer', marginBottom: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="radio"
                        name="candidate"
                        checked={selectedCandidate === 'Bianca Jison'}
                        onChange={() => setSelectedCandidate('Bianca Jison')}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="batchrep-nominee-name" style={{ marginBottom: 0 }}>Bianca Jison</div>
                    </div>
                    <button
                      className={`batchrep-roles-toggle ${aboutOpenBianca ? 'open' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setAboutOpenBianca(!aboutOpenBianca); }}
                    >
                      About <span className="arrow">▼</span>
                    </button>
                  </div>
                  <div style={{ marginLeft: '30px' }}>
                    <span className="batchrep-role-badge" style={{ marginBottom: '8px', display: 'inline-block' }}>Committee Nominee</span>
                    {aboutOpenBianca && (
                      <div className="batchrep-nominee-blurb" style={{ marginTop: '8px', marginBottom: 0 }}>
                        Initiated the formation of the organizing committee in 2023 and has co-led its planning and operations since. Has served as the batch's local anchor, attending events, building connections on the ground, and acting as the direct line to the USLS Alumni Association, including attending meetings on behalf of the batch.
                      </div>
                    )}
                  </div>
                </div>

                {/* Mel Andrea Rivero */}
                <div
                  onClick={() => setSelectedCandidate('Mel Andrea Rivero')}
                  className={`batchrep-confirm-option ${selectedCandidate === 'Mel Andrea Rivero' ? 'selected' : ''}`}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px', cursor: 'pointer', marginBottom: '0' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="radio"
                        name="candidate"
                        checked={selectedCandidate === 'Mel Andrea Rivero'}
                        onChange={() => setSelectedCandidate('Mel Andrea Rivero')}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="batchrep-nominee-name" style={{ marginBottom: 0 }}>Mel Andrea Rivero</div>
                    </div>
                    <button
                      className={`batchrep-roles-toggle ${aboutOpenMel ? 'open' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setAboutOpenMel(!aboutOpenMel); }}
                    >
                      About <span className="arrow">▼</span>
                    </button>
                  </div>
                  <div style={{ marginLeft: '30px' }}>
                    <span className="batchrep-role-badge" style={{ marginBottom: '8px', display: 'inline-block', color: 'var(--color-status-positive)', background: 'rgba(39, 174, 96, 0.15)' }}>Willing / Contested</span>
                    {aboutOpenMel && (
                      <div className="batchrep-nominee-blurb" style={{ marginTop: '8px', marginBottom: 0 }}>
                        Confirmed willingness to serve as Alumni Association Representative.
                      </div>
                    )}
                  </div>
                </div>

                <div className="batchrep-confidential" style={{ marginTop: '20px', marginBottom: '20px' }}>
                  <span>🔒</span>
                  <span>Your vote is anonymous and cannot be changed after submission.</span>
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

        {/* Position 2: Batch Representative - Confirmed/Uncontested */}
        <div className="batchrep-nominee-card">
          <div className="batchrep-nominee-header">
            <span>Position 2 · Batch Representative</span>
          </div>

          {/* Position header with Roles toggle */}
          <div className="batchrep-position-top" style={{ borderRadius: '0' }}>
            <div className="batchrep-position-info">
              <div className="batchrep-position-num">Position 2</div>
              <div className="batchrep-position-title">Batch Representative</div>
            </div>
            <button
              className={`batchrep-roles-toggle ${rolesOpen2 ? 'open' : ''}`}
              onClick={() => setRolesOpen2(!rolesOpen2)}
            >
              Roles <span className="arrow">▼</span>
            </button>
          </div>

          {/* Roles & Responsibilities */}
          <div className={`batchrep-roles-content ${rolesOpen2 ? 'open' : ''}`}>
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
            <p className="batchrep-roles-note">
              The Batch Representative will not be starting from scratch. There is already an organizing committee in place that has been working since 2023, fully committed and ready to support whoever takes on this role.
            </p>
          </div>

          <div className="batchrep-nominee-body">
            {/* Confirmed uncontested header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'var(--color-status-positive)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '1.25rem', flexShrink: '0'
                }}>
                  ✓
                </div>
                <div>
                  <div className="batchrep-nominee-name">Felie Magbanua</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-status-positive)', fontWeight: '600' }}>
                    Confirmed — Uncontested
                  </div>
                </div>
              </div>
              <button
                className={`batchrep-roles-toggle ${aboutOpenFelie ? 'open' : ''}`}
                onClick={() => setAboutOpenFelie(!aboutOpenFelie)}
              >
                About <span className="arrow">▼</span>
              </button>
            </div>

            {aboutOpenFelie && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '12px', fontStyle: 'italic', marginLeft: '52px' }}>
                Co-led the strategic planning and operations of the organizing committee since 2023. Formalized the committee structure, defined roles and scopes, onboarded additional members, and built the platform that keeps the batch's work organized, moving, and transparent.
              </p>
            )}

            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', margin: 0 }}>
              The position is uncontested, confirmed, and does not require a vote.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="batchrep-page-footer">
          USLSIS Batch 2003 · Round 2 Voting
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
