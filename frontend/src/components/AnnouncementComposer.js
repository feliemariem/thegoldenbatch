import React, { useState } from 'react';

export default function AnnouncementComposer({ registeredCount = 0, goingCount = 0, maybeCount = 0, notGoingCount = 0 }) {
  const [audience, setAudience] = useState('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const getRecipientCount = () => {
    switch (audience) {
      case 'all': return registeredCount;
      case 'going': return goingCount;
      case 'maybe': return maybeCount;
      case 'not_going': return notGoingCount;
      default: return 0;
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    // Demo only - simulate sending
    setTimeout(() => {
      setResult({
        success: true,
        message: `Announcement sent to ${getRecipientCount()} recipients!`
      });
      setSending(false);
      // Clear form
      setSubject('');
      setMessage('');
    }, 1500);

    // TODO: Replace with actual API call when ready
    // try {
    //   const res = await fetch('http://localhost:5000/api/announcements', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       Authorization: `Bearer ${token}`,
    //     },
    //     body: JSON.stringify({ audience, subject, message, sendEmail }),
    //   });
    //   const data = await res.json();
    //   setResult({ success: true, message: data.message });
    // } catch (err) {
    //   setResult({ success: false, message: 'Failed to send announcement' });
    // }
  };

  return (
    <div className="invite-section">
      <h3>📢 Send Announcement</h3>
      
      <form onSubmit={handleSend}>
        <div className="form-group">
          <label>To:</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
          >
            <option value="all">All Registered ({registeredCount})</option>
            <option value="going">Going Only ({goingCount})</option>
            <option value="maybe">Maybe Only ({maybeCount})</option>
            <option value="not_going">Not Going Only ({notGoingCount})</option>
          </select>
        </div>

        <div className="form-group">
          <label>Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Event Reminder"
            required
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
          />
        </div>

        <div className="form-group">
          <label>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your announcement here..."
            required
            rows={5}
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid #ddd', 
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
            />
            Also send email notification
          </label>
        </div>

        {result && (
          <div className={`invite-result ${result.success ? 'success' : 'error'}`}>
            <p>{result.message}</p>
          </div>
        )}

        <button 
          type="submit" 
          className="btn-primary" 
          disabled={sending || getRecipientCount() === 0}
          style={{ marginTop: '8px' }}
        >
          {sending ? 'Sending...' : `Send to ${getRecipientCount()} recipient${getRecipientCount() !== 1 ? 's' : ''}`}
        </button>
      </form>
    </div>
  );
}