import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';

export default function EngagementStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiGet('/api/admin/engagement');

      if (!res.ok) {
        throw new Error('Failed to fetch engagement stats');
      }

      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch engagement stats:', err);
      setError('Failed to load engagement stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        Loading engagement stats...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        background: 'rgba(220, 53, 69, 0.1)',
        border: '1px solid rgba(220, 53, 69, 0.3)',
        borderRadius: '8px',
        color: '#dc3545',
        textAlign: 'center'
      }}>
        {error}
        <button
          onClick={fetchStats}
          style={{
            marginLeft: '12px',
            background: 'none',
            border: 'none',
            color: '#dc3545',
            textDecoration: 'underline',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="engagement-stats">
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        background: 'rgba(0, 102, 51, 0.08)',
        border: '1px solid rgba(0, 102, 51, 0.2)',
        borderRadius: '12px'
      }}>
        <h3 style={{ color: '#006633', margin: '0 0 8px 0', fontSize: '1rem' }}>
          Engagement Stats
        </h3>
        <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>
          User activity based on login timestamps.
        </p>
      </div>

      {stats && (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center'
        }}>
          {/* Main Stat */}
          <div style={{
            fontSize: '3rem',
            fontWeight: '700',
            color: 'var(--color-hover)',
            marginBottom: '8px'
          }}>
            {stats.active_30d_pct}%
          </div>

          <div style={{
            fontSize: '1rem',
            color: 'var(--text-primary)',
            marginBottom: '24px'
          }}>
            active in the last 30 days
          </div>

          <div style={{
            fontSize: '0.9rem',
            color: '#666',
            padding: '12px 16px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            display: 'inline-block'
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>{stats.active_30d}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{stats.total_registered}</strong> registered users
          </div>

          {/* Refresh Button */}
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={fetchStats}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid rgba(0, 102, 51, 0.3)',
                borderRadius: '6px',
                color: '#006633',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
