import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';

export default function EmailLog() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEmailLog();
  }, []);

  const fetchEmailLog = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/announcements/email-log');
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      } else {
        setError('Failed to load email log');
      }
    } catch (err) {
      console.error('Failed to fetch email log:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getStatusDot = (status) => {
    if (status === 'deferred') {
      return <span className="email-log-status-dot deferred" title="Deferred" />;
    }
    if (status === 'failed') {
      return <span className="email-log-status-dot failed" title="Failed" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="email-log-section">
        <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
          Loading email log...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="email-log-section">
        <p style={{ color: 'var(--color-status-negative)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="email-log-section">
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
        Emails with delivery issues in the last 7 days.
      </p>

      {emails.length === 0 ? (
        <div className="email-log-empty">
          <span className="email-log-empty-icon">&#10003;</span>
          <p>No issues in the last 7 days</p>
        </div>
      ) : (
        <div className="email-log-table-wrapper">
          <table className="email-log-table">
            <thead>
              <tr>
                <th>Date Sent</th>
                <th>Recipient Name</th>
                <th>Email Address</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id}>
                  <td>{formatDate(email.created_at)}</td>
                  <td>{email.recipient_name || '—'}</td>
                  <td>{email.recipient_email}</td>
                  <td>
                    <span className="email-log-status">
                      {getStatusDot(email.status)}
                      <span className={`email-log-status-text ${email.status}`}>
                        {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .email-log-section {
          padding: 0;
        }

        .email-log-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          background: var(--color-bg-card);
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }

        .email-log-empty-icon {
          font-size: 2rem;
          color: var(--color-status-positive);
          margin-bottom: 12px;
        }

        .email-log-empty p {
          color: var(--color-text-secondary);
          margin: 0;
          font-size: 0.95rem;
        }

        .email-log-table-wrapper {
          overflow-x: auto;
        }

        .email-log-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .email-log-table th,
        .email-log-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid var(--color-border);
        }

        .email-log-table th {
          color: var(--color-text-secondary);
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: var(--color-bg-card);
        }

        .email-log-table td {
          color: var(--color-text-primary);
        }

        .email-log-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .email-log-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .email-log-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .email-log-status-dot.deferred {
          background: #f39c12;
        }

        .email-log-status-dot.failed {
          background: #e74c3c;
        }

        .email-log-status-text.deferred {
          color: #f39c12;
        }

        .email-log-status-text.failed {
          color: #e74c3c;
        }
      `}</style>
    </div>
  );
}
