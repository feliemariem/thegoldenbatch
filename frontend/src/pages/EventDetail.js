import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';
import '../styles/events.css';

export default function EventDetail() {
  const { id } = useParams();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.isAdmin;

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvent();
  }, [id, token]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
      } else if (res.status === 404) {
        setError('Event not found');
      } else {
        setError('Failed to load event');
      }
    } catch (err) {
      console.error('Failed to fetch event');
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRsvp = async (status) => {
    try {
      if (event.user_rsvp === status) {
        await fetch(`https://the-golden-batch-api.onrender.com/api/events/${id}/rsvp`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await fetch(`https://the-golden-batch-api.onrender.com/api/events/${id}/rsvp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status })
        });
      }
      fetchEvent();
    } catch (err) {
      console.error('Failed to update RSVP');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this event? All RSVPs will be lost.')) return;

    try {
      await fetch(`https://the-golden-batch-api.onrender.com/api/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/events');
    } catch (err) {
      console.error('Failed to delete event');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return { day: '?', month: '???', year: '????', full: 'Date TBD' };

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

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading event...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
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
              <Link to="/funds" className="nav-link">Funds</Link>
              <Link to="/inbox" className="nav-link">Inbox</Link>
              <Link to="/profile" className="nav-link">Profile</Link>
              {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
              <ThemeToggle />
              <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
            </nav>
          </div>
        </header>
        <main className="profile-main">
          <div className="no-events">
            <p>{error}</p>
            <Link to="/events" className="btn-link">Back to Events</Link>
          </div>
        </main>
      </div>
    );
  }

  const date = formatDate(event.event_date);
  const goingAttendees = event.attendees?.filter(a => a.status === 'going') || [];
  const interestedAttendees = event.attendees?.filter(a => a.status === 'interested') || [];

  return (
    <div className="profile-container">
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
            <Link to="/funds" className="nav-link">Funds</Link>
            <Link to="/inbox" className="nav-link">Inbox</Link>
            <Link to="/profile" className="nav-link">Profile</Link>
            {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
            <ThemeToggle />
            <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
          </nav>
        </div>
      </header>

      <main className="profile-main">
        <div className="events-back" style={{ marginBottom: '1rem' }}>
          <Link to="/events" className="btn-link">&larr; Back to Events</Link>
        </div>

        <div className={`event-detail-card ${event.type}`}>
          <div className="event-detail-header">
            <div className="event-date-block large">
              <span className="event-day">{date.day}</span>
              <span className="event-month">{date.month}</span>
              <span className="event-year">{date.year}</span>
            </div>
            <div className="event-detail-title-section">
              <span className={`event-type-badge ${event.type}`}>
                {getEventTypeLabel(event.type)}
              </span>
              <h2 className="event-detail-title">{event.title}</h2>
              <p className="event-detail-date">{date.full}</p>
            </div>
          </div>

          <div className="event-detail-body">
            {event.event_time && (
              <div className="event-detail-info">
                <span className="event-detail-icon">&#128336;</span>
                <span>{event.event_time}</span>
              </div>
            )}
            {event.location && (
              <div className="event-detail-info">
                <span className="event-detail-icon">&#128205;</span>
                <span>{event.location}</span>
              </div>
            )}
            {event.description && (
              <div className="event-detail-description">
                <p>{event.description}</p>
              </div>
            )}
          </div>

          <div className="event-detail-stats">
            <div className="event-stat-box going">
              <span className="stat-number">{event.going_count || 0}</span>
              <span className="stat-label">Going</span>
            </div>
            <div className="event-stat-box interested">
              <span className="stat-number">{event.interested_count || 0}</span>
              <span className="stat-label">Interested</span>
            </div>
          </div>

          <div className="event-detail-rsvp">
            <p className="rsvp-prompt">Will you be attending?</p>
            <div className="event-actions large">
              <button
                className={`btn-event-rsvp going ${event.user_rsvp === 'going' ? 'active' : ''}`}
                onClick={() => handleRsvp('going')}
              >
                {event.user_rsvp === 'going' ? '\u2713 ' : ''}Going
              </button>
              <button
                className={`btn-event-rsvp interested ${event.user_rsvp === 'interested' ? 'active' : ''}`}
                onClick={() => handleRsvp('interested')}
              >
                {event.user_rsvp === 'interested' ? '\u2713 ' : ''}Interested
              </button>
            </div>
          </div>

          {goingAttendees.length > 0 && (
            <div className="event-detail-attendees">
              <h4>Going ({goingAttendees.length})</h4>
              <div className="attendees-list-detail">
                {goingAttendees.map(a => (
                  <span key={a.user_id} className="attendee-chip going">
                    {a.first_name} {a.last_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {interestedAttendees.length > 0 && (
            <div className="event-detail-attendees">
              <h4>Interested ({interestedAttendees.length})</h4>
              <div className="attendees-list-detail">
                {interestedAttendees.map(a => (
                  <span key={a.user_id} className="attendee-chip interested">
                    {a.first_name} {a.last_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="event-detail-admin">
              <Link to={`/events?edit=${event.id}`} className="btn-admin edit">
                Edit Event
              </Link>
              <button onClick={handleDelete} className="btn-admin delete">
                Delete Event
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
