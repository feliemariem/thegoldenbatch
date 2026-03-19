import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../api';
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
  const [batchRepData, setBatchRepData] = useState([]);
  const [batchRepLoading, setBatchRepLoading] = useState(false);
  const [batchRepVisibleRows, setBatchRepVisibleRows] = useState(10);
  const [round2Data, setRound2Data] = useState(null);
  const [round2Loading, setRound2Loading] = useState(false);

  const features = [
    { id: 'inbox-preview', label: 'User Inbox Preview', description: 'Preview what any user sees in their inbox' },
    { id: 'nongrad-preview', label: 'Non-Grad Profile Preview', description: 'Preview what non-graduate users see on their profile' },
    { id: 'profile-preview', label: 'User Profile Preview', description: 'View any user\'s profile data' },
    { id: 'engagement', label: 'Engagement Stats', description: 'View user activity metrics' },
    { id: 'name-changes', label: 'Name Change Requests', description: 'Review and approve name change requests' },
    ...(user?.id === 1 ? [
      { id: 'batch-rep-full', label: 'Batch Rep Full View', description: 'View all batch rep submissions' },
      { id: 'round2-election', label: 'Round 2 Election', description: 'Individual votes and section breakdown' }
    ] : []),
  ];

  useEffect(() => {
    const fetchBatchRepData = async () => {
      setBatchRepLoading(true);
      try {
        const res = await apiGet('/api/admin/system-test/batch-rep-submissions');
        if (res.ok) {
          const data = await res.json();
          setBatchRepData(data);
        }
      } catch (err) {
        console.error('Error fetching batch rep data:', err);
      } finally {
        setBatchRepLoading(false);
      }
    };

    if (user?.id === 1 && activeFeature === 'batch-rep-full') {
      fetchBatchRepData();
    }
  }, [user?.id, activeFeature]);

  useEffect(() => {
    const fetchRound2Data = async () => {
      setRound2Loading(true);
      try {
        const res = await apiGet('/api/batch-rep/round2/results');
        if (res.ok) {
          const data = await res.json();
          setRound2Data(data);
        }
      } catch (err) {
        console.error('Error fetching round2 election data:', err);
      } finally {
        setRound2Loading(false);
      }
    };

    if (user?.id === 1 && activeFeature === 'round2-election') {
      fetchRound2Data();
    }
  }, [user?.id, activeFeature]);

  const formatResponseTime = (timestamp) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

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

      {activeFeature === 'batch-rep-full' && user?.id === 1 && (
        <div style={{
          padding: '20px',
          background: 'var(--color-bg-card, rgba(255,255,255,0.03))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
          borderRadius: '12px'
        }}>
          <h3 style={{ color: 'var(--text-primary, #fff)', margin: '0 0 16px 0', fontSize: '1.1rem' }}>
            Batch Rep Full View
          </h3>
          {batchRepLoading ? (
            <p style={{ color: 'var(--text-secondary, #888)' }}>Loading...</p>
          ) : batchRepData.length === 0 ? (
            <p style={{ color: 'var(--text-secondary, #888)' }}>No submissions yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem'
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.1))' }}>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>Name</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>AA Rep</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>Batch Rep</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>AA Rep Nominee</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>Batch Rep Nominee</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary, #888)', fontWeight: '600' }}>Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRepData.slice(0, batchRepVisibleRows).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--text-primary, #fff)' }}>
                        {row.first_name} {row.last_name}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        {row.p1_selection && (
                          <div>
                            <span style={{
                              display: 'inline-block',
                              width: '24px',
                              height: '24px',
                              lineHeight: '24px',
                              borderRadius: '4px',
                              fontWeight: '700',
                              fontSize: '0.8rem',
                              background: row.p1_selection === 'confirm' ? '#6B7280' : 'rgba(245, 158, 11, 0.15)',
                              color: row.p1_selection === 'confirm' ? '#fff' : '#f59e0b'
                            }}>
                              {row.p1_selection === 'confirm' ? 'C' : 'N'}
                            </span>
                            {row.willing_aa_rep && (
                              <div style={{
                                marginTop: '4px',
                                fontSize: '0.6rem',
                                fontWeight: '600',
                                color: '#22c55e',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                Willing
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        {row.p2_selection && (
                          <div>
                            <span style={{
                              display: 'inline-block',
                              width: '24px',
                              height: '24px',
                              lineHeight: '24px',
                              borderRadius: '4px',
                              fontWeight: '700',
                              fontSize: '0.8rem',
                              background: row.p2_selection === 'confirm' ? '#6B7280' : 'rgba(245, 158, 11, 0.15)',
                              color: row.p2_selection === 'confirm' ? '#fff' : '#f59e0b'
                            }}>
                              {row.p2_selection === 'confirm' ? 'C' : 'N'}
                            </span>
                            {row.willing_batch_rep && (
                              <div style={{
                                marginTop: '4px',
                                fontSize: '0.6rem',
                                fontWeight: '600',
                                color: '#22c55e',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                Willing
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary, #888)' }}>
                        {row.p1_nominee_name || ''}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary, #888)' }}>
                        {row.p2_nominee_name || ''}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary, #888)', fontSize: '0.8rem' }}>
                        {formatResponseTime(row.response_time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {batchRepVisibleRows < batchRepData.length && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    onClick={() => setBatchRepVisibleRows(prev => prev + 10)}
                    style={{
                      padding: '10px 24px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'var(--text-secondary, #888)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}
                  >
                    Load more ({batchRepData.length - batchRepVisibleRows} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeFeature === 'round2-election' && user?.id === 1 && (
        <div style={{
          padding: '20px',
          background: 'var(--color-bg-card, rgba(255,255,255,0.03))',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px'
        }}>
          <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 20px 0', fontSize: '1.1rem' }}>
            Round 2 · AA Rep Election Results
          </h3>

          {round2Loading ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
          ) : !round2Data ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>No data yet.</p>
          ) : (
            <>
              {/* Voter turnout by section — mirrors batch rep response rate card */}
              <div style={{ marginBottom: '28px' }}>
                <h4 style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  marginBottom: '12px'
                }}>
                  Voter Turnout by Section
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '16px',
                  marginBottom: '20px'
                }}>
                  {(() => {
                    return (round2Data.votesBySection || []).map((row) => {
                      const voted = parseInt(row.voted);
                      const total = parseInt(row.total);
                      const pct = total > 0 ? Math.round((voted / total) * 100) : 0;
                      return (
                        <div key={row.section} style={{ marginBottom: '16px', textAlign: 'center' }}>
                          <div style={{
                            fontSize: '0.75rem', fontWeight: 600,
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase', letterSpacing: '0.5px',
                            marginBottom: '8px'
                          }}>
                            {row.section}
                          </div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {voted}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                            of {total}
                          </div>
                          <div style={{
                            height: '4px', background: 'rgba(255,255,255,0.1)',
                            borderRadius: '2px', overflow: 'hidden', marginBottom: '6px'
                          }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: '#006633', borderRadius: '2px'
                            }} />
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                            {pct}%
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Individual voter list — sorted by time of vote */}
              <div>
                <h4 style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  marginBottom: '12px'
                }}>
                  Individual Votes · sorted by time
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Name</th>
                        {/* One column per candidate — checkmark shows who they voted for */}
                        <th style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Bianca</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Mel</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Time (PHT)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(round2Data.voterList || []).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 8px', color: 'var(--color-text-primary)' }}>
                            {row.first_name} {row.last_name}
                          </td>
                          {/* ✓ appears only in the column matching their vote */}
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {row.candidate_name === 'Bianca Jison' && (
                              <span style={{ color: 'var(--color-status-positive)', fontWeight: 700 }}>✓</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {row.candidate_name === 'Mel Andrea Rivero' && (
                              <span style={{ color: 'var(--color-status-positive)', fontWeight: 700 }}>✓</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 8px', color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                            {new Date(row.created_at).toLocaleString('en-PH', {
                              timeZone: 'Asia/Manila',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!round2Data.voterList || round2Data.voterList.length === 0) && (
                    <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px' }}>
                      No votes cast yet.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
