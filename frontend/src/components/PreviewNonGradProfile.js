import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';
import '../styles/profileNew.css';

export default function PreviewNonGradProfile() {
  const [nonGrads, setNonGrads] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNonGrads();
  }, []);

  const fetchNonGrads = async () => {
    try {
      const res = await apiGet('/api/master-list?section=Non-Graduate&limit=45');
      if (res.ok) {
        const data = await res.json();
        setNonGrads(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch non-graduates');
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilReunion = () => {
    const reunionDate = new Date('2028-12-16');
    const today = new Date();
    const diffTime = reunionDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSelectChange = (e) => {
    const userId = e.target.value;
    if (userId) {
      const user = nonGrads.find(u => u.id === parseInt(userId));
      setSelectedUser(user);
    } else {
      setSelectedUser(null);
    }
  };

  return (
    <div>
      {/* User Selection */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          color: '#aaa',
          fontSize: '0.85rem',
          fontWeight: '600'
        }}>
          Select Non-Graduate User
        </label>
        {loading ? (
          <p style={{ color: '#888', fontSize: '0.85rem' }}>Loading non-graduates...</p>
        ) : (
          <select
            onChange={handleSelectChange}
            value={selectedUser?.id || ''}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '10px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              color: '#e0e0e0',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <option value="">-- Select a non-graduate --</option>
            {nonGrads.map(user => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name} ({user.email})
              </option>
            ))}
          </select>
        )}
        {nonGrads.length === 0 && !loading && (
          <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '8px' }}>
            No non-graduate users found.
          </p>
        )}
      </div>

      {/* Preview Container */}
      <div style={{
        border: '2px dashed rgba(207, 181, 59, 0.4)',
        borderRadius: '12px',
        padding: '20px',
        maxWidth: '500px'
      }}>
        {/* Preview Label */}
        <div style={{
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <span style={{
            color: '#CFB53B',
            fontSize: '0.8rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Profile Preview — Non-Graduate View
          </span>
        </div>

        {!selectedUser ? (
          <p style={{
            color: '#888',
            fontSize: '0.9rem',
            textAlign: 'center',
            padding: '40px 20px'
          }}>
            Select a non-graduate from the list above to preview their profile.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Donate Card */}
            <div className="profile-card donate-card">
              <div className="card-header">
                <h3>Welcome, {selectedUser.first_name || 'Guest'}!</h3>
              </div>
              <p className="donate-message">
                Thank you for being part of our 25th Homecoming celebration. Whether you graduated with us or not, you were part of that chapter and that will always matter.
              </p>
              <p className="donate-message">
                We're grateful you're here to celebrate this milestone. Your presence is what truly counts.
              </p>
              <div className="donate-divider"></div>
              <p className="donate-note">
                Have questions or suggestions? Head to your <span style={{ color: '#CFB53B', fontWeight: '500' }}>Inbox</span> and contact the committee.
              </p>
            </div>

            {/* RSVP Card Mock */}
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
                  <button className="btn-rsvp" disabled>Going</button>
                  <button className="btn-rsvp" disabled>Maybe</button>
                  <button className="btn-rsvp" disabled>Can't Make It</button>
                </div>
              </div>
            </div>

            {/* Hidden Features Info Box */}
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 100, 100, 0.08)',
              border: '1px solid rgba(255, 100, 100, 0.2)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#cc8888'
            }}>
              <strong style={{ color: '#ff9999' }}>Hidden for non-graduates:</strong>{' '}
              Contribution Plan, Alumni Card, Funds Page
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
