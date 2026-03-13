import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getDaysUntilReunion } from '../utils/profileUtils';

// Generate .ics file for Apple Calendar
const downloadICS = (setCalendarDropdownOpen) => {
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//USLS-IS Batch 2003//EN
BEGIN:VEVENT
DTSTART:20281216T090000
DTEND:20281217T000000
SUMMARY:USLS-IS Batch 2003 - 25th Alumni Homecoming
LOCATION:Santuario de La Salle, USLS, Bacolod City
DESCRIPTION:25th Alumni Homecoming of USLS-IS Batch 2003. The Golden Batch.
END:VEVENT
END:VCALENDAR`;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'USLS-IS-2003-Reunion.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  setCalendarDropdownOpen(false);
};

export default function RSVPCard({ profile, rsvpSaving, onRsvp }) {
  const [calendarDropdownOpen, setCalendarDropdownOpen] = useState(false);
  const calendarDropdownRef = useRef(null);

  // Close calendar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(event.target)) {
        setCalendarDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
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
          <p className="event-location">Santuario de La Salle, USLS, Bacolod City</p>
          <div className="calendar-dropdown" ref={calendarDropdownRef}>
            <button
              className="calendar-dropdown-btn"
              onClick={() => setCalendarDropdownOpen(!calendarDropdownOpen)}
            >
              📅 Add to Calendar <span className={`dropdown-arrow ${calendarDropdownOpen ? 'open' : ''}`}>▼</span>
            </button>
            {calendarDropdownOpen && (
              <div className="calendar-dropdown-menu">
                <a
                  href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=USLS-IS+Batch+2003+25th+Alumni+Homecoming&dates=20281216T090000/20281217T000000&location=Santuario+de+La+Salle,+USLS,+Bacolod+City&details=25th+Alumni+Homecoming+of+USLS-IS+Batch+2003.+The+Golden+Batch."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="calendar-option"
                  onClick={() => setCalendarDropdownOpen(false)}
                >
                  Google Calendar
                </a>
                <button className="calendar-option" onClick={() => downloadICS(setCalendarDropdownOpen)}>
                  Apple Calendar
                </button>
                <a
                  href="https://outlook.live.com/calendar/0/action/compose?subject=USLS-IS+Batch+2003+25th+Alumni+Homecoming&startdt=2028-12-16T09:00:00&enddt=2028-12-17T00:00:00&location=Santuario+de+La+Salle,+USLS,+Bacolod+City&body=25th+Alumni+Homecoming+of+USLS-IS+Batch+2003.+The+Golden+Batch."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="calendar-option"
                  onClick={() => setCalendarDropdownOpen(false)}
                >
                  Outlook
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="rsvp-label">Update RSVP</p>
      <div className="rsvp-row">
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
        <div className="rsvp-buttons">
          <button
            className={`btn-rsvp ${profile.rsvp_status === 'going' ? 'active going' : ''}`}
            onClick={() => onRsvp('going')}
            disabled={rsvpSaving}
          >
            Going
          </button>
          <button
            className={`btn-rsvp ${profile.rsvp_status === 'maybe' ? 'active maybe' : ''}`}
            onClick={() => onRsvp('maybe')}
            disabled={rsvpSaving}
          >
            Maybe
          </button>
          <button
            className={`btn-rsvp ${profile.rsvp_status === 'not_going' ? 'active not-going' : ''}`}
            onClick={() => onRsvp('not_going')}
            disabled={rsvpSaving}
          >
            Can't Make It
          </button>
        </div>
      </div>
      <Link to="/events" className="rsvp-card-events-link">View All Events →</Link>
    </div>
  );
}
