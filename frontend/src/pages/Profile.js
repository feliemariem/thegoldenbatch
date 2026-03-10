import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import { apiGet, apiPut } from '../api';
import '../styles/batchrep.css';

// Access control phases for batch-rep feature:
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

const isDeadlinePassed = () => {
  return new Date() > BATCH_REP_DEADLINE;
};

const getDaysUntilBatchRepDeadline = () => {
  const now = new Date();
  const diffTime = BATCH_REP_DEADLINE - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function Profile() {
  const { user, logout, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showBatchRepModal, setShowBatchRepModal] = useState(false);
  const [batchRepChecked, setBatchRepChecked] = useState(false);
  const [batchRepHasSubmitted, setBatchRepHasSubmitted] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    birthday: '',
    mobile: '',
    address: '',
    city: '',
    country: '',
    occupation: '',
    company: '',
    rsvp_status: '',
  });

  // Reset batchRepChecked on every mount so status is re-fetched fresh
  useEffect(() => {
    setBatchRepChecked(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      // Reset batch rep state on logout
      setBatchRepChecked(false);
      setBatchRepHasSubmitted(false);
      setShowBatchRepModal(false);
    }
  }, [user]);

  // Check batch-rep status after profile loads
  useEffect(() => {
    const checkBatchRepStatus = async () => {
      if (!profile || batchRepChecked) return;

      // Don't show modal if deadline has passed
      if (isDeadlinePassed()) {
        setBatchRepChecked(true);
        return;
      }

      try {
        const res = await apiGet('/api/batch-rep/status');
        if (res.ok) {
          const data = await res.json();
          // Store submission state
          setBatchRepHasSubmitted(data.hasSubmitted);
          // Show modal if:
          // 1. User has phase access
          // 2. Status is active
          // 3. Deadline has not passed
          const hasAccess = checkPhaseAccess(user, data.isGrad);
          if (hasAccess && data.status === 'active' && !isDeadlinePassed()) {
            setShowBatchRepModal(true);
          }
        }
      } catch (err) {
        console.error('Error checking batch-rep status:', err);
      } finally {
        setBatchRepChecked(true);
      }
    };

    checkBatchRepStatus();
  }, [profile, user, batchRepChecked]);

  const fetchProfile = async () => {
    try {
      const res = await apiGet('/api/me');
      const data = await res.json();
      setProfile(data);
      setForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        birthday: data.birthday ? data.birthday.split('T')[0] : '',
        mobile: data.mobile || '',
        address: data.address || '',
        city: data.city || '',
        country: data.country || '',
        occupation: data.occupation || '',
        company: data.company || '',
        rsvp_status: data.rsvp_status || '',
      });
    } catch (err) {
      console.error('Failed to fetch profile');
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await apiPut('/api/me', form);

      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, ...data });
        setEditing(false);
        setMessage('Profile updated!');
      }
    } catch (err) {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRsvp = async (status) => {
    setRsvpSaving(true);
    setMessage('');

    try {
      const res = await apiPut('/api/me/rsvp', { status });

      if (res.ok) {
        setProfile({ ...profile, rsvp_status: status });
        setMessage('RSVP updated!');
      }
    } catch (err) {
      setMessage('Failed to update RSVP');
    } finally {
      setRsvpSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Helper function to format birthday without timezone conversion
  const formatBirthday = (dateStr) => {
    if (!dateStr) return '';
    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  };

  if (!profile) {
    return (
      <div className="container">
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <div className="card">
          <p>Loading...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="container">
      <button
        onClick={toggleTheme}
        className="theme-toggle"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="card">
        <img src={logo} alt="USLS Logo" className="logo" />
        <h2 className="page-title-gold" style={{ marginBottom: '8px' }}>The Golden Batch</h2>
        <div className="header-row">
          <h4 style={{ margin: 0 }}>USLS-IS 2003</h4>
          <div>
            <button onClick={() => navigate('/')} className="btn-link" style={{ marginRight: '12px' }}>
              Home
            </button>
            <button onClick={handleLogout} className="btn-link">
              Logout
            </button>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="welcome-section">
          <h2>🎉 Welcome, {profile.first_name}!</h2>
          <p>Thank you for registering for our <strong>25th Alumni Homecoming</strong>!</p>
          <p>Stay tuned for exciting updates on events, galleries, and more features coming to this site. You can also visit our <a href="https://www.facebook.com/groups/478382298877930" target="_blank" rel="noopener noreferrer">Facebook page</a>!</p>
        </div>

        {message && <p className="success">{message}</p>}

        {/* Profile Section */}
        <div className="profile-section">
          <div className="section-header">
            <h3>Your Information</h3>
            {!editing && (
              <button onClick={() => setEditing(true)} className="btn-secondary">
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Birthday</label>
                  <input
                    type="date"
                    name="birthday"
                    value={form.birthday}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Mobile</label>
                  <input
                    type="tel"
                    name="mobile"
                    value={form.mobile}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Country *</label>
                  <input
                    type="text"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Occupation</label>
                  <input
                    type="text"
                    name="occupation"
                    value={form.occupation}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Are you attending our homecoming on December 16, 2028  at Santuario de La Salle, USLS, Bacolod City? *</label>
                <div className="rsvp-buttons-register">
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp_status === 'going' ? 'active going' : ''}`}
                    onClick={() => setForm({ ...form, rsvp_status: 'going' })}
                  >
                    ✓ Going
                  </button>
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp_status === 'maybe' ? 'active maybe' : ''}`}
                    onClick={() => setForm({ ...form, rsvp_status: 'maybe' })}
                  >
                    ? Maybe
                  </button>
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp_status === 'not_going' ? 'active not-going' : ''}`}
                    onClick={() => setForm({ ...form, rsvp_status: 'not_going' })}
                  >
                    ✗ Not Going
                  </button>
                </div>
              </div>

              <div className="button-row">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-display">
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
              {profile.birthday && <p><strong>Birthday:</strong> {formatBirthday(profile.birthday)}</p>}
              {profile.mobile && <p><strong>Mobile:</strong> {profile.mobile}</p>}
              {profile.address && <p><strong>Address:</strong> {profile.address}</p>}
              <p><strong>Location:</strong> {profile.city}, {profile.country}</p>
              {profile.occupation && <p><strong>Occupation:</strong> {profile.occupation}</p>}
              {profile.company && <p><strong>Company:</strong> {profile.company}</p>}
            </div>
          )}
        </div>

      </div>
      <Footer />

      {/* Batch Rep Announcement Modal - blocks profile until user responds */}
      {showBatchRepModal && (
        <div className="batchrep-modal-overlay">
          <div className="batchrep-modal">
            <div className="batchrep-modal-bar"></div>
            <div className="batchrep-modal-body">
              {batchRepHasSubmitted ? (
                <>
                  <div className="batchrep-modal-badge submitted">✓ Response Recorded</div>
                  <h2 className="batchrep-modal-title">Hi {profile?.first_name || 'there'}, you've already responded.</h2>
                  <p className="batchrep-modal-desc">
                    Changed your mind? You can update your response anytime before the deadline.
                  </p>
                  <button
                    className="batchrep-modal-btn"
                    onClick={() => navigate('/batch-rep')}
                  >
                    Update My Response →
                  </button>
                  <button
                    className="batchrep-modal-dismiss"
                    onClick={() => setShowBatchRepModal(false)}
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <>
                  <div className="batchrep-modal-badge">⚡ Quick Batch Input</div>
                  <h2 className="batchrep-modal-title">Hi {profile?.first_name || 'there'}, the batch needs to hear from you.</h2>
                  <p className="batchrep-modal-desc">
                    The organizing committee has been working behind the scenes to lay the groundwork. Now it's time for the batch to choose who will represent Batch 2003 for <strong>two official positions</strong>.
                  </p>
                  <div className="batchrep-modal-nominees">
                    <div className="batchrep-modal-nominee">
                      <div className="batchrep-modal-nominee-avatar initials">BJ</div>
                      <div className="batchrep-modal-nominee-info">
                        <div className="batchrep-modal-nominee-label">Nominee · Alumni Assoc. Representative</div>
                        <div className="batchrep-modal-nominee-name">Bianca Jison</div>
                      </div>
                    </div>
                    <div className="batchrep-modal-nominee">
                      <div className="batchrep-modal-nominee-avatar initials">FM</div>
                      <div className="batchrep-modal-nominee-info">
                        <div className="batchrep-modal-nominee-label">Nominee · Batch Representative</div>
                        <div className="batchrep-modal-nominee-name">Felie Magbanua</div>
                      </div>
                    </div>
                  </div>
                  <div className="batchrep-modal-deadline">
                    🕐 Feedback window closes <span className="deadline-date">March 14, 2026 at 8:00 AM PHT</span>
                    {getDaysUntilBatchRepDeadline() > 0 && (
                      <span className="deadline-countdown"> · {getDaysUntilBatchRepDeadline()} day{getDaysUntilBatchRepDeadline() !== 1 ? 's' : ''} left</span>
                    )}
                  </div>
                  <button
                    className="batchrep-modal-btn"
                    onClick={() => navigate('/batch-rep')}
                  >
                    Submit My Response →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}