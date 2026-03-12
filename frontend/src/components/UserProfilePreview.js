import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';

export default function UserProfilePreview() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiGet('/api/admin/users?limit=1000');
        const data = await res.json();
        const sorted = (data.users || []).sort((a, b) => {
          const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
          if (lastNameCompare !== 0) return lastNameCompare;
          return (a.first_name || '').localeCompare(b.first_name || '');
        });
        setUsers(sorted);
      } catch (err) {
        console.error('Failed to fetch users');
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchProfile(selectedUserId);
    } else {
      setProfile(null);
    }
  }, [selectedUserId]);

  const fetchProfile = async (userId) => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiGet(`/api/admin/users/${userId}/profile`);

      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatPeso = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '₱0';
    return `₱${num.toLocaleString('en-PH')}`;
  };

  return (
    <div className="user-profile-preview">
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        background: 'rgba(0, 102, 51, 0.08)',
        border: '1px solid rgba(0, 102, 51, 0.2)',
        borderRadius: '12px'
      }}>
        <h3 style={{ color: '#006633', margin: '0 0 8px 0', fontSize: '1rem' }}>
          User Profile Preview
        </h3>
        <p style={{ color: '#666', margin: '0 0 16px 0', fontSize: '0.85rem' }}>
          Select a registered user to view their profile data as they see it.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{
              flex: '1',
              minWidth: '250px',
              padding: '12px 16px',
              fontSize: '0.95rem',
              borderRadius: '8px',
              border: '1px solid rgba(0, 102, 51, 0.3)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="">-- Select a user --</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.last_name}, {user.first_name} ({user.email})
              </option>
            ))}
          </select>

          {selectedUserId && (
            <button
              onClick={() => setSelectedUserId('')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: '1px solid rgba(220, 53, 69, 0.3)',
                borderRadius: '8px',
                color: '#dc3545',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Loading profile...
        </div>
      )}

      {error && (
        <div style={{
          padding: '16px',
          background: 'rgba(220, 53, 69, 0.1)',
          border: '1px solid rgba(220, 53, 69, 0.3)',
          borderRadius: '8px',
          color: '#dc3545',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {profile && !loading && (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            {profile.profile_photo ? (
              <img
                src={profile.profile_photo}
                alt={`${profile.first_name}'s photo`}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid var(--color-hover)'
                }}
              />
            ) : (
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-hover) 0%, #b8a033 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.5rem',
                fontWeight: '600'
              }}>
                {profile.first_name?.[0]}{profile.last_name?.[0]}
              </div>
            )}
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                {profile.first_name} {profile.last_name}
              </h4>
              <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                {profile.email}
              </p>
            </div>
          </div>

          {/* Profile Details */}
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>RSVP Status</label>
                <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {profile.rsvp_status ? profile.rsvp_status.replace('_', ' ') : 'No Response'}
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Location</label>
                <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {[profile.city, profile.country].filter(Boolean).join(', ') || '—'}
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Occupation</label>
                <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {profile.occupation || '—'}
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Company</label>
                <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {profile.company || '—'}
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Section</label>
                <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {profile.section || '—'}
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Registered</label>
                <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {formatDate(profile.created_at)}
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Last Login</label>
                <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                  {formatDateTime(profile.last_login)}
                </p>
              </div>

              {profile.is_graduate && (
                <>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Builder Tier</label>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                      {profile.builder_tier ? profile.builder_tier.charAt(0).toUpperCase() + profile.builder_tier.slice(1) : 'Not set'}
                    </p>
                  </div>

                  {profile.builder_tier && profile.builder_tier !== 'root' && profile.pledge_amount && (
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Pledge / Paid</label>
                      <p style={{ margin: '4px 0 0', color: 'var(--text-primary)' }}>
                        {formatPeso(profile.pledge_amount)} / {formatPeso(profile.total_paid)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tags */}
            <div style={{ marginTop: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                background: profile.is_graduate ? 'rgba(40, 167, 69, 0.15)' : 'rgba(108, 117, 125, 0.15)',
                color: profile.is_graduate ? '#28a745' : '#6c757d'
              }}>
                {profile.is_graduate ? 'Graduate' : 'Non-Graduate'}
              </span>

              {profile.has_alumni_card && (
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  background: 'rgba(0, 102, 51, 0.15)',
                  color: '#006633'
                }}>
                  Alumni Card Holder
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
