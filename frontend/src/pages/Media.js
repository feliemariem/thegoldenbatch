import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { apiUpload, apiGet, apiDelete } from '../api';
import '../styles/profileNew.css';

// ─── Access gate ──────────────────────────────────────────────────────────────
// Access control phases:
// Phase 1: Only specific emails
// Phase 2: All admins
// Phase 3: All registered graduates
const MEDIA_PAGE_PHASE = 1;

const checkPhaseAccess = (user) => {
  if (!user) return false;

  const userEmail = user.email?.toLowerCase();

  switch (MEDIA_PAGE_PHASE) {
    case 1:
      const allowedEmails = ['felie@fnrcore.com'];
      return allowedEmails.includes(userEmail);
    case 2:
      return user.isAdmin === true;
    case 3:
      return true; // All registered users
    default:
      return false;
  }
};

// ─── Upload permission gate ───────────────────────────────────────────────────
const MEDIA_UPLOAD_ALLOWED_EMAILS = [
  'felie@fnrcore.com',
  // Add more uploaders here when ready
];

const canUploadMedia = (user) => {
  if (!user) return false;
  return MEDIA_UPLOAD_ALLOWED_EMAILS.includes(user.email?.toLowerCase());
};

// ─── Mock data ────────────────────────────────────────────────────────────────
// Replace with real API calls (GET /api/media/videos, /api/media/articles, etc.)

