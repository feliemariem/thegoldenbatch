import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';

export default function Media() {
  const { user, token, logout } = useAuth();
  const { unreadCount } = useInbox();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('all');
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const eventsDropdownRef = useRef(null);

  // Mock data for albums
  const mockAlbums = [
    {
      id: 1,
      title: 'High School Days',
      description: 'Memories from our time at USLS-IS',
      coverImage: 'https://placehold.co/400x300/1a2a1f/CFB53B?text=HS+Days',
      mediaCount: 24,
      type: 'photos',
      items: [
        { id: 1, type: 'photo', url: 'https://placehold.co/800x600/1a2a1f/CFB53B?text=Photo+1', caption: 'Class photo 2003' },
        { id: 2, type: 'photo', url: 'https://placehold.co/800x600/1a2a1f/CFB53B?text=Photo+2', caption: 'Graduation day' },
        { id: 3, type: 'photo', url: 'https://placehold.co/800x600/1a2a1f/CFB53B?text=Photo+3', caption: 'Sports fest' },
        { id: 4, type: 'photo', url: 'https://placehold.co/800x600/1a2a1f/CFB53B?text=Photo+4', caption: 'Field trip' },
      ]
    },
    {
      id: 2,
      title: '10th Year Reunion (2013)',
      description: 'Our first major reunion gathering',
      coverImage: 'https://placehold.co/400x300/1a2a1f/006633?text=10th+Reunion',
      mediaCount: 56,
      type: 'mixed',
      items: [
        { id: 1, type: 'photo', url: 'https://placehold.co/800x600/1a2a1f/006633?text=Reunion+1', caption: 'Group photo' },
        { id: 2, type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://placehold.co/800x450/1a2a1f/006633?text=Video', caption: 'Reunion highlights' },
        { id: 3, type: 'photo', url: 'https://placehold.co/800x600/1a2a1f/006633?text=Reunion+2', caption: 'Dance floor' },
      ]
    },
    {
      id: 3,
      title: '20th Year Reunion (2023)',
      description: 'Celebrating two decades of friendship',
      coverImage: 'https://placehold.co/400x300/1a2a1f/CFB53B?text=20th+Reunion',
      mediaCount: 89,
      type: 'mixed',
      items: [
        { id: 1, type: 'photo', url: 'https://placehold.co/800x600/1a2a1f/CFB53B?text=20th+Photo', caption: 'The gang back together' },
        { id: 2, type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://placehold.co/800x450/1a2a1f/CFB53B?text=Video', caption: 'Anniversary video' },
      ]
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setAlbums(mockAlbums);
      setLoading(false);
    }, 500);
  }, []);

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

  const filteredAlbums = albums.filter(album => {
    if (activeTab === 'all') return true;
    if (activeTab === 'photos') return album.type === 'photos' || album.type === 'mixed';
    if (activeTab === 'videos') return album.type === 'videos' || album.type === 'mixed';
    return true;
  });

  const openLightbox = (media, index) => {
    setLightboxMedia(media);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxMedia(null);
    setLightboxIndex(0);
  };

  const navigateLightbox = (direction) => {
    if (!selectedAlbum) return;
    const items = selectedAlbum.items;
    let newIndex = lightboxIndex + direction;
    if (newIndex < 0) newIndex = items.length - 1;
    if (newIndex >= items.length) newIndex = 0;
    setLightboxIndex(newIndex);
    setLightboxMedia(items[newIndex]);
  };

  // Album Grid View
  const AlbumGrid = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
      {filteredAlbums.map(album => (
        <div
          key={album.id}
          onClick={() => setSelectedAlbum(album)}
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          className="album-card"
        >
          <div style={{ position: 'relative', paddingTop: '66.67%', overflow: 'hidden' }}>
            <img
              src={album.coverImage}
              alt={album.title}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.3s ease',
              }}
            />
            <div style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '0.7rem',
            }}>
              {album.mediaCount} items
            </div>
          </div>
          <div style={{ padding: '12px' }}>
            <h4 style={{ color: '#CFB53B', marginBottom: '4px', fontSize: '0.9rem' }}>{album.title}</h4>
            <p style={{ color: '#888', fontSize: '0.75rem', margin: 0 }}>{album.description}</p>
          </div>
        </div>
      ))}
    </div>
  );

  // Album Detail View
  const AlbumDetail = () => (
    <div>
      <button
        onClick={() => setSelectedAlbum(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          color: '#CFB53B',
          fontSize: '0.85rem',
          cursor: 'pointer',
          padding: '0',
          marginBottom: '16px',
        }}
      >
        Back to Albums
      </button>

      <h3 style={{ color: '#CFB53B', marginBottom: '6px', fontSize: '1.1rem' }}>{selectedAlbum.title}</h3>
      <p style={{ color: '#888', margin: '0 0 16px 0', fontSize: '0.85rem' }}>{selectedAlbum.description}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
        {selectedAlbum.items.map((item, index) => (
          <div
            key={item.id}
            onClick={() => openLightbox(item, index)}
            style={{
              position: 'relative',
              paddingTop: '100%',
              borderRadius: '8px',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
            className="media-item"
          >
            <img
              src={item.type === 'video' ? item.thumbnail : item.url}
              alt={item.caption}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {item.type === 'video' && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '36px',
                height: '36px',
                background: 'rgba(0, 102, 51, 0.9)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}>

              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Lightbox Modal
  const Lightbox = () => {
    if (!lightboxMedia) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={closeLightbox}
      >
        <button
          onClick={closeLightbox}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#fff',
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
        >
          x
        </button>

        {selectedAlbum && selectedAlbum.items.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
              style={{
                position: 'absolute',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                fontSize: '1.5rem',
                cursor: 'pointer',
              }}
            >

            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
              style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                fontSize: '1.5rem',
                cursor: 'pointer',
              }}
            >

            </button>
          </>
        )}

        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '90vw',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {lightboxMedia.type === 'video' ? (
            <iframe
              src={lightboxMedia.url}
              style={{
                width: '80vw',
                maxWidth: '900px',
                height: '50.625vw',
                maxHeight: '506px',
                border: 'none',
                borderRadius: '12px',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <img
              src={lightboxMedia.url}
              alt={lightboxMedia.caption}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                borderRadius: '12px',
              }}
            />
          )}
          <p style={{ color: '#e0e0e0', marginTop: '16px', fontSize: '0.95rem', textAlign: 'center' }}>
            {lightboxMedia.caption}
          </p>
        </div>
      </div>
    );
  };

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
            <div className="nav-section">
              <div className="nav-logout-row">
                <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
              </div>
              <nav className="profile-nav">
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
                <Link to="/inbox" className="nav-link">Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</Link>
                <Link to={user?.isAdmin ? "/profile-preview" : "/profile"} className="nav-link">Profile</Link>
                {user?.isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
              </nav>
            </div>
        </div>
      </header>

      <main className="profile-main">
        {/* Page Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h2 style={{ color: '#CFB53B', marginBottom: '8px', fontSize: '1.8rem' }}>Media Hub</h2>
          <p style={{ color: '#888', fontSize: '1rem' }}>Videos, news, and memories from Batch 2003</p>
        </div>

        {/* Two Column Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
        }} className="media-grid">
          {/* Left Column - Featured Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Featured Hype Video */}
            <div className="media-card-green" style={{
              background: '#1a2a1f',
              border: '2px solid rgba(207, 181, 59, 0.25)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(207, 181, 59, 0.1)',
            }}>
              {/* Header with film emoji */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 className="media-card-heading" style={{
                  color: '#CFB53B',
                  fontSize: '1.4rem',
                  fontWeight: '600',
                  margin: '0 0 8px 0',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}>
                  <span role="img" aria-label="film">🎬</span>
                  Coming Soon: The Golden Batch Hype Video
                </h3>
                <div style={{
                  width: '60px',
                  height: '3px',
                  background: 'linear-gradient(90deg, transparent, #CFB53B, transparent)',
                  margin: '0 auto',
                  borderRadius: '2px',
                }}></div>
              </div>

              {/* Responsive 16:9 Video Container */}
              <div style={{
                position: 'relative',
                paddingTop: '56.25%', /* 16:9 Aspect Ratio */
                background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.15) 0%, rgba(0, 0, 0, 0.3) 100%)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(207, 181, 59, 0.15)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              }}>
                <iframe
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                  title="The Golden Batch Hype Video Preview"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {/* Caption */}
              <p style={{
                textAlign: 'center',
                color: '#9a9a9a',
                fontSize: '0.9rem',
                fontStyle: 'italic',
                marginTop: '16px',
                marginBottom: '0',
                letterSpacing: '0.02em',
              }}>
                <span role="img" aria-label="sparkles">✨</span> Stay tuned for our official 25th reunion hype video! <span role="img" aria-label="sparkles">✨</span>
              </p>
            </div>

            {/* News Cards */}
            <div className="media-card-green" style={{
              background: '#1a2a1f',
              border: '1px solid rgba(207, 181, 59, 0.12)',
              borderRadius: '16px',
              padding: '20px',
            }}>
              <h3 className="media-card-heading" style={{ color: '#CFB53B', marginBottom: '16px', fontSize: '1.1rem' }}>Latest News</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* News Item 1 */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  borderLeft: '3px solid #CFB53B',
                }}>
                  <span style={{ color: '#CFB53B', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fundraising</span>
                  <h4 style={{ color: '#e0e0e0', fontSize: '0.95rem', margin: '6px 0', fontWeight: '500' }}>Fundraising Drive Reaches 50% of Goal</h4>
                  <p style={{ color: '#888', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>Thanks to generous contributions, we're halfway to our target for the 25th reunion venue and catering.</p>
                </div>
                {/* News Item 2 */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  borderLeft: '3px solid #006633',
                }}>
                  <span style={{ color: '#006633', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Announcement</span>
                  <h4 style={{ color: '#e0e0e0', fontSize: '0.95rem', margin: '6px 0', fontWeight: '500' }}>Venue Confirmed: USLS Campus</h4>
                  <p style={{ color: '#888', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>We're excited to announce our reunion will be held at our alma mater's main grounds!</p>
                </div>
                {/* News Item 3 */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  borderLeft: '3px solid #CFB53B',
                }}>
                  <span style={{ color: '#CFB53B', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Update</span>
                  <h4 style={{ color: '#e0e0e0', fontSize: '0.95rem', margin: '6px 0', fontWeight: '500' }}>Registration Now Open</h4>
                  <p style={{ color: '#888', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>All batchmates can now register and update their profiles on the platform.</p>
                </div>
              </div>
            </div>

            {/* Podcast Section */}
            <div className="media-card-green" style={{
              background: '#1a2a1f',
              border: '1px solid rgba(207, 181, 59, 0.12)',
              borderRadius: '16px',
              padding: '20px',
            }}>
              <h3 className="media-card-heading" style={{ color: '#CFB53B', marginBottom: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Batch Podcast
              </h3>
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, rgba(207, 181, 59, 0.2) 0%, rgba(0, 102, 51, 0.2) 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '2rem' }}>&#127911;</span>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: '#e0e0e0', fontSize: '0.95rem', margin: '0 0 4px 0' }}>The Golden Batch Podcast</h4>
                  <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 12px 0' }}>Catching up with batchmates, sharing stories</p>
                  <div style={{
                    height: '40px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    fontSize: '0.75rem',
                  }}>
                    Episode player coming soon
                  </div>
                </div>
              </div>
            </div>

            {/* Spotlight Section */}
            <div className="media-card-green" style={{
              background: '#1a2a1f',
              border: '1px solid rgba(207, 181, 59, 0.12)',
              borderRadius: '16px',
              padding: '20px',
            }}>
              <h3 className="media-card-heading" style={{ color: '#CFB53B', marginBottom: '16px', fontSize: '1.1rem' }}>Batchmate Spotlight</h3>
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: '70px',
                  height: '70px',
                  background: 'linear-gradient(135deg, rgba(0, 102, 51, 0.3) 0%, rgba(0, 102, 51, 0.1) 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '2px solid rgba(207, 181, 59, 0.2)',
                }}>
                  <span style={{ color: '#CFB53B', fontSize: '1.5rem' }}>?</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#006633', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Featured Interview</span>
                  <h4 style={{ color: '#e0e0e0', fontSize: '1rem', margin: '6px 0 8px 0' }}>Coming Soon: Batchmate Interviews</h4>
                  <p style={{ color: '#888', fontSize: '0.85rem', margin: 0, lineHeight: '1.6' }}>
                    We'll be featuring interviews with batchmates sharing their journeys since graduation. Stay tuned for inspiring stories!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Photo & Video Gallery */}
          <div className="media-card-green" style={{
            background: '#1a2a1f',
            border: '1px solid rgba(207, 181, 59, 0.12)',
            borderRadius: '16px',
            padding: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="media-card-heading" style={{ color: '#CFB53B', margin: 0, fontSize: '1.1rem' }}>Photo & Video Gallery</h3>
            </div>

            {/* Submission CTA */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(207, 181, 59, 0.1) 0%, rgba(207, 181, 59, 0.03) 100%)',
              border: '1px solid rgba(207, 181, 59, 0.2)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '20px',
              textAlign: 'center',
            }}>
              <p style={{ color: '#b0b0b0', marginBottom: '6px', fontSize: '0.85rem' }}>
                Have photos or videos to share?
              </p>
              <a
                href="mailto:uslsis.batch2003@gmail.com?subject=Media%20Submission%20-%20Batch%202003"
                style={{ color: '#CFB53B', fontWeight: '600', fontSize: '0.85rem', textDecoration: 'none' }}
              >
                uslsis.batch2003@gmail.com
              </a>
            </div>

            {/* Tabs */}
            {!selectedAlbum && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {['all', 'photos', 'videos'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '8px 16px',
                      background: activeTab === tab ? 'rgba(207, 181, 59, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                      border: activeTab === tab ? '1px solid rgba(207, 181, 59, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      color: activeTab === tab ? '#CFB53B' : '#888',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {tab === 'all' ? 'All' : tab === 'photos' ? 'Photos' : 'Videos'}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
                <p>Loading media...</p>
              </div>
            ) : selectedAlbum ? (
              <AlbumDetail />
            ) : filteredAlbums.length > 0 ? (
              <AlbumGrid />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: '#666', fontSize: '0.95rem' }}>No media yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Back to Profile link */}
        <p style={{ textAlign: 'center', marginTop: '32px' }}>
          <Link to={user?.isAdmin ? "/profile-preview" : "/profile"} className="btn-link">Back to Profile</Link>
        </p>

        {/* Lightbox */}
        <Lightbox />
      </main>
      </div>
      <Footer />

      {/* Inline styles for hover effects */}
      <style>{`
        .album-card:hover {
          border-color: rgba(207, 181, 59, 0.3) !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        .album-card:hover img {
          transform: scale(1.05);
        }
        .media-item:hover {
          border-color: rgba(207, 181, 59, 0.4) !important;
        }
        @media (max-width: 900px) {
          .media-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
