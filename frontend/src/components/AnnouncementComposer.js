import React, { useState, useEffect } from 'react';

export default function AnnouncementComposer({ token, registeredCount = 0, goingCount = 0, maybeCount = 0, notGoingCount = 0, adminsCount = 0 }) {
  const [audience, setAudience] = useState('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [viewAnnouncement, setViewAnnouncement] = useState(null);

  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [showHistory]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/announcements/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data.announcements || []);
    } catch (err) {
      console.error('Failed to fetch history');
    }
  };

  const getRecipientCount = () => {
    switch (audience) {
      case 'all': return registeredCount;
      case 'admins': return adminsCount;
      case 'going': return goingCount;
      case 'maybe': return maybeCount;
      case 'not_going': return notGoingCount;
      default: return 0;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setResult(null);

    // Capture current audience value to ensure it's sent correctly
    const currentAudience = audience;
    console.log('Sending announcement with audience:', currentAudience);

    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ audience: currentAudience, subject, message, sendEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message });
        setSubject('');
        setMessage('');
        if (showHistory) fetchHistory();
      } else {
        setResult({ success: false, message: data.error || 'Failed to send announcement' });
      }
    } catch (err) {
      console.error('Send error:', err);
      setResult({ success: false, message: 'Failed to connect to server. Check if backend is running.' });
    } finally {
      setSending(false);
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

  const getAudienceLabel = (aud) => {
    switch (aud) {
      case 'all': return 'All Registered';
      case 'admins': return 'Admins Only';
      case 'going': return 'Going Only';
      case 'maybe': return 'Maybe Only';
      case 'not_going': return 'Not Going Only';
      default: return aud;
    }
  };

  return (
    <div>
      <div className="invite-section">
        <h3>Send Announcement</h3>
        <p style={{ color: '#888', marginBottom: '20px' }}>
          Send email announcements to registered batchmates.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>To:</label>
            <select
              value={audience}
              onChange={(e) => {
                const newValue = e.target.value;
                console.log('Audience dropdown onChange fired - new value:', newValue, 'previous value:', audience);
                setAudience(newValue);
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)',
                color: '#e0e0e0',
                fontSize: '1rem'
              }}
            >
              <option value="all">All Registered ({registeredCount})</option>
              <option value="admins">Admins Only ({adminsCount})</option>
              <option value="going">Going Only ({goingCount})</option>
              <option value="maybe">Maybe Only ({maybeCount})</option>
              <option value="not_going">Not Going Only ({notGoingCount})</option>
            </select>
            {/* DEBUG: Remove this after fixing the issue */}
            <p style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '4px' }}>
              DEBUG - Current audience state: "{audience}"
            </p>
          </div>

          <div className="form-group">
            <label>Subject:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Event Reminder, Venue Update"
              required
            />
          </div>

          <div className="form-group">
            <label>Message:</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement here..."
              required
              rows={6}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)',
                color: '#e0e0e0',
                fontSize: '1rem',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span className="announce-send-email-text">Send email to recipients</span>
            </label>

            {!sendEmail && (
              <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '4px' }}>
                (Announcement will be logged but no emails sent)
              </p>
            )}
          </div>

          {result && (
            <div className={`invite-result ${result.success ? 'success' : 'error'}`}>
              <p>{result.message}</p>
            </div>
          )}

          {/* Send Button + Confirm Popup */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={sending || getRecipientCount() === 0}
              style={{ marginTop: '8px', width: 'auto', padding: '12px 24px' }}
            >
              {sending ? 'Sending...' : `Send to ${getRecipientCount()} recipient${getRecipientCount() !== 1 ? 's' : ''}`}
            </button>

            {showConfirm && (
              <div className="announce-confirm">
                <p className="announce-confirm__text">
                  Send this announcement to <strong>{getRecipientCount()}</strong> recipient{getRecipientCount() !== 1 ? 's' : ''}?
                </p>

                <div className="announce-confirm__actions">
                  <button type="button" onClick={handleConfirmSend} className="announce-confirm__yes">
                    Yes, Send
                  </button>
                  <button type="button" onClick={() => setShowConfirm(false)} className="announce-confirm__no">
                    Cancel
                  </button>
                </div>

                <div className="announce-confirm__arrow" />
              </div>
            )}
          </div>
        </form>
      </div>

      {/* History Section (outside the form) */}
      <div className="users-section" style={{ marginTop: '32px' }}>
        <div className="section-header">
          <h4>Announcement History</h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            {showHistory && history.length > 0 && (
              <button
                onClick={() => {
                  const headers = ['Date', 'Subject', 'Audience', 'Message', 'Recipients', 'Sent', 'Failed', 'Sent By'];
                  const rows = history.map(a => [
                    new Date(a.created_at).toLocaleString(),
                    a.subject,
                    a.audience,
                    a.message.replace(/"/g, '""'),
                    a.recipients_count,
                    a.emails_sent,
                    a.emails_failed,
                    a.sent_by || ''
                  ]);
                  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'announcement-history.csv';
                  a.click();
                }}
                className="btn-secondary"
              >
                Export CSV
              </button>
            )}

            <button onClick={() => setShowHistory(!showHistory)} className="btn-secondary">
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {showHistory && (
          history.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((ann) => (
                <div
                  key={ann.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h5 style={{ margin: 0, color: '#CFB53B' }}>{ann.subject}</h5>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>{formatDate(ann.created_at)}</span>
                  </div>

                  <p style={{ color: '#999', fontSize: '0.85rem', margin: '8px 0' }}>
                    {ann.message.length > 150 ? ann.message.substring(0, 150) + '...' : ann.message}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#666', alignItems: 'center' }}>
                    <span>To: {getAudienceLabel(ann.audience)}</span>
                    <span>Sent: {ann.emails_sent}/{ann.recipients_count}</span>
                    {ann.emails_failed > 0 && (
                      <span style={{ color: '#dc3545' }}>Failed: {ann.emails_failed}</span>
                    )}
                    <button
                      onClick={() => setViewAnnouncement(ann)}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: '#CFB53B',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        textDecoration: 'underline'
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No announcements sent yet</p>
          )
        )}
      </div>

      {/* View Announcement Modal */}
      {viewAnnouncement && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setViewAnnouncement(null)}
        >
          <div
            style={{
              background: '#1e1e1e',
              border: '1px solid rgba(207, 181, 59, 0.3)',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ... keep your existing modal inner content unchanged ... */}
          </div>
        </div>
      )}
    </div>
  );
}