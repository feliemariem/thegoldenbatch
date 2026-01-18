import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import logo from '../images/lasalle.jpg';
import '../styles/inbox.css';

export default function Inbox() {
  const { user, token, logout } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox();
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

  const handleSelect = (announcement) => {
    setSelectedId(announcement.id);
    setShowModal(true);
    if (!announcement.is_read) {
      markAsRead(announcement.id);
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

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

  const selectedAnnouncement = announcements.find(a => a.id === selectedId);
  const unreadCount = announcements.filter(a => !a.is_read).length;

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
            <Link to="/inbox" className="nav-link active">Inbox</Link>
            <Link to="/funds" className="nav-link">Funds</Link>
            <Link to="/profile" className="nav-link">Profile</Link>
            {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
            <ThemeToggle />
            <button onClick={() => { logout(); window.location.href = '/login'; }} className="nav-link logout-btn">Logout</button>
          </nav>
        </div>
      </header>

      <main className="inbox-main">
        <div className="inbox-header-bar">
          <h2>Inbox {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</h2>
        </div>

        {announcements.length === 0 ? (
          <div className="inbox-empty">
            <p>No messages yet</p>
            <span>Announcements from the committee will appear here</span>
          </div>
        ) : (
          <div className="message-list">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`message-item ${selectedId === announcement.id ? 'selected' : ''} ${!announcement.is_read ? 'unread' : ''}`}
                onClick={() => handleSelect(announcement)}
              >
                <div className="message-indicator"></div>
                <div className="message-preview">
                  <div className="message-header">
                    <span className="message-subject">{announcement.subject}</span>
                    <span className="message-date">{formatDate(announcement.created_at)}</span>
                  </div>
                  <p className="message-snippet">
                    {announcement.message.substring(0, 100)}{announcement.message.length > 100 ? '...' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Message Detail Modal */}
      {showModal && selectedAnnouncement && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            <div className="detail-header">
              <h3>{selectedAnnouncement.subject}</h3>
              <span className="detail-date">{formatFullDate(selectedAnnouncement.created_at)}</span>
            </div>
            <div className="detail-body">
              {selectedAnnouncement.message.split('\n').map((line, i) => {
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
              <span className="detail-from">From: The Organizing Committee</span>
              <a 
                href={`mailto:uslsis.batch2003@gmail.com?subject=Re: [USLS-IS Batch 2003] ${encodeURIComponent(selectedAnnouncement.subject)}`}
                className="btn-reply"
              >
                Reply to Committee
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}