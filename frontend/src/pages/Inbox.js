import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import logo from '../images/lasalle.jpg';
import '../styles/inbox.css';

export default function Inbox() {
  const { user, token, logout } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // 'announcement' or 'message'
  const [showModal, setShowModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeForm, setComposeForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox();
    fetchMessages();
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
    } catch (err) {
      console.error('Failed to mark message as read');
    }
  };

  const handleSelect = (item, type) => {
    setSelectedId(item.id);
    setSelectedType(type);
    setShowModal(true);
    if (!item.is_read) {
      if (type === 'announcement') {
        markAsRead(item.id);
      } else {
        markMessageAsRead(item.id);
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!composeForm.message.trim()) return;

    setSending(true);
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
        setToast({ message: 'Message sent to the committee', type: 'success' });
        setShowComposeModal(false);
        setComposeForm({ subject: '', message: '' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to send message', type: 'error' });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setToast({ message: 'Failed to send message', type: 'error' });
      setTimeout(() => setToast(null), 4000);
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
    : announcements.find(a => a.id === selectedId);
  const unreadCount = allItems.filter(item => !item.is_read).length;

  if (loading) {
    return (
      <div className="inbox-container">
        <div className="inbox-loading">
          <div className="loading-spinner"></div>
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inbox-container">
      {/* Header */}
      <header className="inbox-header">
        <div className="inbox-header-content">
          <div className="inbox-logo-section">
            <img src={logo} alt="USLS Logo" className="inbox-logo" />
            <div className="inbox-title">
              <h1>THE GOLDEN BATCH</h1>
              <span className="inbox-subtitle">25th Alumni Homecoming</span>
            </div>
          </div>
          <nav className="inbox-nav">
            <Link to="/events" className="nav-link">Events</Link>
            {user?.isAdmin && <Link to="/media" className="nav-link">Media</Link>}
            {user?.isAdmin && <Link to="/committee" className="nav-link">Committee</Link>}
            <Link to="/inbox" className="nav-link active">Inbox</Link>
            <Link to="/funds" className="nav-link">Funds</Link>
            <Link to={user?.isAdmin ? "/profile-preview" : "/profile"} className="nav-link">Profile</Link>
            {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
            <ThemeToggle />
            <button onClick={() => { logout(); window.location.href = '/login'; }} className="nav-link logout-btn">Logout</button>
          </nav>
        </div>
      </header>

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

      <main className="inbox-main">
        <div className="inbox-header-bar">
          <h2>Inbox {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</h2>
          <button
            onClick={() => setShowComposeModal(true)}
            className="btn-reply"
            style={{ marginLeft: 'auto' }}
          >
            Contact Committee
          </button>
        </div>

        {allItems.length === 0 ? (
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
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: '600',
                          background: 'rgba(207, 181, 59, 0.15)',
                          color: '#CFB53B',
                          verticalAlign: 'middle'
                        }}>
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
                    {item.type === 'message' && <span style={{ color: '#CFB53B', fontWeight: '500' }}>Committee: </span>}
                    {item.message.substring(0, 100)}{item.message.length > 100 ? '...' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Message Detail Modal */}
      {showModal && selectedItem && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            <div className="detail-header">
              <h3>
                {selectedItem.subject || '(No Subject)'}
                {selectedType === 'message' && (
                  <span style={{
                    marginLeft: '10px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    background: 'rgba(207, 181, 59, 0.15)',
                    color: '#CFB53B',
                    verticalAlign: 'middle'
                  }}>
                    Reply
                  </span>
                )}
                {selectedItem.audience === 'admins' && (
                  <span style={{
                    marginLeft: '10px',
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
              </h3>
              <span className="detail-date">{formatFullDate(selectedItem.created_at)}</span>
            </div>
            <div className="detail-body">
              {selectedItem.message.split('\n').map((line, i) => {
                // Convert URLs to clickable links
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
                          style={{ color: '#CFB53B', textDecoration: 'underline' }}
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
            <div className="detail-footer">
              <span className="detail-from">
                From: {selectedType === 'message' ? 'Committee' : 'The Organizing Committee'}
              </span>
              <button
                onClick={() => handleReplyToCommittee(selectedItem.subject)}
                className="btn-reply"
              >
                Reply to Committee
              </button>
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