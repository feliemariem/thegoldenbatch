import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';
import '../styles/inbox.css';

export default function Inbox() {
  const { user, token, logout } = useAuth();
  const { decrementUnreadCount } = useInbox();
  const location = useLocation();
  const [announcements, setAnnouncements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // 'announcement', 'message', or 'sent'
  const [showModal, setShowModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeForm, setComposeForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' or 'sent'
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const eventsDropdownRef = useRef(null);

  useEffect(() => {
    fetchInbox();
    fetchMessages();
    fetchSentMessages();
  }, [token]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eventsDropdownRef.current && !eventsDropdownRef.current.contains(event.target)) {
        setEventsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInbox = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/announcements/inbox', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (err) {
      console.error('Failed to fetch inbox');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/messages/user-inbox', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages');
    }
  };

  const fetchSentMessages = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/messages/user-sent', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSentMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to fetch sent messages');
    }
  };

  const fetchThread = async (id) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/messages/thread/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setThread(data.thread || []);
    } catch (err) {
      console.error('Failed to fetch thread:', err);
      setThread([]);
    } finally {
      setLoadingThread(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await fetch(`https://the-golden-batch-api.onrender.com/api/announcements/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update local state
      setAnnouncements(prev =>
        prev.map(a => a.id === id ? { ...a, is_read: true } : a)
      );
      // Update global unread count
      decrementUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read');
    }
  };

  const markMessageAsRead = async (id) => {
    try {
      await fetch(`https://the-golden-batch-api.onrender.com/api/messages/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, is_read: true } : m)
      );
      // Update global unread count
      decrementUnreadCount();
    } catch (err) {
      console.error('Failed to mark message as read');
    }
  };

  const handleSelect = async (item, type) => {
    setSelectedId(item.id);
    setSelectedType(type);
    setShowModal(true);
    if (!item.is_read) {
      if (type === 'announcement') {
        markAsRead(item.id);
      } else if (type === 'message') {
        markMessageAsRead(item.id);
      }
    }
    // Fetch thread for messages and sent messages
    if (type === 'message' || type === 'sent') {
      await fetchThread(item.id);
    } else {
      setThread([]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!composeForm.message.trim()) return;

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/messages/to-committee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: composeForm.subject,
          message: composeForm.message
        })
      });

      if (res.ok) {
        setShowComposeModal(false);
        setComposeForm({ subject: '', message: '' });
        fetchSentMessages(); // Refresh sent messages
        // Show success state on button
        setJustSent(true);
        setTimeout(() => setJustSent(false), 2500);
      } else {
        const data = await res.json();
        setSendError(data.error || 'Failed to send message');
        setTimeout(() => setSendError(null), 4000);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendError('Failed to send message');
      setTimeout(() => setSendError(null), 4000);
    } finally {
      setSending(false);
    }
  };

  const handleReplyToCommittee = (subject) => {
    setComposeForm({
      subject: subject ? `Re: ${subject.replace(/^Re:\s*/i, '')}` : '',
      message: ''
    });
    setShowModal(false);
    setShowComposeModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedId(null);
    setSelectedType(null);
    setThread([]);
  };

  // Combine announcements and messages into a single sorted list
  const allItems = [
    ...announcements.map(a => ({ ...a, type: 'announcement' })),
    ...messages.map(m => ({ ...m, type: 'message' }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      // Today - show time
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      // Within a week - show day name
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      // Older - show date
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
  };

  const formatFullDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const selectedItem = selectedType === 'message'
    ? messages.find(m => m.id === selectedId)
    : selectedType === 'sent'
    ? sentMessages.find(m => m.id === selectedId)
    : announcements.find(a => a.id === selectedId);
  const unreadCount = allItems.filter(item => !item.is_read).length;
  const sentWithReplies = sentMessages.filter(m => m.has_reply).length;

  if (loading) {
    return (
      <div className="container admin-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container admin-container">
      <div className="card">
        {/* Header */}
        <header className="profile-header">
          <div className="profile-header-content">
            <div className="profile-logo-section">
              <img src={logo} alt="USLS Logo" className="profile-logo" />
              <div className="profile-title">
                <h1>THE GOLDEN BATCH</h1>
                <span className="profile-subtitle">25th Alumni Homecoming</span>
              </div>
            </div>
            <nav className="nav-section">
              <div className={`nav-dropdown ${eventsDropdownOpen ? 'open' : ''}`} ref={eventsDropdownRef}>
                <button
                  className={`nav-dropdown-trigger ${location.pathname === '/events' || location.pathname === '/media' ? 'active' : ''} ${eventsDropdownOpen ? 'open' : ''}`}
                  onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
                >
                  Events <span className="dropdown-arrow">▼</span>
                </button>
                <div className="nav-dropdown-menu">
                  <Link to="/events" className={`nav-dropdown-item ${location.pathname === '/events' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Upcoming</Link>
                  <Link to="/media" className={`nav-dropdown-item ${location.pathname === '/media' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Media</Link>
                </div>
              </div>
              {user?.isAdmin && <Link to="/committee" className="nav-link">Committee</Link>}
              {user?.isAdmin && <Link to="/directory" className="nav-link">Directory</Link>}
              <Link to="/funds" className="nav-link">Funds</Link>
              <Link to="/inbox" className="nav-link active">Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</Link>
              <Link to={user?.isAdmin ? "/profile-preview" : "/profile"} className="nav-link">Profile</Link>
              {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
              <button onClick={() => { logout(); window.location.href = '/login'; }} className="nav-link logout-btn">Logout</button>
            </nav>
        </div>
      </header>

      <main className="inbox-main">
        <h2 className="inbox-title">Shared Inbox</h2>
        <div className="inbox-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <button
              onClick={() => setActiveTab('inbox')}
              className={`inbox-tab ${activeTab === 'inbox' ? 'active' : ''}`}
            >
              Inbox
              {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`inbox-tab ${activeTab === 'sent' ? 'active' : ''}`}
            >
              Sent Messages
              {sentMessages.length > 0 && (
                <span className="sent-count-badge">
                  {sentMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>
        <div style={{ marginTop: '16px', marginBottom: '20px' }}>
          <button
            onClick={() => !justSent && setShowComposeModal(true)}
            className={`btn-reply ${justSent ? 'btn-success-state' : ''}`}
            disabled={justSent}
          >
            {justSent ? 'Message Sent ✓' : 'Contact Committee'}
          </button>
          {sendError && (
            <span style={{ marginLeft: '12px', color: '#dc3545', fontSize: '0.85rem' }}>
              {sendError}
            </span>
          )}
        </div>

        {activeTab === 'inbox' ? (
          // Inbox Tab - Announcements and Replies from Committee
          allItems.length === 0 ? (
            <div className="inbox-empty">
              <p>No messages yet</p>
              <span>Announcements from the committee will appear here</span>
            </div>
          ) : (
            <div className="message-list">
              {allItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`message-item ${selectedId === item.id && selectedType === item.type ? 'selected' : ''} ${!item.is_read ? 'unread' : ''}`}
                  onClick={() => handleSelect(item, item.type)}
                >
                  <div className="message-indicator"></div>
                  <div className="message-preview">
                    <div className="message-header">
                      <span className="message-subject">
                        {item.subject || '(No Subject)'}
                        {item.type === 'message' && (
                          <span className="inbox-reply-badge">
                            Reply
                          </span>
                        )}
                        {item.audience === 'admins' && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: '600',
                            background: 'rgba(220, 53, 69, 0.15)',
                            color: '#dc3545',
                            verticalAlign: 'middle'
                          }}>
                            Admin Only
                          </span>
                        )}
                      </span>
                      <span className="message-date">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="message-snippet">
                      {item.type === 'message' && <span className="inbox-committee-prefix">Committee: </span>}
                      {item.message.substring(0, 100)}{item.message.length > 100 ? '...' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Sent Messages Tab
          sentMessages.length === 0 ? (
            <div className="inbox-empty">
              <p>No sent messages</p>
              <span>Messages you send to the committee will appear here</span>
            </div>
          ) : (
            <div className="message-list">
              {sentMessages.map((item) => (
                <div
                  key={`sent-${item.id}`}
                  className={`message-item ${selectedId === item.id && selectedType === 'sent' ? 'selected' : ''}`}
                  onClick={() => handleSelect(item, 'sent')}
                >
                  <div className="message-indicator" style={{ background: item.has_reply ? '#28a745' : 'transparent' }}></div>
                  <div className="message-preview">
                    <div className="message-header">
                      <span className="message-subject">
                        {item.subject || '(No Subject)'}
                        {item.has_reply && (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: '600',
                            background: 'rgba(40, 167, 69, 0.15)',
                            color: '#28a745',
                            verticalAlign: 'middle'
                          }}>
                            Replied
                          </span>
                        )}
                      </span>
                      <span className="message-date">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="message-snippet">
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>To Committee: </span>
                      {item.message.substring(0, 100)}{item.message.length > 100 ? '...' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

      </main>
      </div>
      <Footer />

      {/* Message Detail Modal */}
      {showModal && selectedItem && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh' }}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            <div className="detail-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {selectedItem.subject || '(No Subject)'}
                {selectedType === 'sent' && selectedItem.has_reply && (
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    background: 'rgba(40, 167, 69, 0.15)',
                    color: '#28a745',
                    verticalAlign: 'middle'
                  }}>
                    Replied
                  </span>
                )}
                {selectedType === 'message' && (
                  <span className="inbox-detail-reply-badge">
                    Reply
                  </span>
                )}
                {selectedItem.audience === 'admins' && (
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    background: 'rgba(220, 53, 69, 0.15)',
                    color: '#dc3545',
                    verticalAlign: 'middle'
                  }}>
                    Admin Only
                  </span>
                )}
                {(selectedType === 'message' || selectedType === 'sent') && thread.length > 1 && (
                  <span className="inbox-thread-count">
                    {thread.length} messages
                  </span>
                )}
              </h3>
              {selectedType === 'announcement' && (
                <span className="detail-date">{formatFullDate(selectedItem.created_at)}</span>
              )}
            </div>

            <div className="detail-body" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {selectedType === 'announcement' ? (
                // Announcement - show single message
                selectedItem.message.split('\n').map((line, i) => {
                  const urlRegex = /(https?:\/\/[^\s]+)/g;
                  const parts = line.split(urlRegex);
                  return (
                    <p key={i}>
                      {parts.map((part, j) =>
                        urlRegex.test(part) ? (
                          <a
                            key={j}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="modal-link"
                          >
                            {part}
                          </a>
                        ) : (
                          part || '\u00A0'
                        )
                      )}
                    </p>
                  );
                })
              ) : loadingThread ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  Loading conversation...
                </div>
              ) : thread.length === 0 ? (
                // Fallback to single message
                <div className={`thread-message-card ${selectedType === 'sent' ? 'from-user' : 'from-committee'}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span className={`thread-sender ${selectedType === 'sent' ? 'user' : 'committee'}`}>
                      {selectedType === 'sent' ? 'You' : 'Committee'}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {formatFullDate(selectedItem.created_at)}
                    </span>
                  </div>
                  {selectedItem.message.split('\n').map((line, i) => (
                    <p key={i} style={{ lineHeight: '1.6', margin: i === 0 ? 0 : '8px 0 0 0', fontSize: '0.95rem' }}>
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              ) : (
                // Full thread view
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {thread.map((msg) => {
                    const isFromUser = msg.from_user_id !== null;
                    const senderName = isFromUser ? 'You' : 'Committee';
                    return (
                      <div
                        key={msg.id}
                        className={`thread-message-card ${isFromUser ? 'from-user' : 'from-committee'}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                          <span className={`thread-sender ${isFromUser ? 'user' : 'committee'}`}>
                            {senderName}
                            {!isFromUser && (
                              <span style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.6rem',
                                fontWeight: '600',
                                background: 'rgba(40, 167, 69, 0.15)',
                                color: '#28a745'
                              }}>
                                Reply
                              </span>
                            )}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {formatFullDate(msg.created_at)}
                          </span>
                        </div>
                        {msg.message.split('\n').map((line, i) => {
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          const parts = line.split(urlRegex);
                          return (
                            <p key={i} style={{ lineHeight: '1.6', margin: i === 0 ? 0 : '8px 0 0 0', fontSize: '0.95rem' }}>
                              {parts.map((part, j) =>
                                urlRegex.test(part) ? (
                                  <a
                                    key={j}
                                    href={part}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="modal-link"
                                  >
                                    {part}
                                  </a>
                                ) : (
                                  part || '\u00A0'
                                )
                              )}
                            </p>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="detail-footer">
              <span className="detail-from">
                {selectedType === 'sent'
                  ? 'To: Committee'
                  : `From: ${selectedType === 'message' ? 'Committee' : 'The Organizing Committee'}`}
              </span>
              {selectedType !== 'sent' && (
                <button
                  onClick={() => handleReplyToCommittee(selectedItem.subject)}
                  className="btn-reply"
                >
                  Reply to Committee
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compose Message Modal */}
      {showComposeModal && (
        <div className="modal-overlay" onClick={() => setShowComposeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowComposeModal(false)}>&times;</button>
            <div className="detail-header">
              <h3>Message to Committee</h3>
            </div>
            <form onSubmit={handleSendMessage} style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                  placeholder="Subject"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Message *
                </label>
                <textarea
                  value={composeForm.message}
                  onChange={(e) => setComposeForm({ ...composeForm, message: e.target.value })}
                  placeholder="Write your message to the committee..."
                  required
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                Your message will be sent to the organizing committee and they will respond in your inbox.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || !composeForm.message.trim()}
                  className="btn-reply"
                  style={{ opacity: sending || !composeForm.message.trim() ? 0.6 : 1 }}
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}