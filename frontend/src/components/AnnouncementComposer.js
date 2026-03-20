import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

export default function AnnouncementComposer({ registeredCount = 0, goingCount = 0, maybeCount = 0, notGoingCount = 0, fullAdminsCount = 0, registryAdminsCount = 0, graduatesCount = 0, user = null }) {
  const [audience, setAudience] = useState('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewAnnouncement, setViewAnnouncement] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  // Super admin only features (id=1)
  const isSuperAdmin = user?.id === 1;
  const [template, setTemplate] = useState('standard');
  const [testMode, setTestMode] = useState(true);
  const [testEmail, setTestEmail] = useState('felie@fnrcore.com');

  // Batch rep deadline (hardcoded for now - can be fetched from DB later)
  const batchRepDeadline = new Date('2026-03-21T23:59:00+08:00');
  const daysRemaining = Math.max(0, Math.ceil((batchRepDeadline - new Date()) / (1000 * 60 * 60 * 24)));

  // Round 2 voting deadline
  const round2Deadline = new Date('2026-03-30T23:59:00+08:00');
  const round2DaysRemaining = Math.max(0, Math.ceil((round2Deadline - new Date()) / (1000 * 60 * 60 * 24)));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When template changes to batchrep or round2voting, lock audience to graduates
  useEffect(() => {
    if (template === 'batchrep' || template === 'round2voting') {
      // Both batch rep templates lock to graduates audience
      setAudience('graduates');
    }
  }, [template]);

  const audienceOptions = [
    { value: 'all', label: `All Registered (${registeredCount})`, isAdmin: false },
    { value: 'full_admins', label: `Full Admins Only (${fullAdminsCount})`, isAdmin: true },
    { value: 'registry_admins', label: `Registry Admins Only (${registryAdminsCount})`, isAdmin: true },
    { value: 'graduates', label: `Graduates Only (${graduatesCount})`, isAdmin: false },
    { value: 'going', label: `Going Only (${goingCount})`, isAdmin: false },
    { value: 'maybe', label: `Maybe Only (${maybeCount})`, isAdmin: false },
    { value: 'not_going', label: `Not Going Only (${notGoingCount})`, isAdmin: false },
  ];

  const selectedOption = audienceOptions.find(opt => opt.value === audience);

  const handleSelectAudience = (value) => {
    setAudience(value);
    setDropdownOpen(false);
  };

  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [showHistory]);

  const fetchHistory = async () => {
    try {
      const res = await apiGet('/api/announcements/history');
      const data = await res.json();
      setHistory(data.announcements || []);
    } catch (err) {
      console.error('Failed to fetch history');
    }
  };

  const getRecipientCount = () => {
    if (testMode) return 1;
    if (template === 'batchrep' || template === 'round2voting') return graduatesCount;
    switch (audience) {
      case 'all': return registeredCount;
      case 'full_admins': return fullAdminsCount;
      case 'registry_admins': return registryAdminsCount;
      case 'graduates': return graduatesCount;
      case 'going': return goingCount;
      case 'maybe': return maybeCount;
      case 'not_going': return notGoingCount;
      default: return 0;
    }
  };

  const getAudienceLabelForConfirm = () => {
    if (template === 'batchrep' || template === 'round2voting') return 'graduates';
    switch (audience) {
      case 'all': return 'registered batchmates';
      case 'full_admins': return 'full admins';
      case 'registry_admins': return 'registry admins';
      case 'graduates': return 'graduates';
      case 'going': return 'people going';
      case 'maybe': return 'people marked as maybe';
      case 'not_going': return 'people not going';
      default: return 'recipients';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Skip confirmation in test mode
    if (testMode) {
      handleConfirmSend();
      return;
    }

    // Show native confirm dialog when test mode is off
    const count = getRecipientCount();
    const audienceLabel = getAudienceLabelForConfirm();
    const confirmed = window.confirm(
      `You're about to send to ${count} ${audienceLabel}. This cannot be undone. Are you sure?`
    );

    if (confirmed) {
      handleConfirmSend();
    }
  };

  const handleConfirmSend = async () => {
    setSending(true);
    setResult(null);

    try {
      const isTemplateLocked = template === 'batchrep' || template === 'round2voting';
      const payload = {
        audience: isTemplateLocked ? 'graduates' : audience,
        subject: template === 'batchrep'
          ? 'The batch needs to hear from you.'
          : template === 'round2voting'
            ? 'Your vote is needed — Round 2'
            : subject,
        message: template === 'batchrep'
          ? 'Submit your response on the two official nominees for Batch 2003.'
          : template === 'round2voting'
            ? 'Cast your vote for Alumni Association Representative. Two candidates — Bianca Jison and Mel Andrea Rivero. Log in and the voting modal will open automatically.'
            : message,
        sendEmail,
        // Pass template name to backend for correct email HTML
        template: template !== 'standard' ? template : undefined,
        testMode: testMode ? true : undefined,
        testEmail: testMode ? testEmail : undefined
      };

      const res = await apiPost('/api/announcements', payload);
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message });
        if (template === 'standard') {
          setSubject('');
          setMessage('');
        }
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
      case 'full_admins': return 'Full Admins Only';
      case 'registry_admins': return 'Registry Admins Only';
      case 'admins': return 'Admins Only'; // Legacy support
      case 'graduates': return 'Graduates Only';
      case 'going': return 'Going Only';
      case 'maybe': return 'Maybe Only';
      case 'not_going': return 'Not Going Only';
      default: return aud;
    }
  };

  const getSendButtonLabel = () => {
    if (sending) return 'Sending...';
    if (testMode) return `Send Test to ${testEmail}`;
    if (template === 'batchrep') return `Send Batch Rep Notification to ${graduatesCount} graduates`;
    if (template === 'round2voting') return `Send Round 2 Voting Email to ${graduatesCount} graduates`;
    return `Send to ${getRecipientCount()} recipient${getRecipientCount() !== 1 ? 's' : ''}`;
  };

  // Email preview component for standard template
  const StandardEmailPreview = () => (
    <div className="sa-email-shell">
      <div className="sa-email-header">
        <div className="sa-email-logo">GB</div>
        <div className="sa-email-title">THE GOLDEN BATCH 2003</div>
        <div className="sa-email-sub">UNIVERSITY OF ST. LA SALLE - IS · 25th Alumni Homecoming</div>
      </div>
      <div className="sa-email-body">
        <div className="sa-email-greeting">Hi [First Name],</div>
        <div className="sa-email-card">
          <div className="sa-email-new-msg">You have a new message in your Inbox!</div>
          <div className="sa-email-subject-line">
            Subject: <strong className={subject ? 'sa-email-subject-text' : 'sa-email-subject-text placeholder'}>
              {subject || 'your subject will appear here'}
            </strong>
          </div>
        </div>
        <div className="sa-email-cta">View Message →</div>
        <div className="sa-email-footnote">Log in to thegoldenbatch2003.com to read the full message.</div>
      </div>
      <div className="sa-email-footer">
        © USLS-IS Golden Batch 2003 · <span>Questions? </span>uslsis.batch2003@gmail.com
      </div>
    </div>
  );

  // Email preview component for batch rep template
  const BatchRepEmailPreview = () => (
    <div className="sa-email-shell">
      <div className="sa-email-header">
        <div className="sa-email-logo">GB</div>
        <div className="sa-email-title">THE GOLDEN BATCH 2003</div>
        <div className="sa-email-sub">UNIVERSITY OF ST. LA SALLE - IS · 25th Alumni Homecoming</div>
      </div>
      <div className="sa-email-body">
        <div className="sa-email-greeting">Hi [First Name],</div>
        <div className="sa-email-intro">
          The organizing committee has been working behind the scenes. Now it's time for the batch to choose who will represent Batch 2003 for <strong>two official positions</strong>.
        </div>
        <div className="sa-email-nominee-row">
          <div className="sa-email-nominee-avatar">BJ</div>
          <div>
            <div className="sa-email-nominee-role">Nominee · Alumni Assoc. Representative</div>
            <div className="sa-email-nominee-name">Bianca Jison</div>
          </div>
        </div>
        <div className="sa-email-nominee-row">
          <div className="sa-email-nominee-avatar">FM</div>
          <div>
            <div className="sa-email-nominee-role">Nominee · Batch Representative</div>
            <div className="sa-email-nominee-name">Felie Magbanua</div>
          </div>
        </div>
        <div className="sa-email-deadline">
          <span>⏱ Feedback window closes</span>
          <span className="sa-email-deadline-date">
            {batchRepDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at 11:59 PM PHT
          </span>
          <span className="sa-email-deadline-days">
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
          </span>
        </div>
        <div className="sa-email-cta">Submit My Response →</div>
        <div className="sa-email-footnote">You'll be asked to log in. The voting modal will open automatically.</div>
      </div>
      <div className="sa-email-footer">
        © USLS-IS Golden Batch 2003 · <span>Questions? </span>uslsis.batch2003@gmail.com
      </div>
    </div>
  );

  // Email preview component for round 2 voting template
  const Round2VotingEmailPreview = () => (
    <div className="sa-email-shell">
      <div className="sa-email-header">
        <div className="sa-email-logo">GB</div>
        <div className="sa-email-title">THE GOLDEN BATCH 2003</div>
        <div className="sa-email-sub">UNIVERSITY OF ST. LA SALLE - IS · 25th Alumni Homecoming</div>
      </div>
      <div className="sa-email-body">
        <div className="sa-email-greeting">Hi [First Name],</div>
        <div className="sa-email-intro">
          In Round 1, the batch was asked to confirm the organizing committee's nominee for <strong>Alumni Association Representative</strong>. A batchmate was nominated and confirmed their willingness to serve, which means it goes to a batch vote. This is your vote.
        </div>
        {/* Candidate cards */}
        <div className="sa-nominee-row" style={{ background: '#f0f9f4', border: '1px solid #c8e6d4', borderRadius: '8px', padding: '12px 14px', marginBottom: '10px' }}>
          <div>
            <div className="sa-nominee-role">Position 1 · Alumni Association Representative</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <div className="sa-nominee-avatar">BJ</div>
              <div>
                <div className="sa-nominee-name">Bianca Jison</div>
                <div className="sa-nominee-role">Committee Nominee</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <div className="sa-nominee-avatar" style={{ background: '#27ae60' }}>MR</div>
              <div>
                <div className="sa-nominee-name">Mel Andrea Rivero</div>
                <div className="sa-nominee-role" style={{ color: '#27ae60' }}>Willing / Nominated</div>
              </div>
            </div>
          </div>
        </div>
        <div className="sa-email-deadline">
          <span>Voting closes</span>
          <span className="sa-email-deadline-date">
            {round2Deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at 11:59 PM PHT
          </span>
          <span className="sa-email-deadline-days">
            {round2DaysRemaining} day{round2DaysRemaining !== 1 ? 's' : ''} left
          </span>
        </div>
        <div className="sa-email-cta">Submit Vote →</div>
        <div className="sa-email-footnote">Log in and the voting modal will open automatically.</div>
      </div>
      <div className="sa-email-footer">
        © USLS-IS Golden Batch 2003 · <span>Questions? </span>uslsis.batch2003@gmail.com
      </div>
    </div>
  );

  // Inbox preview component
  const InboxPreviewCard = () => {
    const previewSubject = template === 'batchrep'
      ? 'The batch needs to hear from you.'
      : template === 'round2voting'
        ? 'Your vote is needed — Round 2'
        : subject;
    const previewMessage = template === 'batchrep'
      ? 'Submit your response on the two official nominees for Batch 2003.'
      : template === 'round2voting'
        ? 'Cast your vote for Alumni Association Representative. Two candidates — Bianca Jison and Mel Andrea Rivero.'
        : message;

    return (
      <div className="sa-inbox-preview">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className={`sa-inbox-subject ${!previewSubject ? 'placeholder' : ''}`}>
            {previewSubject || 'Subject will appear here'}
          </span>
          <span className="sa-inbox-time">just now</span>
        </div>
        <div className={`sa-inbox-message ${!previewMessage ? 'placeholder' : ''}`}>
          {previewMessage || 'Your message will appear here...'}
        </div>
      </div>
    );
  };

  // Form content (shared between layouts)
  const renderFormContent = () => (
    <>
      {/* Template Picker - Super Admin Only */}
      {isSuperAdmin && (
        <div className="sa-template-picker">
          <div className="sa-template-label">⚡ Email Template <span style={{ fontSize: '9px', opacity: 0.7 }}>(Super Admin only)</span></div>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="sa-template-select"
          >
            <option value="standard">✉️ Standard Announcement</option>
            <option value="batchrep">🗳️ Batch Rep Notification</option>
            {/* Round 2 voting template — user.id === 1 only */}
            {user?.id === 1 && (
              <option value="round2voting">🗳️ Round 2 · AA Rep Voting</option>
            )}
          </select>
        </div>
      )}

      {/* Audience Selector or Locked Audience */}
      {(template === 'batchrep' || template === 'round2voting') ? (
        <div className="form-group">
          <label>To:</label>
          <div className="sa-locked-audience">
            🔒 Graduates Only ({graduatesCount}) — locked for this template
          </div>
        </div>
      ) : (
        <div className="form-group">
          <label>To:</label>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`announce-dropdown-trigger ${selectedOption?.isAdmin ? 'admin-selected' : ''}`}
            >
              <span>{selectedOption?.label}</span>
              <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>▼</span>
            </button>

            {dropdownOpen && (
              <div className="announce-dropdown-menu">
                {audienceOptions.map((option, index) => {
                  const prevOption = audienceOptions[index - 1];
                  const nextOption = audienceOptions[index + 1];
                  const isFirstAdmin = option.isAdmin && (!prevOption || !prevOption.isAdmin);
                  const isLastAdmin = option.isAdmin && (!nextOption || !nextOption.isAdmin);

                  return (
                    <React.Fragment key={option.value}>
                      {isFirstAdmin && (
                        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255, 107, 107, 0.5), transparent)', margin: '4px 0' }} />
                      )}
                      <div
                        onClick={() => handleSelectAudience(option.value)}
                        className={`announce-dropdown-item ${audience === option.value ? 'selected' : ''} ${option.isAdmin ? 'admin-option' : ''}`}
                      >
                        {option.label}
                      </div>
                      {isLastAdmin && (
                        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255, 107, 107, 0.5), transparent)', margin: '4px 0' }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Standard Fields or Batch Rep Card */}
      {template === 'round2voting' ? (
        // Round 2 voting template card — user.id === 1 only
        <div className="sa-batchrep-card">
          <div className="sa-batchrep-tag">🗳️ Round 2 · AA Rep Vote</div>
          <div className="sa-batchrep-title">Your vote is needed — Round 2</div>
          <div className="sa-nominee-row">
            <div className="sa-nominee-avatar">BJ</div>
            <div>
              <div className="sa-nominee-role">Position 1 · Alumni Assoc. Representative</div>
              <div className="sa-nominee-name">Bianca Jison</div>
            </div>
          </div>
          <div className="sa-nominee-row">
            <div className="sa-nominee-avatar" style={{ background: '#27ae60' }}>MR</div>
            <div>
              <div className="sa-nominee-role" style={{ color: '#27ae60' }}>Willing / Nominated</div>
              <div className="sa-nominee-name">Mel Andrea Rivero</div>
            </div>
          </div>
          <div className="sa-deadline-row">
            <span>Voting closes</span>
            <span className="sa-deadline-date">
              {round2Deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at 11:59 PM PHT
            </span>
            <span className="sa-deadline-days">{round2DaysRemaining} day{round2DaysRemaining !== 1 ? 's' : ''} left</span>
          </div>
          <div className="sa-batchrep-note">
            Responses are confidential. Votes are final. CTA links to /login — modal opens automatically.
          </div>
        </div>
      ) : template === 'batchrep' ? (
        <div className="sa-batchrep-card">
          <div className="sa-batchrep-tag">⚡ Quick Batch Input</div>
          <div className="sa-batchrep-title">The batch needs to hear from you.</div>
          <div className="sa-nominee-row">
            <div className="sa-nominee-avatar">BJ</div>
            <div>
              <div className="sa-nominee-role">Nominee · Alumni Assoc. Representative</div>
              <div className="sa-nominee-name">Bianca Jison</div>
            </div>
          </div>
          <div className="sa-nominee-row">
            <div className="sa-nominee-avatar">FM</div>
            <div>
              <div className="sa-nominee-role">Nominee · Batch Representative</div>
              <div className="sa-nominee-name">Felie Magbanua</div>
            </div>
          </div>
          <div className="sa-deadline-row">
            <span>⏱ Feedback window closes</span>
            <span className="sa-deadline-date">
              {batchRepDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at 11:59 PM PHT
            </span>
            <span className="sa-deadline-days">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left</span>
          </div>
          <div className="sa-batchrep-note">
            This template is pre-formatted. Recipients will see the nominee cards and a login CTA.
          </div>
        </div>
      ) : (
        <>
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
            />
          </div>
        </>
      )}

      {/* Test Mode - Super Admin Only */}
      {isSuperAdmin && (
        <div className="sa-test-row">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="sa-test-label">🧪 Test Mode</div>
              <div className="sa-test-hint">Send to yourself before the full blast</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{ position: 'relative', width: '36px', height: '20px', cursor: 'pointer' }}
                onClick={() => setTestMode(!testMode)}
              >
                <div className={`sa-toggle-track ${testMode ? 'active' : ''}`} />
                <div style={{
                  position: 'absolute',
                  width: '14px',
                  height: '14px',
                  left: testMode ? '19px' : '3px',
                  top: '3px',
                  background: 'white',
                  borderRadius: '50%',
                  transition: 'left 0.2s'
                }} />
              </div>
              <span className="sa-toggle-text">{testMode ? 'On' : 'Off'}</span>
            </div>
          </div>
          {testMode && (
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="sa-test-email-input"
            />
          )}
        </div>
      )}

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
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            (Announcement will be logged but no emails sent)
          </p>
        )}
      </div>

      {result && (
        <div className={`invite-result ${result.success ? 'success' : 'error'}`}>
          <p>{result.message}</p>
        </div>
      )}

      <button
        type="submit"
        className={`btn-primary ${testMode ? 'sa-test-send-btn' : ''}`}
        disabled={sending || getRecipientCount() === 0}
        style={{ marginTop: '8px', width: 'auto', padding: '12px 24px' }}
      >
        {getSendButtonLabel()}
      </button>
    </>
  );

  return (
    <div>
      <div className="invite-section">
        <h3>Send Announcement</h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
          Send email announcements to registered batchmates.
        </p>

        <form onSubmit={handleSubmit}>
          {isSuperAdmin ? (
            // Two-column layout for super admin
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>
              <div className="form-col">
                {renderFormContent()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="sa-preview-badge">
                    <span className="sa-preview-dot" />
                    Live Preview
                  </div>
                  <div className="sa-preview-hint">What recipients will receive</div>
                </div>
                {template === 'round2voting'
                  ? <Round2VotingEmailPreview />
                  : template === 'batchrep'
                    ? <BatchRepEmailPreview />
                    : <StandardEmailPreview />}
                <div>
                  <div className="sa-section-label">What they see in their Inbox</div>
                  <InboxPreviewCard />
                </div>
              </div>
            </div>
          ) : (
            // Single column layout for regular users
            renderFormContent()
          )}
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
                  className="sa-history-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h5 className="announcement-history-title">{ann.subject}</h5>
                    <span className="sa-history-date">{formatDate(ann.created_at)}</span>
                  </div>

                  <p className="sa-history-message">
                    {ann.message.length > 150 ? ann.message.substring(0, 150) + '...' : ann.message}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', alignItems: 'center' }} className="sa-history-meta">
                    <span>To: {getAudienceLabel(ann.audience)}</span>
                    <span>Sent: {ann.emails_sent}/{ann.recipients_count}</span>
                    {ann.emails_failed > 0 && (
                      <span style={{ color: '#dc3545' }}>Failed: {ann.emails_failed}</span>
                    )}
                    <button
                      onClick={() => setViewAnnouncement(ann)}
                      className="announcement-view-link"
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
          className="modal-overlay"
          onClick={() => setViewAnnouncement(null)}
        >
          <div
            className="modal-content modal-large"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--color-border, rgba(255,255,255,0.1))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {viewAnnouncement.subject}
                  </h3>
                  <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                    Sent to <strong style={{ color: 'var(--color-accent)' }}>{getAudienceLabel(viewAnnouncement.audience)}</strong>
                    {viewAnnouncement.sent_by && (
                      <span> by {viewAnnouncement.sent_by}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setViewAnnouncement(null)}
                  className="modal-close"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 28px' }}>
              <div className="sa-modal-message-box">
                {viewAnnouncement.message.split('\n').map((line, i) => (
                  <p key={i} style={{ color: 'var(--color-text-primary)', lineHeight: '1.6', margin: i === 0 ? 0 : '8px 0 0 0', fontSize: '0.95rem' }}>
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>

              {/* Meta info */}
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                <span>
                  <strong>Date:</strong> {formatDate(viewAnnouncement.created_at)}
                </span>
                <span>
                  <strong>Recipients:</strong> {viewAnnouncement.recipients_count}
                </span>
                <span>
                  <strong style={{ color: 'var(--color-status-positive)' }}>Sent:</strong> {viewAnnouncement.emails_sent}
                </span>
                {viewAnnouncement.emails_failed > 0 && (
                  <span style={{ color: 'var(--color-status-negative)' }}>
                    <strong>Failed:</strong> {viewAnnouncement.emails_failed}
                  </span>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 28px',
              borderTop: '1px solid var(--color-border, rgba(255,255,255,0.1))',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setViewAnnouncement(null)}
                className="btn-secondary"
                style={{ padding: '10px 20px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .sa-preview-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
