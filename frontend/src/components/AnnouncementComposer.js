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
  const [showConfirm, setShowConfirm] = useState(false);
  const [viewAnnouncement, setViewAnnouncement] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = React.useRef(null);

  // Super admin only features (id=1)
  const isSuperAdmin = user?.id === 1;
  const [template, setTemplate] = useState('standard');
  const [testMode, setTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('felie@fnrcore.com');

  // Batch rep deadline (hardcoded for now - can be fetched from DB later)
  const batchRepDeadline = new Date('2026-03-14T08:00:00+08:00');
  const daysRemaining = Math.max(0, Math.ceil((batchRepDeadline - new Date()) / (1000 * 60 * 60 * 24)));

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

  // When template changes to batchrep, lock audience to graduates
  useEffect(() => {
    if (template === 'batchrep') {
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
    if (template === 'batchrep') return graduatesCount;
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirm(false);
    setSending(true);
    setResult(null);

    try {
      const payload = {
        audience: template === 'batchrep' ? 'graduates' : audience,
        subject: template === 'batchrep' ? 'The batch needs to hear from you.' : subject,
        message: template === 'batchrep' ? 'Submit your response on the two official nominees for Batch 2003.' : message,
        sendEmail,
        template: template === 'batchrep' ? 'batchrep' : undefined,
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
    return `Send to ${getRecipientCount()} recipient${getRecipientCount() !== 1 ? 's' : ''}`;
  };

  // Styles for super admin features
  const superAdminStyles = {
    templatePicker: {
      background: 'linear-gradient(135deg, rgba(207, 181, 59, 0.15) 0%, rgba(207, 181, 59, 0.05) 100%)',
      border: '1px solid rgba(207, 181, 59, 0.3)',
      borderRadius: '10px',
      padding: '14px',
      marginBottom: '16px'
    },
    templateLabel: {
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#CFB53B',
      marginBottom: '8px'
    },
    templateSelect: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: '1px solid rgba(207, 181, 59, 0.3)',
      background: 'rgba(0,0,0,0.3)',
      color: '#e0e0e0',
      fontSize: '14px',
      cursor: 'pointer'
    },
    batchRepCard: {
      background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.2) 0%, rgba(0, 102, 51, 0.1) 100%)',
      border: '1px solid rgba(0, 102, 51, 0.3)',
      borderRadius: '10px',
      padding: '16px'
    },
    batchRepTag: {
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#CFB53B',
      background: '#0d1a14',
      display: 'inline-block',
      padding: '3px 8px',
      borderRadius: '4px',
      marginBottom: '10px'
    },
    batchRepTitle: {
      fontSize: '15px',
      color: '#e0e0e0',
      marginBottom: '12px',
      fontWeight: '600'
    },
    nomineeRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      padding: '10px 12px',
      marginBottom: '8px'
    },
    nomineeAvatar: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: '#006633',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontWeight: '700',
      color: 'white',
      flexShrink: 0
    },
    nomineeRole: {
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#006633',
      marginBottom: '2px'
    },
    nomineeName: {
      fontSize: '13px',
      fontWeight: '700',
      color: '#e0e0e0'
    },
    deadlineRow: {
      fontSize: '11px',
      color: '#888',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexWrap: 'wrap',
      marginTop: '8px'
    },
    deadlineDate: {
      color: '#c0392b',
      fontWeight: '700'
    },
    deadlineDays: {
      background: 'rgba(255, 193, 7, 0.2)',
      border: '1px solid rgba(255, 193, 7, 0.5)',
      borderRadius: '4px',
      padding: '1px 7px',
      fontSize: '10px',
      fontWeight: '700',
      color: '#ffc107'
    },
    lockedAudience: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(0, 102, 51, 0.15)',
      border: '1px solid rgba(0, 102, 51, 0.3)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '13px',
      color: '#4CAF50',
      fontWeight: '600'
    },
    testRow: {
      background: 'linear-gradient(135deg, rgba(207, 181, 59, 0.15) 0%, rgba(207, 181, 59, 0.05) 100%)',
      border: '1px solid rgba(207, 181, 59, 0.3)',
      borderRadius: '8px',
      padding: '12px 14px',
      marginBottom: '12px'
    },
    testRowTop: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    testLabel: {
      fontSize: '12px',
      fontWeight: '700',
      color: '#CFB53B'
    },
    testHint: {
      fontSize: '11px',
      color: 'rgba(207, 181, 59, 0.7)'
    },
    toggleWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    toggle: {
      position: 'relative',
      width: '36px',
      height: '20px',
      cursor: 'pointer'
    },
    toggleTrack: (isOn) => ({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: isOn ? '#CFB53B' : 'rgba(255,255,255,0.2)',
      borderRadius: '20px',
      transition: 'background 0.2s'
    }),
    toggleThumb: (isOn) => ({
      position: 'absolute',
      width: '14px',
      height: '14px',
      left: isOn ? '19px' : '3px',
      top: '3px',
      background: 'white',
      borderRadius: '50%',
      transition: 'left 0.2s'
    }),
    toggleText: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#CFB53B'
    },
    twoCol: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '28px',
      alignItems: 'start'
    },
    previewCol: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    previewHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    previewBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: '#0d1a14',
      color: '#CFB53B',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      padding: '4px 10px',
      borderRadius: '4px'
    },
    previewDot: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: '#CFB53B',
      animation: 'pulse 1.5s infinite'
    },
    previewHint: {
      fontSize: '11px',
      color: '#888'
    },
    emailShell: {
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      overflow: 'hidden',
      background: 'white',
      fontFamily: 'Arial, sans-serif'
    },
    emailHeader: {
      background: '#0d1a14',
      padding: '16px',
      textAlign: 'center'
    },
    emailLogo: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: '#CFB53B',
      margin: '0 auto 8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      fontWeight: '700',
      color: '#0d1a14'
    },
    emailTitle: {
      color: '#CFB53B',
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '2px',
      fontFamily: 'Georgia, serif'
    },
    emailSub: {
      color: '#fff',
      fontSize: '10px',
      letterSpacing: '1px',
      marginTop: '3px',
      fontFamily: 'Georgia, serif'
    },
    emailBody: {
      padding: '18px 16px',
      background: 'white'
    },
    emailGreeting: {
      fontSize: '14px',
      fontWeight: '700',
      marginBottom: '10px',
      color: '#1a1a1a'
    },
    emailCard: {
      background: '#fafafa',
      borderLeft: '3px solid #CFB53B',
      borderRadius: '6px',
      padding: '14px',
      marginBottom: '14px'
    },
    emailCta: {
      display: 'block',
      background: '#006633',
      color: 'white',
      textAlign: 'center',
      padding: '12px',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: '700',
      marginBottom: '10px',
      textDecoration: 'none'
    },
    emailFootnote: {
      fontSize: '10px',
      color: '#999',
      textAlign: 'center'
    },
    emailFooter: {
      background: '#0d1a14',
      padding: '12px',
      textAlign: 'center',
      fontSize: '11px',
      color: '#CFB53B'
    },
    inboxPreview: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      padding: '14px',
      fontSize: '13px'
    }
  };

  // Email preview component for standard template
  const StandardEmailPreview = () => (
    <div style={superAdminStyles.emailShell}>
      <div style={superAdminStyles.emailHeader}>
        <div style={superAdminStyles.emailLogo}>GB</div>
        <div style={superAdminStyles.emailTitle}>THE GOLDEN BATCH 2003</div>
        <div style={superAdminStyles.emailSub}>UNIVERSITY OF ST. LA SALLE - IS · 25th Alumni Homecoming</div>
      </div>
      <div style={superAdminStyles.emailBody}>
        <div style={superAdminStyles.emailGreeting}>Hi [First Name],</div>
        <div style={superAdminStyles.emailCard}>
          <div style={{ fontSize: '13px', color: '#1a1a1a', marginBottom: '6px', fontWeight: '600' }}>
            You have a new message in your Inbox!
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Subject: <strong style={{ color: subject ? '#006633' : '#bbb', fontStyle: subject ? 'normal' : 'italic' }}>
              {subject || 'your subject will appear here'}
            </strong>
          </div>
        </div>
        <div style={superAdminStyles.emailCta}>View Message →</div>
        <div style={superAdminStyles.emailFootnote}>Log in to thegoldenbatch2003.com to read the full message.</div>
      </div>
      <div style={superAdminStyles.emailFooter}>
        © USLS-IS Golden Batch 2003 · <span style={{ color: '#fff' }}>Questions? </span>uslsis.batch2003@gmail.com
      </div>
    </div>
  );

  // Email preview component for batch rep template
  const BatchRepEmailPreview = () => (
    <div style={superAdminStyles.emailShell}>
      <div style={superAdminStyles.emailHeader}>
        <div style={superAdminStyles.emailLogo}>GB</div>
        <div style={superAdminStyles.emailTitle}>THE GOLDEN BATCH 2003</div>
        <div style={superAdminStyles.emailSub}>UNIVERSITY OF ST. LA SALLE - IS · 25th Alumni Homecoming</div>
      </div>
      <div style={superAdminStyles.emailBody}>
        <div style={superAdminStyles.emailGreeting}>Hi [First Name],</div>
        <div style={{ fontSize: '13px', color: '#444', lineHeight: '1.6', marginBottom: '14px' }}>
          The organizing committee has been working behind the scenes. Now it's time for the batch to choose who will represent Batch 2003 for <strong>two official positions</strong>.
        </div>
        <div style={{ ...superAdminStyles.nomineeRow, background: '#f0f9f4', border: '1px solid #c8e6d4' }}>
          <div style={{ ...superAdminStyles.nomineeAvatar, width: '30px', height: '30px', fontSize: '10px' }}>BJ</div>
          <div>
            <div style={{ ...superAdminStyles.nomineeRole, color: '#006633' }}>Nominee · Alumni Assoc. Representative</div>
            <div style={{ ...superAdminStyles.nomineeName, color: '#1a1a1a', fontSize: '12px' }}>Bianca Jison</div>
          </div>
        </div>
        <div style={{ ...superAdminStyles.nomineeRow, background: '#f0f9f4', border: '1px solid #c8e6d4' }}>
          <div style={{ ...superAdminStyles.nomineeAvatar, width: '30px', height: '30px', fontSize: '10px' }}>FM</div>
          <div>
            <div style={{ ...superAdminStyles.nomineeRole, color: '#006633' }}>Nominee · Batch Representative</div>
            <div style={{ ...superAdminStyles.nomineeName, color: '#1a1a1a', fontSize: '12px' }}>Felie Magbanua</div>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', margin: '10px 0 14px' }}>
          <span>⏱ Feedback window closes</span>
          <span style={{ color: '#c0392b', fontWeight: '700' }}>
            {batchRepDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at 8:00 AM PHT
          </span>
          <span style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: '700', color: '#856404' }}>
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
          </span>
        </div>
        <div style={superAdminStyles.emailCta}>Submit My Response →</div>
        <div style={superAdminStyles.emailFootnote}>You'll be asked to log in. The voting modal will open automatically.</div>
      </div>
      <div style={superAdminStyles.emailFooter}>
        © USLS-IS Golden Batch 2003 · <span style={{ color: '#fff' }}>Questions? </span>uslsis.batch2003@gmail.com
      </div>
    </div>
  );

  // Inbox preview component
  const InboxPreviewCard = () => {
    const previewSubject = template === 'batchrep' ? 'The batch needs to hear from you.' : subject;
    const previewMessage = template === 'batchrep' ? 'Submit your response on the two official nominees for Batch 2003.' : message;

    return (
      <div style={superAdminStyles.inboxPreview}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontWeight: '700', color: previewSubject ? '#e0e0e0' : '#666', fontStyle: previewSubject ? 'normal' : 'italic' }}>
            {previewSubject || 'Subject will appear here'}
          </span>
          <span style={{ fontSize: '11px', color: '#666' }}>just now</span>
        </div>
        <div style={{ fontSize: '12px', color: previewMessage ? '#888' : '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: previewMessage ? 'normal' : 'italic' }}>
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
        <div style={superAdminStyles.templatePicker}>
          <div style={superAdminStyles.templateLabel}>⚡ Email Template <span style={{ fontSize: '9px', opacity: 0.7 }}>(Super Admin only)</span></div>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            style={superAdminStyles.templateSelect}
          >
            <option value="standard">✉️ Standard Announcement</option>
            <option value="batchrep">🗳️ Batch Rep Notification</option>
          </select>
        </div>
      )}

      {/* Audience Selector or Locked Audience */}
      {template === 'batchrep' ? (
        <div className="form-group">
          <label>To:</label>
          <div style={superAdminStyles.lockedAudience}>
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
      {template === 'batchrep' ? (
        <div style={superAdminStyles.batchRepCard}>
          <div style={superAdminStyles.batchRepTag}>⚡ Quick Batch Input</div>
          <div style={superAdminStyles.batchRepTitle}>The batch needs to hear from you.</div>
          <div style={superAdminStyles.nomineeRow}>
            <div style={superAdminStyles.nomineeAvatar}>BJ</div>
            <div>
              <div style={superAdminStyles.nomineeRole}>Nominee · Alumni Assoc. Representative</div>
              <div style={superAdminStyles.nomineeName}>Bianca Jison</div>
            </div>
          </div>
          <div style={superAdminStyles.nomineeRow}>
            <div style={superAdminStyles.nomineeAvatar}>FM</div>
            <div>
              <div style={superAdminStyles.nomineeRole}>Nominee · Batch Representative</div>
              <div style={superAdminStyles.nomineeName}>Felie Magbanua</div>
            </div>
          </div>
          <div style={superAdminStyles.deadlineRow}>
            <span>⏱ Feedback window closes</span>
            <span style={superAdminStyles.deadlineDate}>
              {batchRepDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at 8:00 AM PHT
            </span>
            <span style={superAdminStyles.deadlineDays}>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left</span>
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '12px' }}>
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
        </>
      )}

      {/* Test Mode - Super Admin Only */}
      {isSuperAdmin && (
        <div style={superAdminStyles.testRow}>
          <div style={superAdminStyles.testRowTop}>
            <div>
              <div style={superAdminStyles.testLabel}>🧪 Test Mode</div>
              <div style={superAdminStyles.testHint}>Send to yourself before the full blast</div>
            </div>
            <div style={superAdminStyles.toggleWrap}>
              <div
                style={superAdminStyles.toggle}
                onClick={() => setTestMode(!testMode)}
              >
                <div style={superAdminStyles.toggleTrack(testMode)} />
                <div style={superAdminStyles.toggleThumb(testMode)} />
              </div>
              <span style={superAdminStyles.toggleText}>{testMode ? 'On' : 'Off'}</span>
            </div>
          </div>
          {testMode && (
            <div style={{ marginTop: '8px' }}>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(207, 181, 59, 0.3)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#e0e0e0',
                  fontSize: '14px'
                }}
              />
            </div>
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
          style={{
            marginTop: '8px',
            width: 'auto',
            padding: '12px 24px',
            background: testMode ? '#b8960c' : undefined
          }}
        >
          {getSendButtonLabel()}
        </button>

        {showConfirm && (
          <div className="announce-confirm">
            <p className="announce-confirm__text">
              {testMode ? (
                <>Send test email to <strong>{testEmail}</strong>?</>
              ) : template === 'batchrep' ? (
                <>Send Batch Rep Notification to <strong>{graduatesCount}</strong> graduates?</>
              ) : (
                <>Send this announcement to <strong>{getRecipientCount()}</strong> recipient{getRecipientCount() !== 1 ? 's' : ''}?</>
              )}
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
    </>
  );

  return (
    <div>
      <div className="invite-section">
        <h3>Send Announcement</h3>
        <p style={{ color: '#888', marginBottom: '20px' }}>
          Send email announcements to registered batchmates.
        </p>

        <form onSubmit={handleSubmit}>
          {isSuperAdmin ? (
            // Two-column layout for super admin
            <div style={superAdminStyles.twoCol}>
              <div className="form-col">
                {renderFormContent()}
              </div>
              <div style={superAdminStyles.previewCol}>
                <div style={superAdminStyles.previewHeader}>
                  <div style={superAdminStyles.previewBadge}>
                    <span style={superAdminStyles.previewDot} />
                    Live Preview
                  </div>
                  <div style={superAdminStyles.previewHint}>What recipients will receive</div>
                </div>
                {template === 'batchrep' ? <BatchRepEmailPreview /> : <StandardEmailPreview />}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#888', marginBottom: '8px' }}>
                    What they see in their Inbox
                  </div>
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
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h5 className="announcement-history-title">{ann.subject}</h5>
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
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
              background: 'linear-gradient(165deg, rgba(30, 40, 35, 0.98) 0%, rgba(20, 28, 24, 0.99) 100%)',
              border: '1px solid rgba(207, 181, 59, 0.2)',
              borderRadius: '16px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {viewAnnouncement.subject}
                  </h3>
                  <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
                    Sent to <strong style={{ color: '#CFB53B' }}>{getAudienceLabel(viewAnnouncement.audience)}</strong>
                    {viewAnnouncement.sent_by && (
                      <span> by {viewAnnouncement.sent_by}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setViewAnnouncement(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    color: '#888',
                    cursor: 'pointer',
                    padding: '0 8px'
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 28px' }}>
              <div style={{
                padding: '16px',
                background: 'rgba(0, 102, 51, 0.1)',
                borderRadius: '12px',
                borderLeft: '3px solid #006633'
              }}>
                {viewAnnouncement.message.split('\n').map((line, i) => (
                  <p key={i} style={{ color: '#e0e0e0', lineHeight: '1.6', margin: i === 0 ? 0 : '8px 0 0 0', fontSize: '0.95rem' }}>
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>

              {/* Meta info */}
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.85rem', color: '#888' }}>
                <span>
                  <strong style={{ color: '#999' }}>Date:</strong> {formatDate(viewAnnouncement.created_at)}
                </span>
                <span>
                  <strong style={{ color: '#999' }}>Recipients:</strong> {viewAnnouncement.recipients_count}
                </span>
                <span>
                  <strong style={{ color: '#28a745' }}>Sent:</strong> {viewAnnouncement.emails_sent}
                </span>
                {viewAnnouncement.emails_failed > 0 && (
                  <span style={{ color: '#dc3545' }}>
                    <strong>Failed:</strong> {viewAnnouncement.emails_failed}
                  </span>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 28px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
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
      `}</style>
    </div>
  );
}
