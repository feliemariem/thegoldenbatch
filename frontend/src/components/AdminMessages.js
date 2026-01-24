import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../api';

export default function AdminMessages({ token, onUnreadCountChange }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyForm, setReplyForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchMessages();
  }, [token]);

  const fetchMessages = async () => {
    try {
      const res = await apiGet('/api/messages/admin-inbox');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await apiPost(`/api/messages/${id}/read`, {});
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
      // Notify parent to refresh unread count
      if (onUnreadCountChange) {
        onUnreadCountChange();
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const fetchThread = async (id) => {
    setLoadingThread(true);
    try {
      const res = await apiGet(`/api/messages/thread/${id}`);
      const data = await res.json();
      setThread(data.thread || []);
    } catch (err) {
      console.error('Failed to fetch thread:', err);
      setThread([]);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSelectMessage = async (msg) => {
    setSelectedMessage(msg);
    if (!msg.is_read) {
      markAsRead(msg.id);
    }
    await fetchThread(msg.id);
  };

  const handleReply = (msg) => {
    setSelectedMessage(msg);
    setReplyForm({
      subject: msg.subject ? `Re: ${msg.subject.replace(/^Re:\s*/i, '')}` : '',
      message: ''
    });
    setShowReplyModal(true);
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyForm.message.trim()) return;

    setSending(true);
    try {
      const res = await apiPost('/api/messages/reply', {
        to_user_id: selectedMessage.from_user_id,
        subject: replyForm.subject,
        message: replyForm.message,
        parent_id: selectedMessage.id
      });

      if (res.ok) {
        // Close reply modal and clear form
        setShowReplyModal(false);
        setReplyForm({ subject: '', message: '' });

        // Update local state immediately to show "Replied" badge
        setSelectedMessage(prev => prev ? { ...prev, has_reply: true } : null);
        setMessages(prev => prev.map(m =>
          m.id === selectedMessage.id ? { ...m, has_reply: true } : m
        ));

        // Refresh thread to show the new reply
        if (selectedMessage) {
          fetchThread(selectedMessage.id);
        }
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to send reply', type: 'error' });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
      setToast({ message: 'Failed to send reply', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
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

  const getSenderName = (msg) => {
    return msg.sender_current_name || `${msg.sender_first_name || ''} ${msg.sender_last_name || ''}`.trim() || msg.sender_email || 'Unknown';
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        Loading messages...
      </div>
    );
  }

  return (
    <div className="admin-messages">
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '14px 24px',
          borderRadius: '8px',
          background: toast.type === 'success' ? 'rgba(40, 167, 69, 0.95)' : 'rgba(220, 53, 69, 0.95)',
          color: '#fff',
          fontWeight: '500',
          zIndex: 1001,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h3 className="section-title-accent" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          Shared Inbox (Admins Only)
          {unreadCount > 0 && (
            <span style={{
              background: '#dc3545',
              color: '#fff',
              padding: '2px 10px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}>
              {unreadCount} new
            </span>
          )}
        </h3>
        <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
          Messages from batchmates to the committee
        </p>
      </div>

      {messages.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          color: '#666',
          background: 'rgba(0,0,0,0.1)',
          borderRadius: '12px'
        }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No messages yet</p>
          <p style={{ fontSize: '0.9rem', color: '#888' }}>Messages from batchmates will appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => handleSelectMessage(msg)}
              className={msg.is_read ? '' : 'admin-message-unread'}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '16px 20px',
                background: msg.is_read ? 'rgba(0,0,0,0.05)' : 'rgba(184, 150, 12, 0.08)',
                border: msg.is_read ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(184, 150, 12, 0.2)',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Unread indicator */}
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: msg.is_read ? 'transparent' : 'var(--color-hover)',
                marginTop: '6px',
                flexShrink: 0
              }} />

              {/* Message content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{
                    fontWeight: msg.is_read ? '500' : '700',
                    color: msg.is_read ? '#999' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {getSenderName(msg)}
                    {msg.has_reply && (
                      <span style={{
                        padding: '2px 8px',
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
                  <span style={{ color: '#888', fontSize: '0.85rem', flexShrink: 0, marginLeft: '12px' }}>
                    {formatDate(msg.created_at)}
                  </span>
                </div>

                {msg.subject && (
                  <div style={{
                    fontWeight: '600',
                    color: msg.is_read ? '#888' : 'var(--color-hover)',
                    marginBottom: '4px',
                    fontSize: '0.95rem'
                  }}>
                    {msg.subject}
                  </div>
                )}

                <p style={{
                  margin: 0,
                  color: '#888',
                  fontSize: '0.9rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {msg.message.substring(0, 120)}{msg.message.length > 120 ? '...' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message Detail Modal - Full Thread View */}
      {selectedMessage && !showReplyModal && (
        <div
          onClick={() => { setSelectedMessage(null); setThread([]); }}
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
        >
          <div
            onClick={(e) => e.stopPropagation()}
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
          >
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {selectedMessage.subject || 'No Subject'}
                    {thread.length > 1 && (
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: '500',
                        background: 'rgba(207, 181, 59, 0.15)',
                        color: '#CFB53B'
                      }}>
                        {thread.length} messages
                      </span>
                    )}
                  </h3>
                  <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
                    Conversation with <strong style={{ color: 'var(--color-hover)' }}>{getSenderName(selectedMessage)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedMessage(null); setThread([]); }}
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

            <div style={{ padding: '20px 28px', maxHeight: '50vh', overflowY: 'auto' }}>
              {loadingThread ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  Loading conversation...
                </div>
              ) : thread.length === 0 ? (
                // Fallback to single message if thread is empty
                <div style={{
                  padding: '16px',
                  background: 'rgba(0, 102, 51, 0.1)',
                  borderRadius: '12px',
                  borderLeft: '3px solid #006633'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--color-hover)', fontWeight: '600', fontSize: '0.9rem' }}>
                      {getSenderName(selectedMessage)}
                    </span>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>
                      {formatFullDate(selectedMessage.created_at)}
                    </span>
                  </div>
                  {selectedMessage.message.split('\n').map((line, i) => (
                    <p key={i} style={{ color: '#e0e0e0', lineHeight: '1.6', margin: i === 0 ? 0 : '8px 0 0 0', fontSize: '0.95rem' }}>
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {thread.map((msg, idx) => {
                    const isFromUser = msg.from_user_id !== null;
                    const senderName = isFromUser
                      ? (msg.user_current_name || `${msg.user_first_name || ''} ${msg.user_last_name || ''}`.trim() || msg.user_email || 'User')
                      : 'Committee';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          padding: '16px',
                          background: isFromUser ? 'rgba(0, 102, 51, 0.1)' : 'rgba(207, 181, 59, 0.08)',
                          borderRadius: '12px',
                          borderLeft: `3px solid ${isFromUser ? '#006633' : '#CFB53B'}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ color: isFromUser ? 'var(--color-hover)' : '#28a745', fontWeight: '600', fontSize: '0.9rem' }}>
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
                          <span style={{ color: '#666', fontSize: '0.8rem' }}>
                            {formatFullDate(msg.created_at)}
                          </span>
                        </div>
                        {msg.message.split('\n').map((line, i) => (
                          <p key={i} style={{ color: '#e0e0e0', lineHeight: '1.6', margin: i === 0 ? 0 : '8px 0 0 0', fontSize: '0.95rem' }}>
                            {line || '\u00A0'}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{
              padding: '16px 28px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => { setSelectedMessage(null); setThread([]); }}
                className="btn-secondary"
                style={{ padding: '10px 20px' }}
              >
                Close
              </button>
              {selectedMessage.from_user_id && (
                <button
                  onClick={() => handleReply(selectedMessage)}
                  className="btn-primary"
                  style={{ padding: '10px 20px', width: 'auto', marginTop: 0 }}
                >
                  {selectedMessage.has_reply ? 'Reply Again' : 'Reply'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && selectedMessage && (
        <div
          onClick={() => setShowReplyModal(false)}
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
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(165deg, rgba(30, 40, 35, 0.98) 0%, rgba(20, 28, 24, 0.99) 100%)',
              border: '1px solid rgba(207, 181, 59, 0.2)',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                Reply to {getSenderName(selectedMessage)}
              </h3>
            </div>

            <form onSubmit={handleSendReply} style={{ padding: '24px 28px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '0.9rem' }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={replyForm.subject}
                  onChange={(e) => setReplyForm({ ...replyForm, subject: e.target.value })}
                  placeholder="Subject (optional)"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '0.9rem' }}>
                  Message *
                </label>
                <textarea
                  value={replyForm.message}
                  onChange={(e) => setReplyForm({ ...replyForm, message: e.target.value })}
                  placeholder="Write your reply..."
                  required
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowReplyModal(false)}
                  className="btn-secondary"
                  style={{ padding: '10px 20px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={sending || !replyForm.message.trim()}
                  style={{ padding: '10px 24px', width: 'auto', marginTop: 0 }}
                >
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
