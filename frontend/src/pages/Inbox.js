import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/profileNew.css';
import '../styles/inbox.css';

export default function Inbox() {
  const { user, token } = useAuth();
  const { decrementUnreadCount, refreshUnreadCount } = useInbox();
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
  const [replyToMessageId, setReplyToMessageId] = useState(null); // Track message being replied to

  useEffect(() => {
    fetchInbox();
    fetchMessages();
    fetchSentMessages();
  }, [token]);

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

  const markSentThreadAsRead = async (id) => {
    try {
      await fetch(`https://the-golden-batch-api.onrender.com/api/messages/${id}/read-thread`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update local state to reflect that replies have been read
      setSentMessages(prev =>
        prev.map(m => m.id === id ? { ...m, has_unread_reply: false } : m)
      );
      // Refresh global unread count (since it includes unread admin replies)
      refreshUnreadCount();
    } catch (err) {
      console.error('Failed to mark thread as read');
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
    // Mark sent message thread as read if it has unread admin replies
    if (type === 'sent' && item.has_unread_reply) {
      markSentThreadAsRead(item.id);
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
          message: composeForm.message,
          parent_id: replyToMessageId || null // Link to original message if replying
        })
      });

      if (res.ok) {
        setShowComposeModal(false);
        setComposeForm({ subject: '', message: '' });
        setReplyToMessageId(null); // Clear reply context
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

  const handleReplyToCommittee = (messageId, subject) => {
    setReplyToMessageId(messageId); // Store the message ID to link the reply
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
  const sentWithUnreadReplies = sentMessages.filter(m => m.has_unread_reply).length;

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
      <Navbar />
      <div className="card">
      <main className="inbox-main">
        <h2 className="inbox-title">My Inbox</h2>
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
              {sentWithUnreadReplies > 0 ? (
                <span className="unread-badge">
                  {sentWithUnreadReplies}
                </span>
              ) : sentMessages.length > 0 && (
                <span className="sent-count-badge">
                  {sentMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>
        <div style={{ marginTop: '16px', marginBottom: '20px' }}>
          <button
            onClick={() => { if (!justSent) { setReplyToMessageId(null); setComposeForm({ subject: '', message: '' }); setShowComposeModal(true); } }}
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
                  className={`message-item ${selectedId === item.id && selectedType === 'sent' ? 'selected' : ''} ${item.has_unread_reply ? 'unread' : ''}`}
                  onClick={() => handleSelect(item, 'sent')}
                >
                  <div className="message-indicator" style={{ background: item.has_unread_reply ? '#D4AF37' : item.has_reply ? '#28a745' : 'transparent' }}></div>
                  <div className="message-preview">
                    <div className="message-header">
                      <span className="message-subject">
                        {item.subject || '(No Subject)'}
                        {item.has_unread_reply ? (
                          <span style={{
                            marginLeft: '8px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: '600',
                            background: 'rgba(212, 175, 55, 0.2)',
                            color: '#D4AF37',
                            verticalAlign: 'middle'
                          }}>
                            New Reply
                          </span>
                        ) : item.has_reply && (
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
                  onClick={() => handleReplyToCommittee(selectedItem.id, selectedItem.subject)}
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
        <div className="modal-overlay" onClick={() => { setShowComposeModal(false); setReplyToMessageId(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowComposeModal(false); setReplyToMessageId(null); }}>&times;</button>
            <div className="detail-header">
              <h3>{replyToMessageId ? 'Reply to Committee' : 'Message to Committee'}</h3>
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
                  onClick={() => { setShowComposeModal(false); setReplyToMessageId(null); }}
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