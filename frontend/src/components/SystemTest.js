import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import PreviewInbox from './PreviewInbox';
import PreviewNonGradProfile from './PreviewNonGradProfile';
import UserProfilePreview from './UserProfilePreview';
import EngagementStats from './EngagementStats';
import NameChangeRequests from './NameChangeRequests';

/**
 * SystemTest - Super Admin testing panel
 * Only visible to uslsis.batch2003@gmail.com
 *
 * This component provides various testing features for the super admin:
 * - User Inbox Preview: See what announcements any user would see
 * - User Profile Preview: View any user's profile data
 * - Engagement Stats: View user activity metrics
 * - (More features can be added here in the future)
 */
export default function SystemTest() {
  const { user } = useAuth();
  const [activeFeature, setActiveFeature] = useState('inbox-preview');
  const [batchRepResponses, setBatchRepResponses] = useState([]);
  const [batchRepLoading, setBatchRepLoading] = useState(false);

  const features = [
    { id: 'inbox-preview', label: 'User Inbox Preview', description: 'Preview what any user sees in their inbox' },
    { id: 'nongrad-preview', label: 'Non-Grad Profile Preview', description: 'Preview what non-graduate users see on their profile' },
    { id: 'profile-preview', label: 'User Profile Preview', description: 'View any user\'s profile data' },
    { id: 'engagement', label: 'Engagement Stats', description: 'View user activity metrics' },
    { id: 'name-changes', label: 'Name Change Requests', description: 'Review and approve name change requests' },
    ...(user?.id === 1 ? [{ id: 'batch-rep-responses', label: 'Batch Rep Responses', description: 'View all batch rep voting responses' }] : []),
  ];

  useEffect(() => {
    if (user?.id === 1) {
      setBatchRepLoading(true);
      fetch('/api/batch-rep/admin-responses', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setBatchRepResponses(data);
          }
        })
        .catch(err => console.error('Error fetching batch rep responses:', err))
        .finally(() => setBatchRepLoading(false));
    }
  }, [user?.id]);

  return (
    <div className="system-test">
      {/* Header */}
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(139, 105, 20, 0.12) 0%, rgba(207, 181, 59, 0.08) 100%)',
        border: '1px solid rgba(207, 181, 59, 0.25)',
        borderRadius: '12px'
      }}>
        <h2 style={{
          color: '#CFB53B',
          margin: '0 0 8px 0',
          fontSize: '1.25rem',
          fontWeight: '700'
        }}>
          System Test
        </h2>
        <p style={{
          color: '#888',
          margin: 0,
          fontSize: '0.85rem'
        }}>
          Testing tools for system verification. Only accessible to super admin.
        </p>
      </div>

      {/* Feature Tabs (for when there are multiple features) */}
      {features.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          {features.map((feature) => (
            <button
              key={feature.id}
              onClick={() => setActiveFeature(feature.id)}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                background: activeFeature === feature.id
                  ? 'rgba(207, 181, 59, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: activeFeature === feature.id ? '#CFB53B' : '#888',
                border: activeFeature === feature.id
                  ? '1px solid rgba(207, 181, 59, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease'
              }}
              title={feature.description}
            >
              {feature.label}
            </button>
          ))}
        </div>
      )}

      {/* Feature Content */}
      {activeFeature === 'inbox-preview' && (
        <PreviewInbox />
      )}

      {activeFeature === 'nongrad-preview' && (
        <PreviewNonGradProfile />
      )}

      {activeFeature === 'profile-preview' && (
        <UserProfilePreview />
      )}

      {activeFeature === 'engagement' && (
        <EngagementStats />
      )}

      {activeFeature === 'name-changes' && (
        <NameChangeRequests />
      )}

      {activeFeature === 'batch-rep-responses' && user?.id === 1 && (
        <div style={{
          padding: '20px',
          background: 'var(--card-bg, rgba(255,255,255,0.03))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
          borderRadius: '12px'
        }}>
          <h3 style={{ color: 'var(--text-primary, #fff)', margin: '0 0 16px 0', fontSize: '1.1rem' }}>
            Batch Rep Responses
          </h3>
          {batchRepLoading ? (
            <p style={{ color: 'var(--text-secondary, #888)' }}>Loading...</p>
          ) : batchRepResponses.length === 0 ? (
            <p style={{ color: 'var(--text-secondary, #888)' }}>No responses yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.1))' }}>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>Position 1 · AA Rep</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>Position 2 · Batch Rep</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRepResponses.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--text-primary, #fff)' }}>
                        {row.first_name} {row.last_name}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <ResponseCell
                          selection={row.pos1_selection}
                          nominee={row.pos1_nominee}
                          willing={row.pos1_willing}
                        />
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <ResponseCell
                          selection={row.pos2_selection}
                          nominee={row.pos2_nominee}
                          willing={row.pos2_willing}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResponseCell({ selection, nominee, willing }) {
  if (!selection) {
    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: '500',
        background: 'var(--muted-bg, rgba(128,128,128,0.15))',
        color: 'var(--text-muted, #666)'
      }}>
        No response
      </span>
    );
  }

  if (selection === 'confirm') {
    return (
      <div>
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: '500',
          background: 'rgba(34, 197, 94, 0.15)',
          color: '#22c55e'
        }}>
          Confirm
        </span>
        {willing && (
          <div style={{
            marginTop: '4px',
            fontSize: '0.75rem',
            color: '#22c55e'
          }}>
            Willing to serve
          </div>
        )}
      </div>
    );
  }

  if (selection === 'nominate') {
    return (
      <div>
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontWeight: '500',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b'
        }}>
          Nominate
        </span>
        {nominee && (
          <div style={{
            marginTop: '4px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary, #888)'
          }}>
            → {nominee}
          </div>
        )}
      </div>
    );
  }

  return null;
}
