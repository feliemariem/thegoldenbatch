import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
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
export default function SystemTest({ batchRepResponseStats }) {
  const { user } = useAuth();
  const [activeFeature, setActiveFeature] = useState('inbox-preview');
  const [batchRepData, setBatchRepData] = useState([]);
  const [batchRepLoading, setBatchRepLoading] = useState(false);
  const [batchRepVisibleRows, setBatchRepVisibleRows] = useState(10);
  const [round2Data, setRound2Data] = useState(null);
  const [round2Loading, setRound2Loading] = useState(false);
  const [voteActivityData, setVoteActivityData] = useState(null);
  const [voteActivityLoading, setVoteActivityLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const features = [
    { id: 'inbox-preview', label: 'User Inbox Preview', description: 'Preview what any user sees in their inbox' },
    { id: 'nongrad-preview', label: 'Non-Grad Profile Preview', description: 'Preview what non-graduate users see on their profile' },
    { id: 'profile-preview', label: 'User Profile Preview', description: 'View any user\'s profile data' },
    { id: 'engagement', label: 'Engagement Stats', description: 'View user activity metrics' },
    { id: 'name-changes', label: 'Name Change Requests', description: 'Review and approve name change requests' },
    ...(user?.id === 1 ? [
      { id: 'batch-rep-full', label: 'Batch Rep Full View', description: 'View all batch rep submissions' },
      { id: 'round2-election', label: 'Round 2 Election', description: 'Individual votes and section breakdown' },
      { id: 'vote-activity', label: 'Vote Activity', description: 'Voting patterns and geographic breakdown' }
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

    // Reset data when leaving tab so next visit always fetches fresh
    return () => {
      if (activeFeature === 'round2-election') {
        setRound2Data(null);
      }
    };
  }, [user?.id, activeFeature]);

  useEffect(() => {
    const fetchVoteActivityData = async () => {
      setVoteActivityLoading(true);
      try {
        const res = await apiGet('/api/batch-rep/vote-activity');
        if (res.ok) {
          const data = await res.json();
          setVoteActivityData(data);
        }
      } catch (err) {
        console.error('Error fetching vote activity data:', err);
      } finally {
        setVoteActivityLoading(false);
      }
    };

    // Also fetch round2 data if not already fetched (needed for turnout calculation)
    const fetchRound2IfNeeded = async () => {
      if (!round2Data) {
        try {
          const res = await apiGet('/api/batch-rep/round2/results');
          if (res.ok) {
            const data = await res.json();
            setRound2Data(data);
          }
        } catch (err) {
          console.error('Error fetching round2 data for vote activity:', err);
        }
      }
    };

    if (user?.id === 1 && activeFeature === 'vote-activity') {
      fetchVoteActivityData();
      fetchRound2IfNeeded();
    }
  }, [user?.id, activeFeature, round2Data]);

  // Load Chart.js from CDN
  useEffect(() => {
    if (activeFeature === 'vote-activity' && !window.Chart) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [activeFeature]);

  const fetchAiAnalysis = async () => {
    if (!voteActivityData) return;
    setAiAnalysisLoading(true);
    try {
      const r1Turnout = batchRepResponseStats
        ? `${batchRepResponseStats.totalResponded}/${batchRepResponseStats.registeredGradsCount} (${Math.round((batchRepResponseStats.totalResponded / batchRepResponseStats.registeredGradsCount) * 100)}%)`
        : null;

      const r2TotalVotes = voteActivityData.r2Daily?.reduce((sum, d) => sum + d.count, 0) || 0;
      const r2Turnout = round2Data?.totalRegisteredGrads
        ? `${r2TotalVotes}/${round2Data.totalRegisteredGrads} (${Math.round((r2TotalVotes / round2Data.totalRegisteredGrads) * 100)}%)`
        : null;

      const sectionStats = [];
      if (batchRepResponseStats?.sections) {
        batchRepResponseStats.sections.forEach(s => {
          sectionStats.push({ section: s.section, r1Responded: s.responded, r1Total: s.total });
        });
      }
      if (round2Data?.votesBySection) {
        round2Data.votesBySection.forEach(s => {
          const existing = sectionStats.find(x => x.section === s.section);
          if (existing) {
            existing.r2Voted = parseInt(s.voted);
            existing.r2Total = parseInt(s.total);
          } else {
            sectionStats.push({ section: s.section, r2Voted: parseInt(s.voted), r2Total: parseInt(s.total) });
          }
        });
      }

      const res = await apiPost('/api/admin/engagement-summary', {
        context: 'vote-activity',
        r1Daily: voteActivityData.r1Daily,
        r2Daily: voteActivityData.r2Daily,
        r1Hourly: voteActivityData.r1Hourly,
        r2Hourly: voteActivityData.r2Hourly,
        geoData: voteActivityData.geoData,
        r1Turnout,
        r2Turnout,
        sectionStats
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.summary);
      }
    } catch (err) {
      console.error('Error fetching AI analysis:', err);
      setAiAnalysis('Failed to generate analysis.');
    } finally {
      setAiAnalysisLoading(false);
    }
  };

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

          {/* Response rate grid */}
          {batchRepResponseStats && (
            <div style={{ marginBottom: '24px' }}>
              {/* Section columns */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '16px',
                marginBottom: '20px'
              }}>
                {batchRepResponseStats.sections.map((section) => {
                  const pct = section.total > 0 ? Math.round((section.responded / section.total) * 100) : 0;
                  return (
                    <div key={section.section} style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {section.section}
                      </div>
                      <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)'
                      }}>
                        {section.responded}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-secondary)',
                        marginBottom: '8px'
                      }}>
                        of {section.total}
                      </div>
                      <div style={{
                        height: '4px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '6px'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: '#006633',
                          borderRadius: '2px'
                        }} />
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--color-text-secondary)'
                      }}>
                        {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Divider */}
              <div style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.08)',
                margin: '16px 0'
              }} />

              {/* Total row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)'
                }}>
                  Total respondents
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    fontSize: '0.85rem',
                    color: 'var(--color-text-secondary)'
                  }}>
                    {batchRepResponseStats.totalResponded} of {batchRepResponseStats.registeredGradsCount} grads
                  </span>
                </div>
              </div>
            </div>
          )}

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

              {/* Section share of total votes */}
              {(() => {
                const totalVotesCast = (round2Data.votesBySection || []).reduce((sum, r) => sum + parseInt(r.voted), 0);
                if (totalVotesCast === 0) return null;
                return (
                  <div style={{ marginBottom: '28px' }}>
                    <h4 style={{
                      fontSize: '0.75rem', fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      marginBottom: '12px'
                    }}>
                      Section Share of Total Votes
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '16px',
                      marginBottom: '20px'
                    }}>
                      {(round2Data.votesBySection || []).map((row) => {
                        const voted = parseInt(row.voted);
                        const sharePct = Math.round((voted / totalVotesCast) * 100);
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
                              {sharePct}%
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                              {voted} of {totalVotesCast}
                            </div>
                            <div style={{
                              height: '4px', background: 'rgba(255,255,255,0.1)',
                              borderRadius: '2px', overflow: 'hidden'
                            }}>
                              <div style={{
                                height: '100%', width: `${sharePct}%`,
                                background: '#006633', borderRadius: '2px'
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Individual voter list — sorted by time of vote */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    margin: 0
                  }}>
                    Individual Votes · sorted by time
                  </h4>
                  <button
                    onClick={() => {
                      setRound2Data(null);
                      setRound2Loading(true);
                      apiGet('/api/batch-rep/round2/results')
                        .then(res => res.ok ? res.json() : null)
                        .then(data => { if (data) setRound2Data(data); })
                        .finally(() => setRound2Loading(false));
                    }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--color-hover)', cursor: 'pointer',
                      fontSize: '0.75rem', textDecoration: 'underline'
                    }}
                  >
                    Refresh
                  </button>
                </div>
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

      {activeFeature === 'vote-activity' && user?.id === 1 && (
        <div style={{
          padding: '20px',
          background: 'var(--color-bg-card, rgba(255,255,255,0.03))',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px'
        }}>
          <h3 style={{ color: 'var(--color-text-primary)', margin: '0 0 20px 0', fontSize: '1.1rem' }}>
            Vote Activity
          </h3>

          {voteActivityLoading ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
          ) : !voteActivityData ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>No data yet.</p>
          ) : (
            <>
              {/* 1. Summary pills */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {batchRepResponseStats && (
                  <div style={{
                    padding: '12px 20px',
                    background: 'rgba(59, 139, 212, 0.1)',
                    border: '1px solid rgba(59, 139, 212, 0.3)',
                    borderRadius: '8px',
                    flex: '1 1 200px'
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(59, 139, 212, 0.8)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                      Round 1 Turnout
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {Math.round((batchRepResponseStats.totalResponded / voteActivityData.r1EligibleGrads) * 100)}%
                      <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                        ({batchRepResponseStats.totalResponded}/{voteActivityData.r1EligibleGrads})
                      </span>
                    </div>
                  </div>
                )}
                {round2Data && (
                  <div style={{
                    padding: '12px 20px',
                    background: 'rgba(186, 117, 23, 0.1)',
                    border: '1px solid rgba(186, 117, 23, 0.3)',
                    borderRadius: '8px',
                    flex: '1 1 200px'
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(186, 117, 23, 0.8)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                      Round 2 Turnout
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {(() => {
                        const r2Total = voteActivityData.r2Daily?.reduce((sum, d) => sum + d.count, 0) || 0;
                        const pct = round2Data.totalRegisteredGrads > 0 ? Math.round((r2Total / round2Data.totalRegisteredGrads) * 100) : 0;
                        return (
                          <>
                            {pct}%
                            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                              ({r2Total}/{round2Data.totalRegisteredGrads})
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Section engagement table */}
              {(batchRepResponseStats || round2Data) && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    marginBottom: '12px'
                  }}>
                    Section Engagement
                  </h4>
                  {(() => {
                    const totalR1Responded = batchRepResponseStats?.totalResponded || 0;
                    // Use r1EligibleGrads — grads registered before Round 1 closed (March 21 11:59 PM PHT)
                    // Excludes anyone added after Round 1 (e.g. Friend of Batch added later)
                    const totalR1Grads = voteActivityData?.r1EligibleGrads || batchRepResponseStats?.registeredGradsCount || 0;
                    const totalR2VotesCast = (round2Data?.votesBySection || []).reduce((sum, r) => sum + parseInt(r.voted), 0);
                    const totalR2Grads = round2Data?.totalRegisteredGrads || 0;

                    const CellContent = ({ value, total, shareTotal, color }) => {
                      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                      const sharePct = shareTotal > 0 ? Math.round((value / shareTotal) * 100) : 0;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color }}>{pct}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{value} of {total}</div>
                          <div style={{ width: '100%', maxWidth: '60px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: '2px' }} />
                          </div>
                        </div>
                      );
                    };

                    const ShareCell = ({ value, shareTotal, color }) => {
                      const sharePct = shareTotal > 0 ? Math.round((value / shareTotal) * 100) : 0;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color }}>{sharePct}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{value} of {shareTotal}</div>
                          <div style={{ width: '100%', maxWidth: '60px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(sharePct, 100)}%`, background: color, borderRadius: '2px' }} />
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}></th>
                                <th colSpan={2} style={{ padding: '8px', textAlign: 'center', color: '#3B8BD4', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid rgba(59, 139, 212, 0.3)' }}>
                                  Round 1 · Confirm/Nominate
                                </th>
                                <th colSpan={2} style={{ padding: '8px', textAlign: 'center', color: '#BA7517', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid rgba(186, 117, 23, 0.3)' }}>
                                  Round 2 · AA Rep Vote
                                </th>
                              </tr>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '0.7rem' }}>Section</th>
                                <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.7rem' }}>Turnout rate</th>
                                <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.7rem' }}>Share of votes</th>
                                <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.7rem' }}>Turnout rate</th>
                                <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.7rem' }}>Share of votes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {['11A', '11B', '11C', '11D', '11E'].map(section => {
                                const r1 = batchRepResponseStats?.sections?.find(s => s.section === section);
                                const r2 = round2Data?.votesBySection?.find(s => s.section === section);
                                const r1Responded = r1?.responded || 0;
                                const r1Total = r1?.total || 0;
                                const r2Voted = r2 ? parseInt(r2.voted) : 0;
                                const r2Total = r2 ? parseInt(r2.total) : 0;
                                return (
                                  <tr key={section} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '12px 8px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{section}</td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                      <CellContent value={r1Responded} total={r1Total} shareTotal={totalR1Responded} color="#3B8BD4" />
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                      <ShareCell value={r1Responded} shareTotal={totalR1Responded} color="#3B8BD4" />
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                      <CellContent value={r2Voted} total={r2Total} shareTotal={totalR2VotesCast} color="#BA7517" />
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                      <ShareCell value={r2Voted} shareTotal={totalR2VotesCast} color="#BA7517" />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                <td style={{ padding: '12px 8px', color: 'var(--color-text-primary)', fontWeight: 600 }}>Total</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#3B8BD4' }}>
                                      {totalR1Grads > 0 ? Math.round((totalR1Responded / totalR1Grads) * 100) : 0}%
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{totalR1Responded} of {totalR1Grads}</div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#3B8BD4' }}>100%</div>
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#BA7517' }}>
                                      {totalR2Grads > 0 ? Math.round((totalR2VotesCast / totalR2Grads) * 100) : 0}%
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{totalR2VotesCast} of {totalR2Grads}</div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#BA7517' }}>100%</div>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Legend */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '12px',
                          padding: '8px 0',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B8BD4' }} />
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Round 1</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#BA7517' }} />
                              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Round 2</span>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                            Turnout rate = voted / registered grads in section · Share = section votes / all votes cast
                          </div>
                        </div>

                        {/* Overlap pills */}
                        {round2Data && (
                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '12px',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              background: 'rgba(59, 139, 212, 0.1)',
                              border: '1px solid rgba(59, 139, 212, 0.2)',
                              borderRadius: '16px'
                            }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B8BD4' }} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>
                                {round2Data.repeatVoters || 0} repeat voters — both rounds
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              background: 'rgba(186, 117, 23, 0.1)',
                              border: '1px solid rgba(186, 117, 23, 0.2)',
                              borderRadius: '16px'
                            }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#BA7517' }} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>
                                {round2Data.newVoters || 0} new voters — Round 2 only
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              background: 'rgba(128, 128, 128, 0.1)',
                              border: '1px solid rgba(128, 128, 128, 0.2)',
                              borderRadius: '16px'
                            }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#808080' }} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>
                                {totalR1Responded - (round2Data.repeatVoters || 0)} dropped off — Round 1 only
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 3. Daily activity charts */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />
              <h4 style={{
                fontSize: '0.75rem', fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: '16px'
              }}>
                Daily Activity
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
                {/* Daily votes chart */}
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Votes per day (PHT)</div>
                  <div style={{ height: '160px', position: 'relative' }}>
                    <canvas id="dailyChart" />
                  </div>
                </div>
                {/* Hourly chart */}
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Time of day (local time)</div>
                  <div style={{ height: '160px', position: 'relative' }}>
                    <canvas id="hourlyChart" />
                  </div>
                </div>
              </div>
              {/* Custom legend */}
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', background: 'rgba(59, 139, 212, 0.6)', borderRadius: '2px' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Round 1</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '12px', background: 'rgba(186, 117, 23, 0.6)', borderRadius: '2px' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Round 2</span>
                </div>
              </div>

              {/* Initialize charts */}
              {(() => {
                setTimeout(() => {
                  if (!window.Chart) return;
                  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const textColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
                  const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

                  // Daily chart
                  const dailyCanvas = document.getElementById('dailyChart');
                  if (dailyCanvas && !dailyCanvas._chartInstance) {
                    // Fixed date range: Mar 14-29, 2026 (R1: Mar 14-21, R2: Mar 22-29)
                    const start = new Date('2026-03-14T00:00:00+08:00');
                    const allDates = Array.from({ length: 16 }, (_, i) => {
                      const d = new Date(start);
                      d.setDate(d.getDate() + i);
                      return d.toISOString().slice(0, 10);
                    });
                    const r1Map = Object.fromEntries((voteActivityData.r1Daily || []).map(d => [d.date, d.count]));
                    const r2Map = Object.fromEntries((voteActivityData.r2Daily || []).map(d => [d.date, d.count]));

                    dailyCanvas._chartInstance = new window.Chart(dailyCanvas, {
                      type: 'bar',
                      data: {
                        labels: allDates.map(d => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })),
                        datasets: [
                          { label: 'R1', data: allDates.map(d => r1Map[d] || 0), backgroundColor: 'rgba(59, 139, 212, 0.6)' },
                          { label: 'R2', data: allDates.map(d => r2Map[d] || 0), backgroundColor: 'rgba(186, 117, 23, 0.6)' }
                        ]
                      },
                      options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { ticks: { color: textColor, maxRotation: 45 }, grid: { color: gridColor } },
                          y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                        }
                      }
                    });
                  }

                  // Hourly chart
                  const hourlyCanvas = document.getElementById('hourlyChart');
                  if (hourlyCanvas && !hourlyCanvas._chartInstance) {
                    const buckets = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];
                    const bucketData = (hourlyData) => {
                      const result = [0, 0, 0, 0, 0, 0, 0, 0];
                      (hourlyData || []).forEach(h => {
                        const bucketIdx = Math.floor(h.hour / 3) % 8;
                        result[bucketIdx] += h.count;
                      });
                      return result;
                    };

                    hourlyCanvas._chartInstance = new window.Chart(hourlyCanvas, {
                      type: 'bar',
                      data: {
                        labels: buckets,
                        datasets: [
                          { label: 'R1', data: bucketData(voteActivityData.r1Hourly), backgroundColor: 'rgba(59, 139, 212, 0.6)' },
                          { label: 'R2', data: bucketData(voteActivityData.r2Hourly), backgroundColor: 'rgba(186, 117, 23, 0.6)' }
                        ]
                      },
                      options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { ticks: { color: textColor }, grid: { color: gridColor } },
                          y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                        }
                      }
                    });
                  }
                }, 500);
                return null;
              })()}

              {/* 4. Geographic breakdown */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />
              <h4 style={{
                fontSize: '0.75rem', fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: '16px'
              }}>
                Geographic Breakdown
              </h4>
              {(() => {
                const totalVoters = (voteActivityData.geoData || []).reduce((sum, g) => sum + g.count, 0);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(voteActivityData.geoData || []).map(geo => {
                      const pct = totalVoters > 0 ? Math.round((geo.count / totalVoters) * 100) : 0;
                      return (
                        <div key={geo.country} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '120px', fontSize: '0.85rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {geo.country}
                          </div>
                          <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#006633', borderRadius: '4px' }} />
                          </div>
                          <div style={{ width: '40px', fontSize: '0.8rem', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                            {geo.count}
                          </div>
                          <div style={{ width: '40px', fontSize: '0.75rem', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                            {pct}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 5. AI analysis panel */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '24px 0' }} />
              <div style={{
                background: 'rgba(207, 181, 59, 0.05)',
                border: '1px solid rgba(207, 181, 59, 0.2)',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => {
                    setAiPanelOpen(!aiPanelOpen);
                    if (!aiPanelOpen && !aiAnalysis && !aiAnalysisLoading) {
                      fetchAiAnalysis();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#CFB53B' }}>
                    AI Analysis
                  </span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {aiPanelOpen ? '▲' : '▼'}
                  </span>
                </button>
                {aiPanelOpen && (
                  <div style={{ padding: '0 16px 16px' }}>
                    {aiAnalysisLoading ? (
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: 0 }}>Generating analysis...</p>
                    ) : aiAnalysis ? (
                      <p style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>{aiAnalysis}</p>
                    ) : (
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', margin: 0 }}>Click to generate analysis.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
