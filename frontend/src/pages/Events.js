import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';
import '../styles/events.css';

export default function Events() {
  const { user, token, logout } = useAuth();
  const { unreadCount } = useInbox();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.isAdmin;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainEventStats, setMainEventStats] = useState({ going: 0, maybe: 0, not_going: 0 });
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const eventsDropdownRef = useRef(null);

  // Admin form state
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_date: '',
    event_time: '',
    location: '',
    type: 'in-person',
    is_published: true,
    send_announcement: false
  });

  useEffect(() => {
    fetchMainEventStats();
  }, [token]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eventsDropdownRef.current && !eventsDropdownRef.current.contains(event.target)) {
        setEventsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [token, showPastEvents]);

  const fetchEvents = async () => {
    try {
      const url = showPastEvents
        ? 'https://the-golden-batch-api.onrender.com/api/events?includePast=true'
        : 'https://the-golden-batch-api.onrender.com/api/events';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if an event is in the past
  const isPastEvent = (eventDate) => {
    if (!eventDate) return false;
    const dateOnly = eventDate.split('T')[0];
    const eventDateObj = new Date(dateOnly + 'T23:59:59');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDateObj < today;
  };

  const fetchMainEventStats = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMainEventStats({
          going: data.stats?.going || 0,
          maybe: data.stats?.maybe || 0,
          not_going: data.stats?.not_going || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch main event stats');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // RSVP handlers
  const handleRsvp = async (eventId, status) => {
    try {
      const event = events.find(e => e.id === eventId);

      // If clicking the same status, remove RSVP
      if (event.user_rsvp === status) {
        await fetch(`https://the-golden-batch-api.onrender.com/api/events/${eventId}/rsvp`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await fetch(`https://the-golden-batch-api.onrender.com/api/events/${eventId}/rsvp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status })
        });
      }

      fetchEvents();
    } catch (err) {
      console.error('Failed to update RSVP');
    }
  };

  // Admin handlers
  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      event_date: '',
      event_time: '',
      location: '',
      type: 'in-person',
      is_published: true,
      send_announcement: false
    });
    setEditingEvent(null);
    setShowForm(false);
  };

  const handleEdit = (event) => {
    setForm({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date?.split('T')[0] || '',
      event_time: event.event_time || '',
      location: event.location || '',
      type: event.type || 'in-person',
      is_published: event.is_published
    });
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingEvent
        ? `https://the-golden-batch-api.onrender.com/api/events/${editingEvent.id}`
        : 'https://the-golden-batch-api.onrender.com/api/events';

      const res = await fetch(url, {
        method: editingEvent ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        const savedEvent = await res.json();
        resetForm();
        // Navigate to the specific event page after creation
        if (!editingEvent && savedEvent?.id) {
          navigate(`/events/${savedEvent.id}`);
        } else {
          fetchEvents();
        }
      }
    } catch (err) {
      console.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Delete this event? All RSVPs will be lost.')) return;

    try {
      await fetch(`https://the-golden-batch-api.onrender.com/api/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEvents();
    } catch (err) {
      console.error('Failed to delete event');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return { day: '?', month: '???', year: '????', full: 'Date TBD' };

    // Handle both "2026-03-15" and "2026-03-15T00:00:00.000Z" formats
    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');

    if (isNaN(date.getTime())) {
      return { day: '?', month: '???', year: '????', full: 'Invalid Date' };
    }

    return {
      day: date.getDate(),
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      year: date.getFullYear(),
      full: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    };
  };

  const getEventTypeLabel = (type) => {
    switch(type) {
      case 'virtual': return 'Virtual';
      case 'in-person': return 'In-Person';
      default: return type;
    }
  };

  // Separate main event from pre-reunion events
  const preReunionEvents = events.filter(e => !e.is_main_event);

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="card">
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
              <div className={`nav-dropdown ${eventsDropdownOpen ? 'open' : ''}`} ref={eventsDropdownRef}>
                <button
                  className={`nav-dropdown-trigger ${location.pathname === '/events' || location.pathname === '/media' ? 'active' : ''} ${eventsDropdownOpen ? 'open' : ''}`}
                  onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
              >
                Events <span className="dropdown-arrow">▼</span>
              </button>
              <div className="nav-dropdown-menu">
                <Link to="/events" className={`nav-dropdown-item ${location.pathname === '/events' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Upcoming</Link>
                <Link to="/media" className={`nav-dropdown-item ${location.pathname === '/media' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Media</Link>
              </div>
            </div>
            {user?.isAdmin && <Link to="/committee" className="nav-link">Committee</Link>}
            {user?.isAdmin && <Link to="/directory" className="nav-link">Directory</Link>}
            <Link to="/funds" className="nav-link">Funds</Link>
            <Link to="/inbox" className="nav-link">Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</Link>
            <Link to={user?.isAdmin ? "/profile-preview" : "/profile"} className="nav-link">Profile</Link>
            {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
            <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
          </nav>
        </div>
      </header>

      <main className="profile-main">
        {/* Page Header */}
        <section className="events-header">
          <h2>{showPastEvents ? 'All Events' : 'Upcoming Events'}</h2>
          <p>Pre-reunion gatherings and meetups leading up to our 25th homecoming</p>
          <button
            className={`btn-show-past ${showPastEvents ? 'active' : ''}`}
            onClick={() => setShowPastEvents(!showPastEvents)}
          >
            {showPastEvents ? 'Hide Past Events' : 'Show Past Events'}
          </button>
        </section>

        {/* Main Event Highlight */}
        <div className="main-event-card">
          <div className="main-event-badge">Main Event</div>
          <div className="main-event-content">
            <div className="event-date-block main">
              <span className="event-day">16</span>
              <span className="event-month">DEC</span>
              <span className="event-year">2028</span>
            </div>
            <div className="main-event-info">
              <h3>25th Alumni Homecoming</h3>
              <p className="event-datetime">Saturday, December 16, 2028 • 5:00 PM</p>
              <p className="event-location-text">📍 USLS School Grounds, Bacolod City</p>
              <p className="event-description">The main event! 25 years since graduation. Let's make it unforgettable.</p>
              <div className="main-event-rsvp-stats">
                <span className="rsvp-stat going">{mainEventStats.going} Going</span>
                <span className="rsvp-stat maybe">{mainEventStats.maybe} Maybe</span>
                <span className="rsvp-stat not-going">{mainEventStats.not_going} Can't Make It</span>
              </div>
              <p className="rsvp-note">Update your RSVP on your <Link to={user?.isAdmin ? "/profile-preview" : "/profile"}>Profile</Link></p>
            </div>
          </div>
        </div>

        {/* Admin: Create Event Button/Form */}
        {isAdmin && (
          <div className="admin-events-section">
            {!showForm ? (
              <button onClick={() => setShowForm(true)} className="btn-create-event">
                + Create Event
              </button>
            ) : (
              <div className="event-form-card">
                <h3>{editingEvent ? 'Edit Event' : 'Create New Event'}</h3>
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Event Title *</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="e.g., Manila Mini-Reunion"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Type</label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                      >
                        <option value="in-person">In-Person</option>
                        <option value="virtual">Virtual</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={form.event_date}
                        onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Time</label>
                      <input
                        type="text"
                        value={form.event_time}
                        onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                        placeholder="e.g., 7:00 PM"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="e.g., L'Fisher Hotel, Bacolod City"
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Tell people what this event is about..."
                      rows={3}
                    />
                  </div>

                  <div className="form-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.is_published}
                        onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                      />
                      Published (visible to all users)
                    </label>
                  </div>

                  {/* Send Announcement Toggle - only for new events */}
                  {!editingEvent && (
                    <div className="announcement-toggle-section">
                      <div className="announcement-toggle">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={form.send_announcement}
                            onChange={(e) => setForm({ ...form, send_announcement: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <div className="toggle-label">
                          <span className="toggle-title">📢 Notify Everyone</span>
                          <span className="toggle-desc">Send email & inbox announcement to all registered users</span>
                        </div>
                      </div>

                      {/* Preview */}
                      {form.send_announcement && form.title && (
                        <div className="announcement-preview">
                          <p className="preview-label">Preview</p>
                          <div className="preview-card">
                            <p className="preview-subject">🎉 New Event: {form.title}</p>
                            <div className="preview-body">
                              <p><strong>{form.title}</strong></p>
                              {form.event_date && <p>📅 {new Date(form.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{form.event_time && ` • ${form.event_time}`}</p>}
                              {form.location && <p>📍 {form.location}</p>}
                              {form.description && <p>{form.description}</p>}
                              <p className="preview-cta">Check it out and let us know if you're going!</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-actions">
                    <button type="submit" className="btn-save" disabled={saving}>
                      {saving ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
                    </button>
                    <button type="button" onClick={resetForm} className="btn-cancel">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Pre-Reunion Events */}
        <section className="events-section">
          <h3 className="section-title">Pre-Reunion Gatherings</h3>
          <p className="section-subtitle">Connect with batchmates before the big day</p>

          {preReunionEvents.length > 0 ? (
            <div className="events-grid">
              {preReunionEvents.map(event => {
                const date = formatDate(event.event_date);
                const goingAttendees = event.attendees?.filter(a => a.status === 'going') || [];
                const interestedAttendees = event.attendees?.filter(a => a.status === 'interested') || [];
                const eventIsPast = isPastEvent(event.event_date);

                return (
                  <div key={event.id} className={`event-card ${event.type} ${eventIsPast ? 'past' : ''}`}>
                    {eventIsPast && <div className="past-event-badge">Past Event</div>}
                    <div className="event-card-header">
                      <div className={`event-date-block ${eventIsPast ? 'past' : ''}`}>
                        <span className="event-day">{date.day}</span>
                        <span className="event-month">{date.month}</span>
                        <span className="event-year">{date.year}</span>
                      </div>
                      <span className={`event-type-badge ${event.type}`}>
                        {getEventTypeLabel(event.type)}
                      </span>
                    </div>

                    <div className="event-card-body">
                      <h4 className="event-title">{event.title}</h4>
                      {event.event_time && <p className="event-time">🕐 {event.event_time}</p>}
                      {event.location && <p className="event-location-text">📍 {event.location}</p>}
                      {event.description && <p className="event-description">{event.description}</p>}

                      {/* Attendees List */}
                      {goingAttendees.length > 0 && (
                        <div className="attendees-section">
                          <p className="attendees-label">Going:</p>
                          <div className="attendees-list">
                            {goingAttendees.slice(0, 5).map(a => (
                              <span key={a.user_id} className="attendee-name">{a.first_name}</span>
                            ))}
                            {goingAttendees.length > 5 && (
                              <span className="attendee-more">+{goingAttendees.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {interestedAttendees.length > 0 && (
                        <div className="attendees-section">
                          <p className="attendees-label">Interested:</p>
                          <div className="attendees-list">
                            {interestedAttendees.slice(0, 5).map(a => (
                              <span key={a.user_id} className="attendee-name">{a.first_name}</span>
                            ))}
                            {interestedAttendees.length > 5 && (
                              <span className="attendee-more">+{interestedAttendees.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="event-card-footer">
                      <div className="event-stats">
                        <span className="stat-item going">{event.going_count} going</span>
                        <span className="stat-item interested">{event.interested_count} interested</span>
                      </div>
                      <div className="event-actions">
                        <button
                          className={`btn-event-rsvp small going ${event.user_rsvp === 'going' ? 'active' : ''}`}
                          onClick={() => handleRsvp(event.id, 'going')}
                        >
                          {event.user_rsvp === 'going' ? '✓' : ''} Going
                        </button>
                        <button
                          className={`btn-event-rsvp small interested ${event.user_rsvp === 'interested' ? 'active' : ''}`}
                          onClick={() => handleRsvp(event.id, 'interested')}
                        >
                          {event.user_rsvp === 'interested' ? '✓' : ''} Interested
                        </button>
                      </div>
                    </div>

                    {/* Admin Edit/Delete */}
                    {isAdmin && (
                      <div className="event-admin-actions">
                        <button onClick={() => handleEdit(event)} className="btn-link">Edit</button>
                        <span style={{ color: '#555' }}>|</span>
                        <button onClick={() => handleDelete(event.id)} className="btn-link delete">Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-events">
              <p>{showPastEvents ? 'No events found.' : 'No upcoming events yet.'}</p>
              {isAdmin && !showPastEvents && <p>Click "Create Event" to add one!</p>}
              {!showPastEvents && (
                <button
                  className="btn-link"
                  onClick={() => setShowPastEvents(true)}
                  style={{ marginTop: '12px' }}
                >
                  View past events
                </button>
              )}
            </div>
          )}
        </section>

        {/* Info Note */}
        <div className="events-note">
          <p>
            <strong>Note:</strong> Event details may change. Check back for updates or watch your inbox for announcements.
          </p>
        </div>

        {/* Back Link */}
        <div className="events-back">
          <Link to={user?.isAdmin ? "/profile-preview" : "/profile"} className="btn-link">← Back to Profile</Link>
        </div>

      </main>
      </div>
      <Footer />
    </div>
  );
}
