import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaFacebook, FaLinkedin, FaInstagram } from 'react-icons/fa';
import MyTasks from '../components/MyTasks';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SystemAdminProfile from '../components/SystemAdminProfile';
import '../styles/profileNew.css';
import { apiGet, apiPut, apiUpload, apiDelete } from '../api';

export default function ProfileNew() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [myEvents, setMyEvents] = useState([]);
  const [showGuide, setShowGuide] = useState(false);
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
    facebook_url: '',
    linkedin_url: '',
    instagram_url: '',
  });

  // Feature flag for new pages (Events, Directory, etc.)
  const showNewPages = process.env.REACT_APP_NEW_FEATURES === 'true';

  // Helper function to safely format event dates
  const formatEventDate = (dateStr) => {
    if (!dateStr) return { day: '?', month: '???' };

    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');

    if (isNaN(date.getTime())) {
      return { day: '?', month: '???' };
    }

    return {
      day: date.getDate(),
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    };
  };

  // Helper function to format birthday without timezone conversion
  const formatBirthday = (dateStr) => {
    if (!dateStr) return '';
    // Extract just the date portion (YYYY-MM-DD) and parse at local midnight
    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    fetchProfile();
    fetchMyEvents();
    checkSystemAdmin();
  }, [token]);

  // Calculate days remaining until the reunion (Dec 16, 2028)
  const getDaysUntilReunion = () => {
    const reunionDate = new Date('2028-12-16');  // Reunion date
    const today = new Date();                     // Current date
    const diffTime = reunionDate - today;         // Difference in milliseconds
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));  // Convert ms to days
    return diffDays;  // Positive = days left, 0 = today, negative = past
  };

  // Check if current user is System Admin (admin id=1)
  const checkSystemAdmin = async () => {
    try {
      const res = await apiGet('/api/permissions/me');
      if (res.ok) {
        const data = await res.json();
        // System admin is admin id=1
        if (data.is_super_admin && data.admin_id === 1) {
          setIsSystemAdmin(true);
        }
      }
    } catch (err) {
      console.error('Failed to check admin status');
    } finally {
      setCheckingAdmin(false);
    }
  };

  // Scroll to My Tasks section when navigated with scrollToMyTasks state
  useEffect(() => {
    if (location.state?.scrollToMyTasks) {
      // Wait a brief moment for the MyTasks component to render
      const timeout = setTimeout(() => {
        const myTasksSection = document.getElementById('my-tasks-section');
        if (myTasksSection) {
          myTasksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Add a brief highlight effect
          myTasksSection.style.transition = 'box-shadow 0.3s ease';
          myTasksSection.style.boxShadow = '0 0 0 3px rgba(207, 181, 59, 0.5)';
          setTimeout(() => {
            myTasksSection.style.boxShadow = '';
          }, 2000);
        }
      }, 500);
      // Clear the state to prevent re-scrolling on refresh
      window.history.replaceState({}, document.title);
      return () => clearTimeout(timeout);
    }
  }, [location.state]);

  const fetchMyEvents = async () => {
    try {
      const res = await apiGet('/api/events/my-rsvps');
      if (res.ok) {
        const data = await res.json();
        setMyEvents(data);
      }
    } catch (err) {
      console.error('Failed to fetch my events');
    }
  };

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
        facebook_url: data.facebook_url || '',
        linkedin_url: data.linkedin_url || '',
        instagram_url: data.instagram_url || '',
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
      const res = await apiPut('/api/me/rsvp', { status });

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
      const res = await apiUpload('/api/me/photo', formData);

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
      const res = await apiDelete('/api/me/photo');

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

  if (!profile || checkingAdmin) {
    return (
      <div className="container admin-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Show System Administrator view for admin id=1
  if (isSystemAdmin) {
    return <SystemAdminProfile />;
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
    <div className="container admin-container">
      <Navbar />
      <div className="card">
        <main className="profile-main">
          {/* Welcome Banner */}
          <section className="profile-welcome">
            <div className="welcome-content">
              <div className="welcome-header-row">
                <div>
                  <h2>Welcome back, {profile.first_name}!</h2>
                  <p>Thank you for registering for our 25th Alumni Homecoming</p>
                </div>
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="btn-guide"
                >
                  {showGuide ? 'Hide' : '📖 Guide'}
                </button>
              </div>
            </div>
          </section>

          {/* User Guide */}
          {showGuide && (
            <div className="user-guide-section">
              <h3 className="guide-title">Welcome to The Golden Batch!</h3>

              <div className="guide-content">
                <div className="guide-item">
                  <h4>Your Profile:</h4>
                  <ul>
                    <li>Update your personal information and upload a profile photo</li>
                    <li>Your info helps batchmates reconnect with you</li>
                  </ul>
                </div>

                <div className="guide-item">
                  <h4>RSVP:</h4>
                  <ul>
                    <li>Let us know if you're attending the 25th Alumni Homecoming</li>
                    <li>You can change your RSVP anytime</li>
                  </ul>
                </div>

                {profile.is_graduate && (
                  <div className="guide-item">
                    <h4>Payment Status:</h4>
                    <ul>
                      <li>Track your contribution progress</li>
                      <li>View payment details in the Funds page</li>
                    </ul>
                  </div>
                )}

                <div className="guide-item">
                  <h4>Events:</h4>
                  <ul>
                    <li>Browse upcoming batch events and activities</li>
                    <li>RSVP to events you want to attend</li>
                  </ul>
                </div>

                <div className="guide-item">
                  <h4>Media:</h4>
                  <ul>
                    <li>View photos and videos from past reunions and high school days</li>
                    <li>Watch featured hype videos and podcast episodes</li>
                    <li>Read batch news and spotlight interviews</li>
                    <li>Browse the gallery for throwback memories</li>
                  </ul>
                </div>

                <div className="guide-item">
                  <h4>Funds:</h4>
                  <ul>
                    <li>View the batch's fundraising progress</li>
                    <li>See contribution history and how funds are being used</li>
                  </ul>
                </div>

                <div className="guide-item">
                  <h4>Inbox:</h4>
                  <ul>
                    <li>Receive announcements from the committee</li>
                    <li>Reply to the committee directly from your inbox</li>
                    <li>Send suggestions or feedback to the organizers</li>
                  </ul>
                </div>

                <div className="guide-item">
                  <h4>Committee:</h4>
                  <ul>
                    <li>See who's organizing the reunion</li>
                    <li>Volunteer to help out</li>
                  </ul>
                </div>

                <div className="guide-tip">
                  <span className="tip-icon">💡</span>
                  <strong>Tip:</strong> Have questions or suggestions? Go to your Inbox and click "Contact Committee" to reach the organizers!
                </div>
              </div>
            </div>
          )}

          {message && (
            <div className="profile-message success">
              {message}
            </div>
          )}

          {/* My Tasks Section - Only shows for admins */}
          {user?.isAdmin && <MyTasks token={token} />}

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

                <div className="countdown-box">
                  {getDaysUntilReunion() > 0 ? (
                    <>
                      <span className="countdown-days">{getDaysUntilReunion()}</span>
                      <span className="countdown-label">Days Left!</span>
                    </>
                  ) : getDaysUntilReunion() === 0 ? (
                    <span className="countdown-label countdown-today">Today is the day!</span>
                  ) : (
                    <span className="countdown-label countdown-passed">The reunion has happened!</span>
                  )}
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
                      <div className="form-group full-width social-media-section">
                        <label className="social-media-label">Social Media</label>
                        <div className="social-media-inputs">
                          <div className="social-input-group">
                            <label>Facebook username</label>
                            <input
                              type="text"
                              name="facebook_url"
                              value={form.facebook_url}
                              onChange={handleChange}
                              placeholder="yourname"
                            />
                          </div>
                          <div className="social-input-group">
                            <label>LinkedIn username</label>
                            <input
                              type="text"
                              name="linkedin_url"
                              value={form.linkedin_url}
                              onChange={handleChange}
                              placeholder="yourname"
                            />
                          </div>
                          <div className="social-input-group">
                            <label>Instagram handle</label>
                            <input
                              type="text"
                              name="instagram_url"
                              value={form.instagram_url}
                              onChange={handleChange}
                              placeholder="yourname"
                            />
                          </div>
                        </div>
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
                      {(profile.first_name || profile.last_name) && (
                        <div className="info-item">
                          <span className="info-label">Name</span>
                          <span className="info-value">{profile.first_name} {profile.last_name}</span>
                        </div>
                      )}
                      {profile.email && (
                        <div className="info-item">
                          <span className="info-label">Email</span>
                          <span className="info-value">{profile.email}</span>
                        </div>
                      )}
                      {profile.birthday && (
                        <div className="info-item">
                          <span className="info-label">Birthday</span>
                          <span className="info-value">{formatBirthday(profile.birthday)}</span>
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
                      {(profile.city || profile.country) && (
                        <div className="info-item">
                          <span className="info-label">Location</span>
                          <span className="info-value">
                            {profile.city && profile.country
                              ? `${profile.city}, ${profile.country}`
                              : profile.city || profile.country}
                          </span>
                        </div>
                      )}
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
                    {(profile.facebook_url || profile.linkedin_url || profile.instagram_url) && (
                      <div className="social-icons-row">
                        {profile.facebook_url && (
                          <a
                            href={`https://facebook.com/${profile.facebook_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-icon-link facebook"
                            title="Facebook"
                          >
                            <FaFacebook />
                          </a>
                        )}
                        {profile.linkedin_url && (
                          <a
                            href={`https://linkedin.com/in/${profile.linkedin_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-icon-link linkedin"
                            title="LinkedIn"
                          >
                            <FaLinkedin />
                          </a>
                        )}
                        {profile.instagram_url && (
                          <a
                            href={`https://instagram.com/${profile.instagram_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-icon-link instagram"
                            title="Instagram"
                          >
                            <FaInstagram />
                          </a>
                        )}
                      </div>
                    )}
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
                          <span className="my-event-day">{formatEventDate(event.event_date).day}</span>
                          <span className="my-event-month">{formatEventDate(event.event_date).month}</span>
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

              {/* Quick Links - only show if other new pages are enabled or user is admin */}
              {(showNewPages || user?.isAdmin) && (
                <div className="profile-card quick-links-card">
                  <h3>Quick Links</h3>
                  <div className="quick-links">
                    <Link to="/events" className="quick-link">
                      <span className="quick-link-icon">📅</span>
                      <span>View Events</span>
                    </Link>
                    {showNewPages && (
                      <Link to="/directory" className="quick-link">
                        <span className="quick-link-icon">👥</span>
                        <span>Batch Directory</span>
                      </Link>
                    )}
                    {user?.isAdmin && (
                      <Link to="/media" className="quick-link">
                        <span className="quick-link-icon">📸</span>
                        <span>Media Gallery</span>
                      </Link>
                    )}
                    {user?.isAdmin && (
                      <Link to="/committee" className="quick-link">
                        <span className="quick-link-icon">👔</span>
                        <span>Committee</span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
      <Footer />
    </div>
  );
}