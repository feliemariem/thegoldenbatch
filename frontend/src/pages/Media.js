import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../images/lasalle.jpg';

export default function Media() {
  const [activeTab, setActiveTab] = useState('all');
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
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
    {
      id: 4,
      title: 'Throwback Videos',
      description: 'Video compilations from our batch',
      coverImage: 'https://placehold.co/400x300/1a2a1f/006633?text=Videos',
      mediaCount: 12,
      type: 'videos',
      items: [
        { id: 1, type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://placehold.co/800x450/1a2a1f/006633?text=Video+1', caption: 'Batch video 2003' },
        { id: 2, type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://placehold.co/800x450/1a2a1f/006633?text=Video+2', caption: 'Graduation ceremony' },
      ]
    },
    {
      id: 5,
      title: '25th Reunion Prep (2028)',
      description: 'Behind the scenes of planning our silver jubilee',
      coverImage: 'https://placehold.co/400x300/1a2a1f/CFB53B?text=25th+Prep',
      mediaCount: 8,
      type: 'photos',
      items: [
        { id: 1, type: 'photo', url: 'https://placehold.co/800x600/1a2a1f/CFB53B?text=Planning', caption: 'Committee meeting' },
      ]
    }
  ];

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setAlbums(mockAlbums);
      setLoading(false);
    }, 500);
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
      {filteredAlbums.map(album => (
        <div
          key={album.id}
          onClick={() => setSelectedAlbum(album)}
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          className="album-card"
        >
          {/* Cover Image */}
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
            {/* Media type badge */}
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: album.type === 'videos' ? 'rgba(0, 102, 51, 0.9)' : album.type === 'mixed' ? 'rgba(207, 181, 59, 0.9)' : 'rgba(0, 102, 51, 0.9)',
              color: album.type === 'mixed' ? '#1a1a1a' : '#fff',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.7rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {album.type === 'mixed' ? '📷 + 🎬' : album.type === 'videos' ? '🎬 Videos' : '📷 Photos'}
            </div>
            {/* Media count */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '500',
            }}>
              {album.mediaCount} items
            </div>
          </div>
          {/* Album Info */}
          <div style={{ padding: '16px' }}>
            <h4 style={{ color: '#CFB53B', marginBottom: '6px', fontSize: '1rem' }}>{album.title}</h4>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>{album.description}</p>
          </div>
        </div>
      ))}
    </div>
  );

  // Album Detail View
  const AlbumDetail = () => (
    <div>
      {/* Back button */}
      <button
        onClick={() => setSelectedAlbum(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          color: '#CFB53B',
          fontSize: '0.9rem',
          cursor: 'pointer',
          padding: '0',
          marginBottom: '20px',
        }}
      >
        ← Back to Albums
      </button>

      {/* Album Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#CFB53B', marginBottom: '8px' }}>{selectedAlbum.title}</h2>
        <p style={{ color: '#888', margin: 0 }}>{selectedAlbum.description}</p>
      </div>

      {/* Media Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {selectedAlbum.items.map((item, index) => (
          <div
            key={item.id}
            onClick={() => openLightbox(item, index)}
            style={{
              position: 'relative',
              paddingTop: item.type === 'video' ? '56.25%' : '100%',
              borderRadius: '12px',
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
                transition: 'transform 0.3s ease',
              }}
            />
            {/* Video play icon */}
            {item.type === 'video' && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '50px',
                height: '50px',
                background: 'rgba(0, 102, 51, 0.9)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                ▶
              </div>
            )}
            {/* Caption overlay */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              padding: '24px 12px 12px',
              color: '#fff',
              fontSize: '0.8rem',
            }}>
              {item.caption}
            </div>
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
        {/* Close button */}
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
            zIndex: 1001,
          }}
        >
          ×
        </button>

        {/* Navigation arrows */}
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
              ‹
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
              ›
            </button>
          </>
        )}

        {/* Media content */}
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
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
              }}
            />
          )}
          {/* Caption */}
          <p style={{
            color: '#e0e0e0',
            marginTop: '16px',
            fontSize: '0.95rem',
            textAlign: 'center',
          }}>
            {lightboxMedia.caption}
          </p>
          {/* Counter */}
          {selectedAlbum && (
            <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '8px' }}>
              {lightboxIndex + 1} of {selectedAlbum.items.length}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container admin-container">
      <div className="card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <img src={logo} alt="USLS Logo" style={{ width: '60px', height: '60px', borderRadius: '12px', marginRight: '16px' }} />
          <div>
            <h1 style={{ marginBottom: '4px' }}>Media Gallery</h1>
            <p className="subtitle" style={{ marginBottom: 0 }}>Photos & Videos from Batch 2003</p>
          </div>
        </div>

        {/* Submission CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(207, 181, 59, 0.15) 0%, rgba(207, 181, 59, 0.05) 100%)',
          border: '1px solid rgba(207, 181, 59, 0.3)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '28px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#e0e0e0', marginBottom: '8px', fontSize: '0.95rem' }}>
            Have photos or videos to share? Send them to us!
          </p>
          <a
            href="mailto:uslsis.batch2003@gmail.com?subject=Media%20Submission%20-%20Batch%202003"
            style={{
              color: '#CFB53B',
              fontWeight: '600',
              fontSize: '1rem',
              textDecoration: 'none',
            }}
          >
            📧 uslsis.batch2003@gmail.com
          </a>
        </div>

        {/* Tabs - Only show when not viewing album detail */}
        {!selectedAlbum && (
          <div className="tabs" style={{ marginBottom: '24px' }}>
            <button
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
            <button
              className={`tab ${activeTab === 'photos' ? 'active' : ''}`}
              onClick={() => setActiveTab('photos')}
            >
              📷 Photos
            </button>
            <button
              className={`tab ${activeTab === 'videos' ? 'active' : ''}`}
              onClick={() => setActiveTab('videos')}
            >
              🎬 Videos
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
            <p>Loading media...</p>
          </div>
        ) : selectedAlbum ? (
          <AlbumDetail />
        ) : filteredAlbums.length > 0 ? (
          <AlbumGrid />
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '8px' }}>No media yet</p>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>Albums will appear here once added by the admin.</p>
          </div>
        )}

        {/* Back to Profile link */}
        <p style={{ textAlign: 'center', marginTop: '32px' }}>
          <Link to="/profile" className="btn-link">Back to Profile</Link>
        </p>

        {/* Lightbox */}
        <Lightbox />
      </div>

      {/* Inline styles for hover effects */}
      <style>{`
        .album-card:hover {
          border-color: rgba(207, 181, 59, 0.3) !important;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        .album-card:hover img {
          transform: scale(1.05);
        }
        .media-item:hover {
          border-color: rgba(207, 181, 59, 0.4) !important;
        }
        .media-item:hover img {
          transform: scale(1.08);
        }
      `}</style>
    </div>
  );
}
