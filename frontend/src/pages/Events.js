import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';
import '../styles/events.css';

export default function Events() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Sample events data - static for now
  const [events, setEvents] = useState([
    {
      id: 1,
      title: 'Pre-Reunion Planning Meeting',
      date: '2026-03-15',
      time: '7:00 PM',
      location: 'Zoom / Online',
      description: 'Join us for our first virtual planning session to discuss ideas and volunteer roles for the big reunion.',
      type: 'virtual',
      rsvp: null, // null = not responded, 'going', 'interested', 'not_going'
      attendees: 12,
      interested: 8
    },
    {
      id: 2,
      title: 'Manila Mini-Reunion',
      date: '2026-06-21',
      time: '6:00 PM',
      location: 'TBD - Makati Area',
      description: 'A casual get-together for batchmates based in Metro Manila. Dinner and drinks!',
      type: 'in-person',
      rsvp: null,
      attendees: 24,
      interested: 15
    },
    {
      id: 3,
      title: 'Bacolod Pre-Reunion Dinner',
      date: '2026-09-14',
      time: '7:00 PM',
      location: 'L\'Fisher Hotel, Bacolod City',
      description: 'For those in Bacolod - let\'s reconnect before the main event! Partners welcome.',
      type: 'in-person',
      rsvp: null,
      attendees: 18,
      interested: 22
    },
    {
      id: 4,
      title: 'US/Canada Virtual Hangout',
      date: '2026-11-08',
      time: '9:00 AM PST / 1:00 AM PHT',
      location: 'Zoom / Online',
      description: 'Time-zone friendly virtual meetup for our batchmates in North America.',
      type: 'virtual',
      rsvp: null,
      attendees: 8,
      interested: 12
    },
    {
      id: 5,
      title: '25th Alumni Homecoming',
      date: '2028-12-16',
      time: '5:00 PM',
      location: 'USLS School Grounds, Bacolod City',
      description: 'The main event! 25 years since graduation. Let\'s make it unforgettable.',
      type: 'main-event',
      rsvp: null,
      attendees: 45,
      interested: 32
    }
  ]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRsvp = (eventId, status) => {
    setEvents(events.map(event => 
      event.id === eventId 
        ? { 
            ...event, 
            rsvp: event.rsvp === status ? null : status,
            attendees: event.rsvp === 'going' && status !== 'going' 
              ? event.attendees - 1 
              : status === 'going' && event.rsvp !== 'going'
                ? event.attendees + 1
                : event.attendees,
            interested: event.rsvp === 'interested' && status !== 'interested'
              ? event.interested - 1
              : status === 'interested' && event.rsvp !== 'interested'
                ? event.interested + 1
                : event.interested
          }
        : event
    ));
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
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
      case 'main-event': return 'Main Event';
      default: return type;
    }
  };

  // Separate main event from pre-reunion events
  const mainEvent = events.find(e => e.type === 'main-event');
  const preReunionEvents = events.filter(e => e.type !== 'main-event');

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
            <Link to="/events" className="nav-link active">Events</Link>
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
        {/* Page Header */}
        <section className="events-header">
          <h2>Upcoming Events</h2>
          <p>Pre-reunion gatherings and meetups leading up to our 25th homecoming</p>
        </section>

        {/* Main Event Highlight */}
        {mainEvent && (
          <div className="main-event-card">
            <div className="main-event-badge">Main Event</div>
            <div className="main-event-content">
              <div className="event-date-block main">
                <span className="event-day">{formatDate(mainEvent.date).day}</span>
                <span className="event-month">{formatDate(mainEvent.date).month}</span>
                <span className="event-year">{formatDate(mainEvent.date).year}</span>
              </div>
              <div className="main-event-info">
                <h3>{mainEvent.title}</h3>
                <p className="event-datetime">{formatDate(mainEvent.date).full} • {mainEvent.time}</p>
                <p className="event-location-text">📍 {mainEvent.location}</p>
                <p className="event-description">{mainEvent.description}</p>
                <div className="event-stats">
                  <span className="stat-item going">{mainEvent.attendees} going</span>
                  <span className="stat-item interested">{mainEvent.interested} interested</span>
                </div>
              </div>
              <div className="main-event-actions">
                <button 
                  className={`btn-event-rsvp going ${mainEvent.rsvp === 'going' ? 'active' : ''}`}
                  onClick={() => handleRsvp(mainEvent.id, 'going')}
                >
                  {mainEvent.rsvp === 'going' ? '✓ Going' : 'Going'}
                </button>
                <button 
                  className={`btn-event-rsvp interested ${mainEvent.rsvp === 'interested' ? 'active' : ''}`}
                  onClick={() => handleRsvp(mainEvent.id, 'interested')}
                >
                  {mainEvent.rsvp === 'interested' ? '✓ Interested' : 'Interested'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pre-Reunion Events */}
        <section className="events-section">
          <h3 className="section-title">Pre-Reunion Gatherings</h3>
          <p className="section-subtitle">Connect with batchmates before the big day</p>
          
          <div className="events-grid">
            {preReunionEvents.map(event => {
              const date = formatDate(event.date);
              return (
                <div key={event.id} className={`event-card ${event.type}`}>
                  <div className="event-card-header">
                    <div className="event-date-block">
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
                    <p className="event-time">🕐 {event.time}</p>
                    <p className="event-location-text">📍 {event.location}</p>
                    <p className="event-description">{event.description}</p>
                  </div>

                  <div className="event-card-footer">
                    <div className="event-stats">
                      <span className="stat-item going">{event.attendees} going</span>
                      <span className="stat-item interested">{event.interested} interested</span>
                    </div>
                    <div className="event-actions">
                      <button 
                        className={`btn-event-rsvp small going ${event.rsvp === 'going' ? 'active' : ''}`}
                        onClick={() => handleRsvp(event.id, 'going')}
                      >
                        {event.rsvp === 'going' ? '✓' : ''} Going
                      </button>
                      <button 
                        className={`btn-event-rsvp small interested ${event.rsvp === 'interested' ? 'active' : ''}`}
                        onClick={() => handleRsvp(event.id, 'interested')}
                      >
                        {event.rsvp === 'interested' ? '✓' : ''} Interested
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Info Note */}
        <div className="events-note">
          <p>
            <strong>Note:</strong> This is a preview of upcoming events. 
            Event details may change. Check back for updates or watch your inbox for announcements.
          </p>
        </div>

        {/* Back Link */}
        <div className="events-back">
          <Link to="/profile" className="btn-link">← Back to Profile</Link>
        </div>
      </main>
    </div>
  );
}