const MOCK_VIDEOS = [
  { id: 1, title: 'Official Homecoming Announcement', duration: '2:14', date: 'Dec 2024', thumbnail: 'https://placehold.co/640x360/062614/CFB53B?text=Announcement', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 2, title: 'Bacolod Batch Meetup Highlights', duration: '4:38', date: 'Oct 2024', thumbnail: 'https://placehold.co/640x360/062614/CFB53B?text=Meetup', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 3, title: 'A Message from Co-Chairs', duration: '1:55', date: 'Nov 2024', thumbnail: 'https://placehold.co/640x360/062614/CFB53B?text=Co-Chairs', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 4, title: 'Throwback Slideshow', duration: '6:02', date: 'Sep 2024', thumbnail: 'https://placehold.co/640x360/062614/CFB53B?text=Throwback', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 5, title: 'Fundraising Drive Kickoff', duration: '3:11', date: 'Nov 2024', thumbnail: 'https://placehold.co/640x360/062614/CFB53B?text=Fundraising', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
  { id: 6, title: 'Registration Walk-through', duration: '2:45', date: 'Jan 2025', thumbnail: 'https://placehold.co/640x360/062614/CFB53B?text=Registration', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
];

// Articles: fetched from GET /api/media/articles in production.
// DB schema: media_articles (id, type, title, excerpt, body, source_name, external_url, published_date, created_by, created_at)
// type = 'external' | 'original'
const MOCK_ARTICLES = [
  {
    id: 1,
    type: 'external',
    title: 'Batch 2003 leads the charge as Silver Jubilarians for USLS 75th Anniversary',
    excerpt: "The batch's organizing committee outlines plans for a landmark homecoming celebration, coinciding with the school's diamond milestone.",
    sourceName: 'The Lasallian',
    publishedDate: 'February 2025',
    externalUrl: '#',
  },
  {
    id: 2,
    type: 'external',
    title: 'General Alumni Homecoming 2028 to feature Silver Jubilarians as host batch',
    excerpt: 'USLS-IS Batch 2003 formally confirmed as co-hosts for the General Alumni Homecoming at Santuario de La Salle, Bacolod City.',
    sourceName: 'USLS Official',
    publishedDate: 'January 2025',
    externalUrl: '#',
  },
  {
    id: 3,
    type: 'original',
    title: 'Registration is now open -- here is everything you need to know',
    excerpt: 'The Golden Batch 2003 platform is live. Here is a step-by-step guide on how to register, update your profile, and confirm your RSVP for December 2028.',
    publishedDate: 'January 2025',
    body: 'Full article body here. This will be a longer write-up once real content is added.',
  },
];

// ─── PhotoUploadForm (shared component) ───────────────────────────────────────

function PhotoUploadForm({ user, onUploadSuccess }) {
  const [files, setFiles] = useState([]); // array of { file, preview, status: 'pending'|'uploading'|'done'|'error' }
  const [overallStatus, setOverallStatus] = useState('idle'); // idle | uploading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const MAX_FILES = 10;
  const MAX_SIZE = 8 * 1024 * 1024; // 8MB

  const processFiles = (selected) => {
    const valid = [];
    let err = '';
    selected.forEach(f => {
      if (!f.type.startsWith('image/')) {
        err = `${f.name} is not an image and was skipped.`;
      } else if (f.size > MAX_SIZE) {
        err = `${f.name} exceeds 8MB and was skipped.`;
      } else {
        valid.push({ file: f, preview: URL.createObjectURL(f), status: 'pending' });
      }
    });
    setFiles(prev => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        err = `Maximum ${MAX_FILES} photos per submission. Some were skipped.`;
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
    setErrorMsg(err);
  };

  const handleFileChange = (e) => {
    processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    processFiles(dropped);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!files.length) return;
    setOverallStatus('uploading');

    const results = [];
    for (let i = 0; i < files.length; i++) {
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));
      try {
        const formData = new FormData();
        formData.append('photo', files[i].file);
        formData.append('album', 'throwback_vault');

        const res = await apiUpload('/api/media/photos', formData);

        if (!res.ok) throw new Error('Upload failed');
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done' } : f));
        results.push('done');
      } catch (err) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error' } : f));
        results.push('error');
      }
    }

    const allSuccess = results.every(r => r === 'done');
    setOverallStatus(allSuccess ? 'success' : 'error');

    if (allSuccess && onUploadSuccess) {
      onUploadSuccess();
    }
  };

  const handleReset = () => {
    setFiles([]);
    setOverallStatus('idle');
    setErrorMsg('');
  };

  // My submissions -- pending photos this user uploaded
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);

  const fetchMySubmissions = async () => {
    try {
      const res = await apiGet('/api/media/photos/mine');
      if (!res.ok) return;
      const data = await res.json();
      setMySubmissions(data.photos || []);
    } catch (_) {}
    finally { setLoadingSubmissions(false); }
  };

  useEffect(() => { fetchMySubmissions(); }, []);

  const handleWithdraw = async (id) => {
    if (!window.confirm('Withdraw this photo? This cannot be undone.')) return;
    try {
      const res = await apiDelete(`/api/media/photos/${id}`);
      if (!res.ok) throw new Error();
      setMySubmissions(prev => prev.filter(p => p.id !== id));
    } catch (_) {
      alert('Could not withdraw photo. Please try again.');
    }
  };

  return (
    <>
      {/* Upload card */}
      <div className="media-upload-card">
        <div style={{ marginBottom: '16px' }}>
          <p className="media-upload-title">
            Share your HS photos
          </p>
          <p className="media-upload-desc">
            Got old Grade School or High School photos? Submit them here and we'll add them to the Throwback Vault album once reviewed.
          </p>
          <p style={{ color: 'rgba(207,181,59,0.6)', fontSize: '0.78rem', margin: 0 }}>
            Photos will be credited as <span style={{ color: '#CFB53B', fontWeight: '600' }}>Photo by {user?.current_name || `${user?.first_name} ${user?.last_name}`}</span>
          </p>
        </div>

        {overallStatus === 'success' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎉</div>
            <p style={{ fontWeight: '600', fontSize: '1rem', margin: '0 0 8px', color: '#CFB53B' }}>
              Thank you for sharing your memories!
            </p>
            <p style={{ fontSize: '0.85rem', color: '#9a9a9a', margin: '0 0 20px', lineHeight: 1.6 }}>
              Your photo(s) have been submitted for review. Once approved by the admin, they will appear in the Throwback Vault.
            </p>
            <button onClick={handleReset} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: '#9a9a9a', borderRadius: '6px', padding: '6px 16px', fontSize: '0.82rem', cursor: 'pointer' }}>
              Submit more
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* File upload drop zone */}
            <div>
              <label className="media-label">
                Photos (JPG or PNG, max 8MB each, up to 10)
              </label>
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`media-dropzone ${isDragging ? 'dragging' : ''}`}
              >
                <span style={{ fontSize: '1.5rem' }}>{isDragging ? '⬇️' : '📷'}</span>
                <span className="media-dropzone-text">
                  {isDragging
                    ? 'Drop photos here'
                    : files.length === 0
                      ? 'Drag & drop photos here, or tap to choose'
                      : `Add more (${files.length}/${MAX_FILES} selected)`
                  }
                </span>
                {!isDragging && (
                  <span className="media-dropzone-hint">
                    JPG or PNG
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  multiple
                  onChange={handleFileChange}
                  disabled={files.length >= MAX_FILES}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Preview grid */}
            {files.length > 0 && (
              <div className="media-preview-grid">
                {files.map((f, i) => (
                  <div key={i} className="media-preview-item">
                    <img src={f.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {/* Status overlay */}
                    {f.status === 'uploading' && (
                      <div className="media-preview-overlay">⏳</div>
                    )}
                    {f.status === 'done' && (
                      <div className="media-preview-overlay done">✅</div>
                    )}
                    {f.status === 'error' && (
                      <div className="media-preview-overlay">❌</div>
                    )}
                    {/* Remove button -- only show when idle */}
                    {overallStatus === 'idle' && f.status === 'pending' && (
                      <button
                        onClick={() => removeFile(i)}
                        className="media-preview-remove"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {errorMsg && (
              <p className="media-error">{errorMsg}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!files.length || overallStatus === 'uploading'}
              className="media-submit-btn"
              style={{ opacity: !files.length ? 0.5 : 1, marginTop: '4px' }}
            >
              {overallStatus === 'uploading'
                ? `Uploading ${files.filter(f => f.status === 'done').length + 1} of ${files.length}...`
                : `Submit ${files.length > 0 ? `${files.length} ` : ''}photo${files.length !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        )}
      </div>

      {/* My Submissions */}
      {(loadingSubmissions || mySubmissions.length > 0) && (
        <div style={{ marginTop: '28px' }}>
          <p className="media-label" style={{ marginBottom: '12px', fontWeight: '600' }}>
            Your submissions
          </p>
          {loadingSubmissions ? (
            <p className="media-upload-desc">Loading...</p>
          ) : (
            <div className="media-submissions-grid">
              {mySubmissions.map(photo => (
                <div key={photo.id} className="media-submission-item">
                  <img src={photo.cloudinary_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* Status badge */}
                  <div className={`media-status-badge ${photo.status}`}>
                    {photo.status === 'published' ? 'Live' : photo.status === 'rejected' ? 'Rejected' : 'Pending'}
                  </div>
                  {/* Withdraw button -- only on pending */}
                  {photo.status === 'pending' && (
                    <button
                      onClick={() => handleWithdraw(photo.id)}
                      title="Withdraw photo"
                      className="media-preview-remove"
                      style={{ width: '20px', height: '20px', fontSize: '11px' }}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Coming Soon Screen ───────────────────────────────────────────────────────

function ComingSoon({ user }) {
  return (
    <div style={{ padding: '48px 24px', maxWidth: '560px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'rgba(207,181,59,0.1)', border: '2px solid rgba(207,181,59,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', margin: '0 auto 16px',
        }}>
          🎬
        </div>
        <h2 style={{ fontSize: '1.6rem', fontWeight: '400', color: '#CFB53B', margin: '0 0 10px', letterSpacing: '0.02em' }}>
          Media Hub
        </h2>
        <div style={{ width: '40px', height: '2px', background: '#CFB53B', opacity: 0.4, margin: '0 auto 14px' }} />
        <p style={{ color: '#9a9a9a', fontSize: '1rem', lineHeight: 1.7, margin: 0 }}>
          Your photos, videos, batch news, and memories -- all in one place.
          We're putting the finishing touches on this.
        </p>
        <p style={{ color: '#B8960C', fontSize: '0.88rem', margin: '8px 0 0', fontStyle: 'italic' }}>
          Opening very soon, Batchmates!
        </p>
      </div>

      <PhotoUploadForm key="coming-soon-upload" user={user} />
    </div>
  );
}

// ─── Tab: Photos ──────────────────────────────────────────────────────────────

function PhotosTab({ user }) {
  const location = useLocation();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const canUpload = canUploadMedia(user);

  const fetchPhotos = async () => {
    try {
      const res = await apiGet('/api/media/photos?album=throwback_vault&status=published');
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPhotos(); }, []);

  // Build albums array from fetched photos
  const albums = [];
  if (photos.length > 0) {
    albums.push({
      id: 'throwback_vault',
      title: 'Throwback Vault',
      description: 'Grade School and High School memories from Batch 2003',
      coverUrl: photos[0].cloudinary_url,
      itemCount: photos.length,
      items: photos.map(p => ({
        id: p.id,
        type: 'photo',
        url: p.cloudinary_url,
        caption: `Photo by ${p.credit_name}`
      }))
    });
  }

  // Deep link: auto-open album if ?album=xxx is in URL
  useEffect(() => {
    if (loading || albums.length === 0) return;
    const params = new URLSearchParams(location.search);
    const albumId = params.get('album');
    if (albumId && !selectedAlbum) {
      const matchedAlbum = albums.find(a => a.id === albumId);
      if (matchedAlbum) {
        setSelectedAlbum(matchedAlbum);
      }
    }
  }, [loading, albums, location.search, selectedAlbum]);

  const openLightbox = (item, index) => {
    setLightboxItem(item);
    setLightboxIndex(index);
  };

  const closeLightbox = () => setLightboxItem(null);

  const navigateLightbox = (dir) => {
    if (!selectedAlbum) return;
    const items = selectedAlbum.items;
    const next = (lightboxIndex + dir + items.length) % items.length;
    setLightboxIndex(next);
    setLightboxItem(items[next]);
  };

  const handleUploadSuccess = () => {
    // Don't close the form - let the success message show
    // User can click "Submit more" or "Cancel" to dismiss
  };

  // Album detail view
  if (selectedAlbum) {
    return (
      <div>
        <button onClick={() => setSelectedAlbum(null)} className="media-back-btn">&larr; Back to Albums</button>
        <h3 className="album-detail-title">{selectedAlbum.title}</h3>
        <p className="album-detail-desc">{selectedAlbum.description}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
          {selectedAlbum.items.map((item, index) => (
            <div
              key={item.id}
              onClick={() => openLightbox(item, index)}
              className="media-item"
              style={{ position: 'relative', paddingTop: '100%', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <img src={item.url} alt={item.caption} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>

        {/* Lightbox */}
        {lightboxItem && (
          <div
            onClick={closeLightbox}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <button onClick={closeLightbox} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>
              &times;
            </button>
            {selectedAlbum.items.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&#8249;</button>
                <button onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&#8250;</button>
              </>
            )}
            <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src={lightboxItem.url} alt={lightboxItem.caption} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px' }} />
              <p style={{ color: '#ccc', marginTop: '14px', fontSize: '0.9rem', textAlign: 'center' }}>{lightboxItem.caption}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Albums grid view
  return (
    <div>
      <div className="media-toolbar">
        <span className="media-count-badge">
          {loading ? '...' : `${albums.length} album${albums.length !== 1 ? 's' : ''}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {canUpload && (
            <button onClick={() => setShowUploadForm(p => !p)} className="media-add-btn">
              {showUploadForm ? 'Cancel' : '+ Share a photo'}
            </button>
          )}
        </div>
      </div>

      {canUpload && showUploadForm && (
        <div style={{ marginBottom: '20px' }}>
          <PhotoUploadForm key="photos-tab-upload" user={user} onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px 0' }}>Loading albums...</p>
      ) : albums.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.5 }}>📷</div>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            No photos yet. Be the first to share a memory!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {albums.map(album => (
            <div key={album.id} onClick={() => setSelectedAlbum(album)} className="album-card">
              <div style={{ position: 'relative', paddingTop: '66.67%', overflow: 'hidden' }}>
                <img src={album.coverUrl} alt={album.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} />
                <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' }}>{album.itemCount} photos</div>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <h4 className="album-card-title">{album.title}</h4>
                <p className="album-card-desc">{album.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Videos ──────────────────────────────────────────────────────────────

function VideosTab() {
  const [activeVideo, setActiveVideo] = useState(null);

  return (
    <div>
      <div className="media-toolbar">
        <span className="media-count-badge">{MOCK_VIDEOS.length} videos</span>
      </div>
      {activeVideo && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <iframe src={activeVideo.url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={activeVideo.title} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <p style={{ color: '#e0e0e0', fontSize: '0.95rem', fontWeight: '500' }}>{activeVideo.title}</p>
            <button onClick={() => setActiveVideo(null)} style={{ background: 'none', border: 'none', color: '#9a9a9a', fontSize: '0.85rem', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
        {MOCK_VIDEOS.map(video => (
          <div key={video.id} onClick={() => setActiveVideo(video)} className="video-card">
            <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0d1a12', overflow: 'hidden' }}>
              <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(207,181,59,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: '1rem', marginLeft: '4px' }}>&#9654;</span>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>{video.duration}</div>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <p style={{ fontSize: '0.85rem', color: '#e0e0e0', fontWeight: '500', marginBottom: '3px', lineHeight: 1.3 }}>{video.title}</p>
              <p style={{ fontSize: '0.75rem', color: '#9a9a9a', margin: 0 }}>{video.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Press & Articles ────────────────────────────────────────────────────

function PressTab({ canWrite }) {
  const [articles, setArticles] = useState(MOCK_ARTICLES);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ type: 'external', title: '', excerpt: '', sourceName: '', externalUrl: '', body: '', publishedDate: '' });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (!form.title.trim() || !form.excerpt.trim()) return;
    // TODO: replace with POST /api/media/articles
    const newArticle = {
      id: Date.now(),
      type: form.type,
      title: form.title,
      excerpt: form.excerpt,
      sourceName: form.type === 'external' ? form.sourceName : undefined,
      externalUrl: form.type === 'external' ? form.externalUrl : undefined,
      body: form.type === 'original' ? form.body : undefined,
      publishedDate: form.publishedDate || 'Just now',
    };
    setArticles(prev => [newArticle, ...prev]);
    setForm({ type: 'external', title: '', excerpt: '', sourceName: '', externalUrl: '', body: '', publishedDate: '' });
    setShowForm(false);
  };

  return (
    <div>
      <div className="media-toolbar">
        <span className="media-count-badge">{articles.length} articles</span>
        {canWrite && (
          <button onClick={() => setShowForm(p => !p)} className="media-add-btn">
            {showForm ? 'Cancel' : '+ Add Article'}
          </button>
        )}
      </div>

      {canWrite && showForm && (
        <div className="media-article-form">
          <h4 style={{ color: '#CFB53B', marginBottom: '14px', fontSize: '0.95rem', fontWeight: '600' }}>New Article</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {['external', 'original'].map(t => (
              <button key={t} onClick={() => set('type', t)} style={{ padding: '6px 16px', borderRadius: '20px', border: '1px solid', borderColor: form.type === t ? '#CFB53B' : 'rgba(255,255,255,0.12)', background: form.type === t ? 'rgba(207,181,59,0.1)' : 'transparent', color: form.type === t ? '#CFB53B' : '#9a9a9a', fontSize: '0.8rem', cursor: 'pointer' }}>
                {t === 'external' ? 'External Link' : 'Original Article'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="Title" value={form.title} onChange={e => set('title', e.target.value)} className="media-form-input" />
            <textarea placeholder="Excerpt / summary" value={form.excerpt} onChange={e => set('excerpt', e.target.value)} rows={3} className="media-form-input" style={{ resize: 'vertical' }} />
            {form.type === 'external' ? (
              <>
                <input type="text" placeholder="Source name (e.g. The Lasallian)" value={form.sourceName} onChange={e => set('sourceName', e.target.value)} className="media-form-input" />
                <input type="url" placeholder="External URL" value={form.externalUrl} onChange={e => set('externalUrl', e.target.value)} className="media-form-input" />
              </>
            ) : (
              <textarea placeholder="Full article body..." value={form.body} onChange={e => set('body', e.target.value)} rows={8} className="media-form-input" style={{ resize: 'vertical' }} />
            )}
            <input type="text" placeholder="Published date (e.g. March 2025)" value={form.publishedDate} onChange={e => set('publishedDate', e.target.value)} className="media-form-input" />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSubmit} className="media-submit-btn">Publish</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {articles.map(article => (
          <div key={article.id} className="news-item-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {article.type === 'external'
                  ? <span className="news-item-label gold">{article.sourceName || 'External'}</span>
                  : <span className="news-item-label green">Batch Update</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                <h4 className="news-item-title">{article.title}</h4>
                <p className="news-item-desc">{article.excerpt}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>{article.publishedDate}</span>
                  {article.type === 'external' && article.externalUrl && article.externalUrl !== '#' && (
                    <a href={article.externalUrl} target="_blank" rel="noopener noreferrer" className="media-read-link">Read article &rarr;</a>
                  )}
                  {article.type === 'original' && article.body && (
                    <button onClick={() => setExpandedId(expandedId === article.id ? null : article.id)} className="media-read-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {expandedId === article.id ? 'Collapse' : 'Read more'}
                    </button>
                  )}
                </div>
                {expandedId === article.id && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', color: '#ccc', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {article.body}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Highlights ──────────────────────────────────────────────────────────

function HighlightsTab() {
  const sideItems = [
    { label: 'Reunion', title: 'Manila Batchmates Lunch -- August 2024' },
    { label: 'Committee', title: 'First Core Leaders Zoom Call -- June 2024' },
    { label: 'Milestone', title: 'Registration platform goes live -- Jan 2025' },
  ];
  const stats = [
    { num: '3', label: 'Major meetups held' },
    { num: '40+', label: 'Batchmates at largest event' },
    { num: 'Dec 2028', label: 'Homecoming countdown' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <div style={{ background: 'linear-gradient(135deg, #062614, #006633)', borderRadius: '12px', padding: '2rem', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <span style={{ color: '#CFB53B', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px', fontWeight: '600' }}>Featured</span>
          <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: '400', lineHeight: 1.3, marginBottom: '8px' }}>Bacolod Grand Reunion Meetup -- October 2024</h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: 0 }}>Over 40 batchmates gathered for the first major in-person planning session.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sideItems.map((item, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(207,181,59,0.1)', borderRadius: '8px', padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ fontSize: '0.65rem', color: '#B8960C', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '0.8rem', color: '#e0e0e0', lineHeight: 1.35 }}>{item.title}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(207,181,59,0.08)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', color: '#006633', fontFamily: 'Georgia, serif' }}>{stat.num}</div>
            <div style={{ fontSize: '0.75rem', color: '#9a9a9a', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Media() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('photos');

  // Phase 1: only allowed user IDs can see the Media page.
  // Everyone else -- including other admins -- sees the coming soon screen.
  const hasAccess = checkPhaseAccess(user);
  const canWrite = hasAccess; // same gate for now; widen separately when ready

  const tabs = [
    { id: 'photos', label: 'Albums' },
    { id: 'videos', label: 'Videos' },
    { id: 'press', label: 'Press & Articles' },
    { id: 'highlights', label: 'Event Highlights' },
  ];

  return (
    <div className="container admin-container">
      <Navbar />
      <div className="card">
        <main className="profile-main">
          {!hasAccess ? (
            <ComingSoon user={user} />
          ) : (
            <>
              <div style={{ marginBottom: '28px' }}>
                <h2 className="media-page-title" style={{ marginBottom: '6px' }}>Media Hub</h2>
                <p style={{ color: '#888', fontSize: '0.95rem' }}>Photos, videos, press coverage, and batch updates</p>
              </div>

              <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px', overflowX: 'auto' }}>
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`media-tab${activeTab === tab.id ? ' active' : ''}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'photos' && <PhotosTab user={user} />}
              {activeTab === 'videos' && <VideosTab />}
              {activeTab === 'press' && <PressTab canWrite={canWrite} />}
              {activeTab === 'highlights' && <HighlightsTab />}
            </>
          )}

          <p style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link to={user?.isAdmin ? '/profile-preview' : '/profile'} className="btn-link">Back to Profile</Link>
          </p>
        </main>
      </div>
      <Footer />

      <style>{`
        .album-card { background: var(--color-bg-card); border: 1px solid var(--color-border, rgba(255,255,255,0.08)); border-radius: 10px; overflow: hidden; cursor: pointer; transition: all 0.2s ease; }
        .album-card:hover { border-color: rgba(207,181,59,0.3); transform: translateY(-2px); }
        .album-card:hover img { transform: scale(1.04); }
        .album-card-title { font-size: 0.85rem; color: var(--color-text-primary); font-weight: 600; margin: 0 0 3px; }
        .album-card-desc { font-size: 0.75rem; color: var(--color-text-secondary); margin: 0; line-height: 1.4; }
        .album-detail-title { font-size: 1.2rem; color: var(--color-hover); font-weight: 400; margin: 0 0 6px; }
        .album-detail-desc { font-size: 0.875rem; color: var(--color-text-secondary); margin: 0 0 20px; }
        .media-back-btn { background: none; border: none; color: var(--color-hover); font-size: 0.85rem; cursor: pointer; padding: 0; margin-bottom: 16px; }
        .media-back-btn:hover { text-decoration: underline; }
        .media-item { transition: border-color 0.15s; }
        .media-item:hover { border-color: rgba(207,181,59,0.4) !important; }
        .video-card { background: var(--color-bg-card); border: 1px solid var(--color-border, rgba(255,255,255,0.08)); border-radius: 10px; overflow: hidden; cursor: pointer; transition: all 0.2s ease; }
        .video-card:hover { border-color: rgba(207,181,59,0.3); transform: translateY(-2px); }
        .media-tab { padding: 10px 18px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--color-text-secondary); font-size: 0.85rem; cursor: pointer; white-space: nowrap; letter-spacing: 0.03em; transition: all 0.15s; margin-bottom: -1px; }
        .media-tab:hover { color: var(--color-text-primary); }
        .media-tab.active { color: var(--color-hover); border-bottom-color: var(--color-hover); }
        .media-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
        .media-count-badge { font-size: 0.8rem; color: var(--color-text-secondary); background: var(--color-bg-card); border: 1px solid var(--color-border, rgba(255,255,255,0.08)); border-radius: 999px; padding: 4px 12px; }
        .media-layout-toggle { display: flex; border: 1px solid var(--color-border, rgba(255,255,255,0.1)); border-radius: 6px; overflow: hidden; }
        .layout-btn { padding: 5px 12px; font-size: 0.75rem; background: transparent; border: none; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; }
        .layout-btn.active { background: #006633; color: #fff; }
        .news-item-card { background: var(--color-bg-card); border: 1px solid var(--color-border, rgba(255,255,255,0.07)); border-radius: 10px; padding: 14px 16px; transition: border-color 0.15s; }
        .news-item-card:hover { border-color: rgba(207,181,59,0.2); }
        .news-item-label { display: inline-block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; padding: 3px 8px; border-radius: 4px; }
        .news-item-label.gold { background: rgba(207,181,59,0.12); color: var(--color-hover); }
        .news-item-label.green { background: rgba(0,102,51,0.2); color: #4caf50; }
        .news-item-title { font-size: 0.9rem; color: var(--color-text-primary); font-weight: 600; margin: 6px 0 4px; line-height: 1.35; }
        .news-item-desc { font-size: 0.82rem; color: var(--color-text-secondary); line-height: 1.5; margin: 0; }
        .media-read-link { font-size: 0.78rem; color: var(--color-hover); text-decoration: none; }
        .media-read-link:hover { text-decoration: underline; }
        .media-add-btn { padding: 6px 16px; background: rgba(207,181,59,0.1); border: 1px solid rgba(207,181,59,0.3); color: var(--color-hover); border-radius: 6px; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; }
        .media-add-btn:hover { background: rgba(207,181,59,0.18); }
        .media-article-form { background: var(--color-bg-card); border: 1px solid rgba(207,181,59,0.15); border-radius: 10px; padding: 18px; margin-bottom: 20px; }
        .media-form-input { width: 100%; padding: 8px 12px; background: var(--color-bg-secondary, rgba(0,0,0,0.1)); border: 1px solid var(--color-border, rgba(255,255,255,0.1)); border-radius: 6px; color: var(--color-text-primary); font-size: 0.875rem; outline: none; font-family: inherit; transition: border-color 0.15s; box-sizing: border-box; }
        .media-form-input:focus { border-color: rgba(207,181,59,0.4); }
        .media-form-input::placeholder { color: var(--color-text-secondary); }
        .media-submit-btn { padding: 8px 24px; background: #006633; border: none; color: #fff; border-radius: 6px; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; }
        .media-submit-btn:hover { background: #00522a; }

        /* Upload form styles */
        .media-upload-card { background: var(--color-bg-card); border: 1px solid rgba(207,181,59,0.15); border-radius: 14px; padding: 24px; }
        .media-upload-title { color: var(--color-hover); font-size: 0.95rem; font-weight: 600; margin: 0 0 4px; }
        .media-upload-desc { color: var(--color-text-secondary); font-size: 0.82rem; margin: 0 0 8px; line-height: 1.5; }
        .media-success-text { color: var(--color-status-positive, #4caf50); font-weight: 600; font-size: 0.95rem; margin: 0 0 6px; }
        .media-reset-btn { background: none; border: 1px solid var(--color-border, rgba(255,255,255,0.12)); color: var(--color-text-secondary); border-radius: 6px; padding: 6px 16px; font-size: 0.82rem; cursor: pointer; }
        .media-reset-btn:hover { border-color: var(--color-hover); color: var(--color-hover); }
        .media-label { font-size: 0.78rem; color: var(--color-text-secondary); display: block; margin-bottom: 5px; letter-spacing: 0.04em; text-transform: uppercase; }
        .media-dropzone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 22px 18px; border-radius: 8px; cursor: pointer; border: 1px dashed rgba(207,181,59,0.3); background: rgba(207,181,59,0.04); min-height: 90px; transition: all 0.15s; }
        .media-dropzone.dragging { border-color: var(--color-hover); background: rgba(207,181,59,0.1); }
        .media-dropzone-text { color: var(--color-text-secondary); font-size: 0.82rem; font-weight: 400; }
        .media-dropzone.dragging .media-dropzone-text { color: var(--color-hover); font-weight: 500; }
        .media-dropzone-hint { color: var(--color-text-secondary); opacity: 0.5; font-size: 0.72rem; }
        .media-preview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; }
        .media-preview-item { position: relative; aspect-ratio: 1/1; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border, rgba(255,255,255,0.1)); }
        .media-preview-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .media-preview-overlay.done { background: rgba(0,0,0,0.4); font-size: 1.2rem; }
        .media-preview-remove { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; border-radius: 50%; background: rgba(0,0,0,0.7); border: none; color: #fff; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; }
        .media-error { color: var(--color-status-negative, #e57373); font-size: 0.8rem; margin: 0; }
        .media-submissions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; }
        .media-submission-item { position: relative; aspect-ratio: 1/1; border-radius: 8px; overflow: hidden; border: 1px solid var(--color-border, rgba(255,255,255,0.08)); }
        .media-status-badge { position: absolute; bottom: 4px; left: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.7); color: #fff; }
        .media-status-badge.published { background: rgba(0,102,51,0.9); }
        .media-status-badge.rejected { background: rgba(180,50,50,0.9); }

        @media (max-width: 640px) {
          .media-tab { padding: 8px 12px; font-size: 0.78rem; }
        }
      `}</style>
    </div>
  );
}
