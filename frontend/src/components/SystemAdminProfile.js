import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../api';
import Navbar from './Navbar';
import Footer from './Footer';
import '../styles/profileNew.css';
import '../styles/systemAdmin.css';

// Batch-rep deadline: March 14, 2026 at 8:00 AM PHT (UTC+8)
const BATCH_REP_DEADLINE = new Date('2026-03-14T08:00:00+08:00');

const getDaysUntilDeadline = () => {
  const now = new Date();
  const diffTime = BATCH_REP_DEADLINE - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const formatPHT = (date) => {
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export default function SystemAdminProfile() {
  const { user } = useAuth();
  const [batchRepResults, setBatchRepResults] = useState(null);
  const [batchRepOpen, setBatchRepOpen] = useState(false);
  const [batchRepLoading, setBatchRepLoading] = useState(false);
  const [batchRepLastUpdated, setBatchRepLastUpdated] = useState(null);

  const fetchBatchRepResults = async () => {
    setBatchRepLoading(true);
    try {
      const res = await apiGet('/api/batch-rep/results');
      if (res.ok) {
        const data = await res.json();
        setBatchRepResults(data);
        setBatchRepLastUpdated(new Date());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBatchRepLoading(false);
    }
  };

  useEffect(() => {
    if (batchRepOpen && !batchRepResults) {
      fetchBatchRepResults();
    }
  }, [batchRepOpen, batchRepResults]);

  const daysLeft = getDaysUntilDeadline();

  return (
    <div className="container admin-container">
      <Navbar />
      <div className="card">

        <main className="profile-main">
          {/* System Admin Content */}
          <div className="system-admin-content">
            <div className="system-admin-card">
              <div className="system-admin-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </div>
              <h2 className="system-admin-title">System Administrator</h2>
              <p className="system-admin-email">{user?.email}</p>
              <p className="system-admin-description">
                You are logged in as the system administrator. Use the Admin Dashboard to manage the application.
              </p>
              <Link to="/admin" className="system-admin-button">
                Go to Admin Dashboard
              </Link>
            </div>

            {/* Batch Rep Results Card */}
            <div style={{
              marginTop: '24px',
              background: 'var(--color-bg-card)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <button
                onClick={() => setBatchRepOpen(!batchRepOpen)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-hover)' }}>
                    🗳️ Batch Rep Results
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: daysLeft > 0 ? 'rgba(39, 174, 96, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                    color: daysLeft > 0 ? 'var(--color-status-positive)' : 'var(--color-status-negative)'
                  }}>
                    {daysLeft > 0 ? `Active · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : 'Closed'}
                  </span>
                </div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                  {batchRepOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Collapsible Content */}
              {batchRepOpen && (
                <div style={{ padding: '0 20px 20px' }}>
                  {batchRepLoading ? (
                    <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Loading...</p>
                  ) : batchRepResults ? (
                    <>
                      {/* Last Updated */}
                      {batchRepLastUpdated && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                          Last updated: {formatPHT(batchRepLastUpdated)}
                          <button
                            onClick={fetchBatchRepResults}
                            style={{
                              marginLeft: '8px',
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-hover)',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              textDecoration: 'underline'
                            }}
                          >
                            Refresh
                          </button>
                        </p>
                      )}

                      {/* Summary Stats */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '12px',
                        marginBottom: '24px'
                      }}>
                        {[
                          { label: 'Responses', value: batchRepResults.totalResponses },
                          { label: 'Confirmations', value: batchRepResults.totalConfirmations },
                          { label: 'Nominations', value: batchRepResults.totalNominations },
                          { label: 'Willing', value: batchRepResults.willingnessYes }
                        ].map((stat, i) => (
                          <div key={i} style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-hover)' }}>
                              {stat.value}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {stat.label}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Confirmations Section */}
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                          Confirmations
                        </h4>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Bianca Jison</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                              {batchRepResults.totalConfirmations} ({batchRepResults.confirmationPct}%)
                            </span>
                          </div>
                          <div style={{
                            height: '8px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${batchRepResults.confirmationPct}%`,
                              background: '#006633',
                              borderRadius: '4px'
                            }} />
                          </div>
                        </div>
                      </div>

                      {/* Other Nominations Section */}
                      {batchRepResults.nominees.length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                            Other Nominations
                          </h4>
                          {batchRepResults.nominees.map((nominee, i) => (
                            <div key={i} style={{ marginBottom: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>{nominee.name}</span>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: nominee.willing === true
                                      ? 'rgba(39, 174, 96, 0.15)'
                                      : nominee.willing === false
                                        ? 'rgba(231, 76, 60, 0.15)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                    color: nominee.willing === true
                                      ? 'var(--color-status-positive)'
                                      : nominee.willing === false
                                        ? 'var(--color-status-negative)'
                                        : 'var(--color-text-secondary)'
                                  }}>
                                    {nominee.willing === true ? '✓ Willing' : nominee.willing === false ? '✕ Not willing' : '? Unknown'}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                  {nominee.count} ({nominee.pct}%)
                                </span>
                              </div>
                              <div style={{
                                height: '8px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${nominee.pct}%`,
                                  background: nominee.willing === true ? '#CFB53B' : 'rgba(255, 255, 255, 0.3)',
                                  borderRadius: '4px'
                                }} />
                              </div>
                              {/* Master list info row */}
                              <div style={{
                                display: 'flex',
                                gap: '16px',
                                marginTop: '8px',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-secondary)'
                              }}>
                                <span>Status: {nominee.registered ? 'Registered' : 'Not registered'}</span>
                                <span>City: {nominee.city || '—'}</span>
                              </div>
                              {nominee.comments.length > 0 && (
                                <div style={{ marginTop: '8px' }}>
                                  {nominee.comments.map((comment, j) => (
                                    <p key={j} style={{
                                      fontSize: '0.8rem',
                                      fontStyle: 'italic',
                                      color: 'var(--color-text-secondary)',
                                      margin: '4px 0',
                                      paddingLeft: '12px',
                                      borderLeft: '2px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                      "{comment}"
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Willingness Summary */}
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                          Willingness Summary · {batchRepResults.willingnessTotal} responded
                        </h4>
                        {/* Yes row */}
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Yes, willing to serve</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                              {batchRepResults.willingnessYes} ({batchRepResults.willingnessYesPct}%)
                            </span>
                          </div>
                          <div style={{
                            height: '8px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${batchRepResults.willingnessYesPct}%`,
                              background: '#006633',
                              borderRadius: '4px'
                            }} />
                          </div>
                        </div>
                        {/* No row */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>No, not at this time</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                              {batchRepResults.willingnessNo} ({batchRepResults.willingnessNoPct}%)
                            </span>
                          </div>
                          <div style={{
                            height: '8px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${batchRepResults.willingnessNoPct}%`,
                              background: 'rgba(255, 255, 255, 0.3)',
                              borderRadius: '4px'
                            }} />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)' }}>Failed to load results.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
