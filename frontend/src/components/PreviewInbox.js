import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';

export default function PreviewInbox({ token }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Fetch users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiGet('/api/admin/users?limit=1000');
        const data = await res.json();
        // Sort by last name, then first name
        const sorted = (data.users || []).sort((a, b) => {
          const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
          if (lastNameCompare !== 0) return lastNameCompare;
          return (a.first_name || '').localeCompare(b.first_name || '');
        });
        setUsers(sorted);
      } catch (err) {
        console.error('Failed to fetch users for preview');
      }
    };
    fetchUsers();
  }, [token]);

  useEffect(() => {
    if (selectedUserId) {
      fetchPreview(selectedUserId);
    } else {
      setPreviewData(null);
    }
  }, [selectedUserId]);

  const fetchPreview = async (userId) => {
    setLoading(true);
    setError(null);
    setSelectedMessage(null);

    try {
      const res = await apiGet(`/api/announcements/preview-inbox/${userId}`);

      if (!res.ok) {
        throw new Error('Failed to fetch preview');
      }

      const data = await res.json();
      setPreviewData(data);
    } catch (err) {
      console.error('Failed to fetch inbox preview:', err);
      setError('Failed to load inbox preview');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatFullDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getAudienceLabel = (audience) => {
    switch (audience) {
      case 'all': return 'All Users';
      case 'admins': return 'Admins Only';
      case 'going': return 'Going';
      case 'maybe': return 'Maybe';
      case 'not_going': return 'Not Going';
      default: return audience;
    }
  };

  return (
    <div className="preview-inbox">
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        background: 'rgba(0, 102, 51, 0.08)',
        border: '1px solid rgba(0, 102, 51, 0.2)',
        borderRadius: '12px'
      }}>
        <h3 style={{ color: '#006633', margin: '0 0 8px 0', fontSize: '1rem' }}>
          Preview User Inbox
        </h3>
        <p style={{ color: '#666', margin: '0 0 16px 0', fontSize: '0.85rem' }}>
          Select a registered user to preview what announcements they would see in their inbox.
          This helps verify that admin-only announcements are properly hidden from non-admin users.
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
            <option value="">-- Select a user to preview --</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.last_name}, {user.first_name} ({user.email})
                {user.rsvp_status ? ` - ${user.rsvp_status.replace('_', ' ')}` : ''}
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
          Loading preview...
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

      {previewData && !loading && (
        <>
          {/* User Info Card */}
          <div style={{
            marginBottom: '20px',
            padding: '16px 20px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '1rem' }}>
                {previewData.user.first_name} {previewData.user.last_name}
              </div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>
                {previewData.user.email}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: previewData.user.is_admin ? 'rgba(220, 53, 69, 0.15)' : 'rgba(108, 117, 125, 0.15)',
                color: previewData.user.is_admin ? '#dc3545' : '#6c757d'
              }}>
                {previewData.user.is_admin ? 'Admin' : 'Non-Admin'}
              </span>

              <span style={{
                padding: '6px 12px',
                borderRadius: '16px',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: previewData.user.rsvp_status === 'going' ? 'rgba(40, 167, 69, 0.15)' :
                  previewData.user.rsvp_status === 'maybe' ? 'rgba(207, 181, 59, 0.15)' :
                    previewData.user.rsvp_status === 'not_going' ? 'rgba(220, 53, 69, 0.15)' :
                      'rgba(108, 117, 125, 0.15)',
                color: previewData.user.rsvp_status === 'going' ? '#28a745' :
                  previewData.user.rsvp_status === 'maybe' ? '#CFB53B' :
                    previewData.user.rsvp_status === 'not_going' ? '#dc3545' :
                      '#6c757d'
              }}>
                RSVP: {previewData.user.rsvp_status ? previewData.user.rsvp_status.replace('_', ' ') : 'No Response'}
              </span>
            </div>
          </div>

          {/* Preview Inbox */}
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>
                Inbox Preview ({previewData.announcements.length} messages)
              </h4>
              {previewData.user.is_admin && (
                <span style={{
                  fontSize: '0.75rem',
                  color: '#28a745',
                  background: 'rgba(40, 167, 69, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '12px'
                }}>
                  Can see admin-only messages
                </span>
              )}
              {!previewData.user.is_admin && (
                <span style={{
                  fontSize: '0.75rem',
                  color: '#dc3545',
                  background: 'rgba(220, 53, 69, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '12px'
                }}>
                  Cannot see admin-only messages
                </span>
              )}
            </div>

            {previewData.announcements.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#666'
              }}>
                No announcements visible to this user
              </div>
            ) : (
              <div>
                {previewData.announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    onClick={() => setSelectedMessage(selectedMessage?.id === announcement.id ? null : announcement)}
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: selectedMessage?.id === announcement.id ? 'rgba(0, 102, 51, 0.1)' : 'transparent',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '6px'
                    }}>
                      <div style={{
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap'
                      }}>
                        {announcement.subject}
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: '600',
                          background: announcement.audience === 'admins' ? 'rgba(220, 53, 69, 0.15)' :
                            announcement.audience === 'all' ? 'rgba(0, 102, 51, 0.15)' :
                              'rgba(207, 181, 59, 0.15)',
                          color: announcement.audience === 'admins' ? '#dc3545' :
                            announcement.audience === 'all' ? '#006633' :
                              '#8B6914'
                        }}>
                          {getAudienceLabel(announcement.audience)}
                        </span>
                      </div>
                      <span style={{
                        color: '#CFB53B',
                        fontSize: '0.8rem',
                        flexShrink: 0
                      }}>
                        {formatDate(announcement.created_at)}
                      </span>
                    </div>
                    <p style={{
                      margin: 0,
                      color: '#666',
                      fontSize: '0.85rem',
                      lineHeight: '1.4',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {announcement.message}
                    </p>

                    {/* Expanded message view */}
                    {selectedMessage?.id === announcement.id && (
                      <div style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: 'rgba(0, 0, 0, 0.05)',
                        borderRadius: '8px',
                        borderLeft: '3px solid #006633'
                      }}>
                        <div style={{
                          color: '#666',
                          fontSize: '0.8rem',
                          marginBottom: '12px'
                        }}>
                          {formatFullDate(announcement.created_at)}
                        </div>
                        <div style={{
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {announcement.message}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Explanation of what this user can/cannot see */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: 'rgba(207, 181, 59, 0.08)',
            border: '1px solid rgba(207, 181, 59, 0.2)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#666'
          }}>
            <strong style={{ color: '#8B6914' }}>Visibility Rules for This User:</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>
                <strong>All Users</strong> announcements: <span style={{ color: '#28a745' }}>Visible</span>
              </li>
              <li>
                <strong>Admin Only</strong> announcements: {' '}
                {previewData.user.is_admin
                  ? <span style={{ color: '#28a745' }}>Visible (user is an admin)</span>
                  : <span style={{ color: '#dc3545' }}>Hidden (user is not an admin)</span>
                }
              </li>
              <li>
                <strong>RSVP-specific</strong> announcements: {' '}
                {previewData.user.rsvp_status
                  ? <span style={{ color: '#28a745' }}>Visible if matching "{previewData.user.rsvp_status.replace('_', ' ')}"</span>
                  : <span style={{ color: '#dc3545' }}>Hidden (no RSVP status set)</span>
                }
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
