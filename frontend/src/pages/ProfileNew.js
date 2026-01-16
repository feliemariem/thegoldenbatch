import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';

export default function ProfileNew() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myEvents, setMyEvents] = useState([]);
  const fileInputRef = useRef(null);

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
  });

  // Feature flag for new pages (Events, Directory, etc.)
  const showNewPages = process.env.REACT_APP_NEW_FEATURES === 'true';

  useEffect(() => {
    fetchProfile();
    fetchUnreadCount();
    fetchMyEvents();
  }, [token]);

  const fetchMyEvents = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/events/my-rsvps', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyEvents(data);
      }
    } catch (err) {
      console.error('Failed to fetch my events');
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/announcements/inbox', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const unread = (data.announcements || []).filter(a => !a.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to fetch unread count');
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, ...data });
        setEditing(false);
        setMessage('Profile updated!');
        setTimeout(() => setMessage(''), 3000);
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
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/me/rsvp', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setProfile({ ...profile, rsvp_status: status });
        setMessage('RSVP updated!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to update RSVP');
    } finally {
      setRsvpSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image must be less than 5MB');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/me/photo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, profile_photo: data.profile_photo });
        setMessage('Photo uploaded!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to upload photo');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to upload photo');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/me/photo', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setProfile({ ...profile, profile_photo: null });
        setMessage('Photo removed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to remove photo');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  const paymentProgress = profile.amount_due > 0 
    ? Math.min((profile.total_paid / profile.amount_due) * 100, 100) 
    : 0;
  
  const paymentStatus = profile.total_paid >= profile.amount_due 
    ? 'Full' 
    : profile.total_paid > 0 
      ? 'Partial' 
      : 'Unpaid';

  return (
    <div className="profile-container">
      {/* Header */}
      <header className="profile-header">
        <div className="profile-header-content">
          <div className="profile-logo-section">
            <img src={logo} alt="USLS Logo" className="profile-logo" />
            <div className="profile-title">
              <h1>THE GOLDEN BATCH</h1>
              <span className="profile-subtitle">25th Alumni Homecoming</span>
            </div>
          </div>
          <nav className="profile-nav">
            <Link to="/events" className="nav-link">Events</Link>
            {showNewPages && (
              <>
                <Link to="/directory" className="nav-link">Directory</Link>
                <Link to="/media" className="nav-link">Media</Link>
              </>
            )}
            <Link to="/funds" className="nav-link">Funds</Link>
            <Link to="/inbox" className="nav-link nav-link-badge">
              Inbox
              {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
            </Link>
            <Link to="/profile" className="nav-link">Profile</Link>
            {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
            <ThemeToggle />
            <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
          </nav>
        </div>
      </header>

      <main className="profile-main">
        {/* Welcome Banner */}
        <section className="profile-welcome">
          <div className="welcome-content">
            <h2>Welcome back, {profile.first_name}!</h2>
            <p>Thank you for registering for our 25th Alumni Homecoming</p>
          </div>
        </section>

        {message && (
          <div className="profile-message success">
            {message}
          </div>
        )}

        <div className="profile-grid">
          {/* Left Column */}
          <div className="profile-left">
            {/* RSVP Card */}
            <div className="profile-card rsvp-card">
              <div className="card-header">
                <h3>Main Event</h3>
              </div>
              <div className="event-details">
                <div className="event-date">
                  <span className="event-day">16</span>
                  <span className="event-month">DEC</span>
                  <span className="event-year">2028</span>
                </div>
                <div className="event-info">
                  <p className="event-name">25th Alumni Homecoming</p>
                  <p className="event-location">USLS School Grounds, Bacolod City</p>
                </div>
              </div>
              <div className="rsvp-section">
                <p className="rsvp-label">Are you attending?</p>
                <div className="rsvp-buttons">
                  <button
                    className={`btn-rsvp ${profile.rsvp_status === 'going' ? 'active going' : ''}`}
                    onClick={() => handleRsvp('going')}
                    disabled={rsvpSaving}
                  >
                    Going
                  </button>
                  <button
                    className={`btn-rsvp ${profile.rsvp_status === 'maybe' ? 'active maybe' : ''}`}
                    onClick={() => handleRsvp('maybe')}
                    disabled={rsvpSaving}
                  >
                    Maybe
                  </button>
                  <button
                    className={`btn-rsvp ${profile.rsvp_status === 'not_going' ? 'active not-going' : ''}`}
                    onClick={() => handleRsvp('not_going')}
                    disabled={rsvpSaving}
                  >
                    Can't Make It
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Status Card - Graduates Only */}
            {profile.is_graduate ? (
              <div className="profile-card payment-card">
                <div className="card-header">
                  <h3>Payment Status</h3>
                  <span className={`payment-badge ${paymentStatus.toLowerCase()}`}>
                    {paymentStatus}
                  </span>
                </div>
                <div className="payment-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${paymentProgress}%` }}
                    ></div>
                  </div>
                  <div className="payment-amounts">
                    <span className="paid">₱{profile.total_paid?.toLocaleString() || 0}</span>
                    <span className="total">/ ₱{profile.amount_due?.toLocaleString()}</span>
                  </div>
                </div>
                {paymentStatus !== 'Full' && (
                  <div className="payment-remaining">
                    <p>Remaining balance: <strong>₱{((profile.amount_due || 0) - (profile.total_paid || 0)).toLocaleString()}</strong></p>
                    <Link to="/funds" className="payment-link">View Payment Details</Link>
                  </div>
                )}
                {paymentStatus === 'Full' && (
                  <div className="payment-complete">
                    <span className="checkmark">✓</span>
                    <p>You're all set! Thank you for your payment.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="profile-card donate-card">
                <div className="card-header">
                  <h3>Support the Batch</h3>
                </div>
                <p className="donate-text">
                  Help make our reunion memorable! Your contributions go towards venue, food, and activities.
                </p>
                <Link to="/funds" className="btn-donate">
                  View Fund Details
                </Link>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="profile-right">
            {/* Your Information Card */}
            <div className="profile-card info-card">
              <div className="card-header">
                <h3>Your Information</h3>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="btn-edit">
                    Edit
                  </button>
                )}
              </div>

              {/* Profile Photo Section */}
              <div className="profile-photo-section">
                <div className="profile-photo-container">
                  {profile.profile_photo ? (
                    <img 
                      src={profile.profile_photo} 
                      alt={`${profile.first_name}'s photo`}
                      className="profile-photo-img"
                    />
                  ) : (
                    <div className="profile-photo-initials">
                      {profile.first_name?.charAt(0)}{profile.last_name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="profile-photo-actions">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    id="photo-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-photo-upload"
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? 'Uploading...' : profile.profile_photo ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {profile.profile_photo && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="btn-photo-remove"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {editing ? (
                <form onSubmit={handleSave} className="edit-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        name="first_name"
                        value={form.first_name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        name="last_name"
                        value={form.last_name}
                        onChange={handleChange}
                        required
                      />
                    </div>
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
                    <div className="form-group full-width">
                      <label>Address</label>
                      <input
                        type="text"
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        name="city"
                        value={form.city}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Country</label>
                      <input
                        type="text"
                        name="country"
                        value={form.country}
                        onChange={handleChange}
                        required
                      />
                    </div>
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
                  <div className="form-actions">
                    <button type="submit" className="btn-save" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="btn-cancel">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="info-display">
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Name</span>
                      <span className="info-value">{profile.first_name} {profile.last_name}</span>
                    </div>
                    {profile.nickname && (
                      <div className="info-item">
                        <span className="info-label">Nickname</span>
                        <span className="info-value">{profile.nickname}</span>
                      </div>
                    )}
                    {profile.section && (
                      <div className="info-item">
                        <span className="info-label">Section</span>
                        <span className="info-value">{profile.section}</span>
                      </div>
                    )}
                    <div className="info-item">
                      <span className="info-label">Email</span>
                      <span className="info-value">{profile.email}</span>
                    </div>
                    {profile.birthday && (
                      <div className="info-item">
                        <span className="info-label">Birthday</span>
                        <span className="info-value">{new Date(profile.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    )}
                    {profile.mobile && (
                      <div className="info-item">
                        <span className="info-label">Mobile</span>
                        <span className="info-value">{profile.mobile}</span>
                      </div>
                    )}
                    {profile.address && (
                      <div className="info-item full-width">
                        <span className="info-label">Address</span>
                        <span className="info-value">{profile.address}</span>
                      </div>
                    )}
                    <div className="info-item">
                      <span className="info-label">Location</span>
                      <span className="info-value">{profile.city}, {profile.country}</span>
                    </div>
                    {profile.occupation && (
                      <div className="info-item">
                        <span className="info-label">Occupation</span>
                        <span className="info-value">{profile.occupation}</span>
                      </div>
                    )}
                    {profile.company && (
                      <div className="info-item">
                        <span className="info-label">Company</span>
                        <span className="info-value">{profile.company}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Your Upcoming Events */}
            {myEvents.length > 0 && (
              <div className="profile-card my-events-card">
                <div className="card-header">
                  <h3>Your Upcoming Events</h3>
                  <Link to="/events" className="btn-link">View All</Link>
                </div>
                <div className="my-events-list">
                  {myEvents.map(event => (
                    <div key={event.id} className="my-event-item">
                      <div className="my-event-date">
                        <span className="my-event-day">{new Date(event.event_date + 'T00:00:00').getDate()}</span>
                        <span className="my-event-month">{new Date(event.event_date + 'T00:00:00').toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                      </div>
                      <div className="my-event-info">
                        <p className="my-event-title">{event.title}</p>
                        <p className="my-event-location">{event.location || 'Location TBD'}</p>
                      </div>
                      <span className={`my-event-status ${event.status}`}>
                        {event.status === 'going' ? 'Going' : 'Interested'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Links - only show if other new pages are enabled */}
            {showNewPages && (
              <div className="profile-card quick-links-card">
                <h3>Quick Links</h3>
                <div className="quick-links">
                  <Link to="/events" className="quick-link">
                    <span className="quick-link-icon">📅</span>
                    <span>View Events</span>
                  </Link>
                  <Link to="/directory" className="quick-link">
                    <span className="quick-link-icon">👥</span>
                    <span>Batch Directory</span>
                  </Link>
                  <Link to="/media" className="quick-link">
                    <span className="quick-link-icon">📸</span>
                    <span>View Media</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="profile-footer">
          <p>Stay connected with us!</p>
          <a 
            href="https://www.facebook.com/groups/478382298877930" 
            target="_blank" 
            rel="noopener noreferrer"
            className="fb-link"
          >
            Join our Facebook Group
          </a>
        </footer>
      </main>
    </div>
  );
}