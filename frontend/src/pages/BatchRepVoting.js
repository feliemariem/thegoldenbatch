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

// Candidate data
const CANDIDATES = [
  {
    name: 'Bianca Jison',
    tag: 'Committee Nominee'
  },
  {
    name: 'Mel Andrea Rivero',
    tag: 'Willing / Contested'
  }
];

export default function BatchRepVoting() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [existingVote, setExistingVote] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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
        </div>

        {/* Position 1: Alumni Association Representative - Voting */}
        <div className="batchrep-response-card">
          <div className="batchrep-response-header">
            <h3>Position 1: Alumni Association Representative</h3>
            <p>Two candidates - select one to cast your vote</p>
          </div>

          <div className="batchrep-response-body">
            {hasVoted ? (
              // Confirmed/Locked State
              <div className="batchrep-success">
                <div className="batchrep-success-icon">✓</div>
                <h3 style={{
                  color: 'var(--color-text-primary)',
                  marginBottom: '8px',
                  fontFamily: 'var(--font-heading)'
                }}>
                  Vote Submitted
                </h3>
                <p>
                  You voted for <strong style={{ color: 'var(--color-hover)' }}>{existingVote?.candidate_name}</strong>.
                  <br />
                  Your vote has been recorded and cannot be changed.
                </p>
              </div>
            ) : isDeadlinePassed ? (
              // Deadline passed, no vote
              <div className="batchrep-message">
                <p>You did not cast a vote before the deadline.</p>
              </div>
            ) : (
              // Voting Form
              <>
                {/* Candidate Cards - Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  {CANDIDATES.map((candidate) => (
                    <div
                      key={candidate.name}
                      onClick={() => setSelectedCandidate(candidate.name)}
                      className={`batchrep-confirm-option ${selectedCandidate === candidate.name ? 'selected' : ''}`}
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '20px',
                        cursor: 'pointer',
                        marginBottom: '0'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        marginBottom: '8px'
                      }}>
                        <input
                          type="radio"
                          name="candidate"
                          checked={selectedCandidate === candidate.name}
                          onChange={() => setSelectedCandidate(candidate.name)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="batchrep-confirm-text" style={{ fontSize: '1.1rem' }}>
                          {candidate.name}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: candidate.tag.includes('Committee') ? 'var(--color-hover)' : 'var(--color-status-positive)',
                        background: candidate.tag.includes('Committee')
                          ? 'rgba(207, 181, 59, 0.15)'
                          : 'rgba(39, 174, 96, 0.15)',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        marginLeft: '30px'
                      }}>
                        {candidate.tag}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Disclaimer */}
                <div className="batchrep-confidential" style={{ marginBottom: '20px' }}>
                  <span>🔒</span>
                  <span>Your vote is anonymous and cannot be changed after submission.</span>
                </div>

                {/* Error Message */}
                {error && (
                  <div style={{
                    background: 'var(--color-status-negative-bg)',
                    border: '1px solid var(--color-status-negative)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    color: 'var(--color-status-negative)',
                    fontSize: '0.9rem'
                  }}>
                    {error}
                  </div>
                )}

                {/* Submit Button */}
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
            <span>Position 2: Batch Representative</span>
          </div>
          <div className="batchrep-nominee-body">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--color-status-positive)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.25rem'
              }}>
                ✓
              </div>
              <div>
                <div className="batchrep-nominee-name" style={{ marginBottom: '2px' }}>
                  Felie Magbanua
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--color-status-positive)',
                  fontWeight: '600'
                }}>
                  Confirmed — Uncontested
                </div>
              </div>
            </div>
            <p style={{
              fontSize: '0.9rem',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.6',
              margin: 0
            }}>
              This position has only one nominee and does not require a vote.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="batchrep-page-footer">
          USLSIS Batch 2003 · Round 2 Voting
        </div>
      </div>
      <Footer />
    </>
  );
}
