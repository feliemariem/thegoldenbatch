import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
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

// ─── Mock data ────────────────────────────────────────────────────────────────
// Replace with real API calls (GET /api/media/albums, /api/media/videos, etc.)

const MOCK_ALBUMS = [
  {
    id: 1,
    title: 'High School Days',
    description: 'Memories from our time at USLS-IS',
    coverUrl: 'https://placehold.co/400x300/062614/CFB53B?text=HS+Days',
    itemCount: 24,
    items: [
      { id: 1, type: 'photo', url: 'https://placehold.co/800x600/062614/CFB53B?text=Class+Photo', caption: 'Class photo 2003' },
      { id: 2, type: 'photo', url: 'https://placehold.co/800x600/062614/CFB53B?text=Graduation', caption: 'Graduation day' },
      { id: 3, type: 'photo', url: 'https://placehold.co/800x600/062614/CFB53B?text=Sports+Fest', caption: 'Sports fest' },
      { id: 4, type: 'photo', url: 'https://placehold.co/800x600/062614/CFB53B?text=Field+Trip', caption: 'Field trip' },
    ],
  },
  {
    id: 2,
    title: '10th Year Reunion (2013)',
    description: 'Our first major reunion gathering',
    coverUrl: 'https://placehold.co/400x300/062614/006633?text=10th+Reunion',
    itemCount: 56,
    items: [
      { id: 1, type: 'photo', url: 'https://placehold.co/800x600/062614/006633?text=Group+Photo', caption: 'Group photo' },
      { id: 2, type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://placehold.co/800x450/062614/006633?text=Video', caption: 'Reunion highlights' },
    ],
  },
  {
    id: 3,
    title: '20th Year Reunion (2023)',
    description: 'Celebrating two decades of friendship',
    coverUrl: 'https://placehold.co/400x300/062614/CFB53B?text=20th+Reunion',
    itemCount: 89,
    items: [
      { id: 1, type: 'photo', url: 'https://placehold.co/800x600/062614/CFB53B?text=20th+Photo', caption: 'The gang back together' },
      { id: 2, type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnail: 'https://placehold.co/800x450/062614/CFB53B?text=Video', caption: 'Anniversary video' },
    ],
  },
];

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

// ─── Coming Soon Screen ───────────────────────────────────────────────────────

function ComingSoon() {
  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '60px 24px',
      gap: '16px',
    }}>
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'rgba(207,181,59,0.1)',
        border: '2px solid rgba(207,181,59,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        marginBottom: '8px',
      }}>
        🎬
      </div>
      <h2 style={{ fontSize: '1.6rem', fontWeight: '400', color: '#CFB53B', margin: 0, letterSpacing: '0.02em' }}>
        Media Hub
      </h2>
      <div style={{ width: '40px', height: '2px', background: '#CFB53B', opacity: 0.4 }} />
      <p style={{ color: '#9a9a9a', fontSize: '1rem', maxWidth: '400px', lineHeight: 1.7, margin: 0 }}>
        Your photos, videos, batch news, and memories -- all in one place.
        We're putting the finishing touches on this.
      </p>
      <p style={{ color: '#B8960C', fontSize: '0.88rem', margin: '4px 0 0', letterSpacing: '0.05em', fontStyle: 'italic' }}>
        Opening very soon, Batchmates!
      </p>
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ media, album, index, onClose, onNavigate }) {
  if (!media) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    >
      <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>
        &times;
      </button>
      {album && album.items.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); onNavigate(-1); }} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&#8249;</button>
          <button onClick={(e) => { e.stopPropagation(); onNavigate(1); }} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&#8250;</button>
        </>
      )}
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {media.type === 'video' ? (
          <iframe src={media.url} style={{ width: '80vw', maxWidth: '900px', height: '50.625vw', maxHeight: '506px', border: 'none', borderRadius: '12px' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={media.caption} />
        ) : (
          <img src={media.url} alt={media.caption} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px' }} />
        )}
        {media.caption && <p style={{ color: '#ccc', marginTop: '14px', fontSize: '0.9rem', textAlign: 'center' }}>{media.caption}</p>}
      </div>
    </div>
  );
}

// ─── Tab: Photos ──────────────────────────────────────────────────────────────

function PhotosTab() {
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState('grid');

  const openLightbox = (item, index) => { setLightboxMedia(item); setLightboxIndex(index); };
  const navigateLightbox = (dir) => {
    if (!selectedAlbum) return;
    const next = (lightboxIndex + dir + selectedAlbum.items.length) % selectedAlbum.items.length;
    setLightboxIndex(next);
    setLightboxMedia(selectedAlbum.items[next]);
  };

  if (selectedAlbum) {
    return (
      <div>
        <button onClick={() => setSelectedAlbum(null)} className="media-back-btn">&larr; Back to Albums</button>
        <h3 className="album-detail-title">{selectedAlbum.title}</h3>
        <p className="album-detail-desc">{selectedAlbum.description}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
          {selectedAlbum.items.map((item, index) => (
            <div key={item.id} onClick={() => openLightbox(item, index)} className="media-item" style={{ position: 'relative', paddingTop: '100%', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={item.type === 'video' ? item.thumbnail : item.url} alt={item.caption} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              {item.type === 'video' && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '36px', height: '36px', background: 'rgba(0,102,51,0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: '0.8rem', marginLeft: '3px' }}>&#9654;</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <Lightbox media={lightboxMedia} album={selectedAlbum} index={lightboxIndex} onClose={() => setLightboxMedia(null)} onNavigate={navigateLightbox} />
      </div>
    );
  }

  return (
    <div>
      <div className="media-toolbar">
        <span className="media-count-badge">{MOCK_ALBUMS.length} albums</span>
        <div className="media-layout-toggle">
          <button className={`layout-btn${layoutMode === 'grid' ? ' active' : ''}`} onClick={() => setLayoutMode('grid')}>Grid</button>
          <button className={`layout-btn${layoutMode === 'masonry' ? ' active' : ''}`} onClick={() => setLayoutMode('masonry')}>Masonry</button>
        </div>
      </div>
      <div style={layoutMode === 'masonry' ? { columns: 3, gap: '12px' } : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {MOCK_ALBUMS.map(album => (
          <div key={album.id} onClick={() => setSelectedAlbum(album)} className="album-card" style={{ breakInside: layoutMode === 'masonry' ? 'avoid' : undefined, marginBottom: layoutMode === 'masonry' ? '12px' : undefined }}>
            <div style={{ position: 'relative', paddingTop: '66.67%', overflow: 'hidden' }}>
              <img src={album.coverUrl} alt={album.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }} />
              <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' }}>{album.itemCount} items</div>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <h4 className="album-card-title">{album.title}</h4>
              <p className="album-card-desc">{album.description}</p>
            </div>
          </div>
        ))}
      </div>
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
    { id: 'photos', label: 'Photo Gallery' },
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
            <ComingSoon />
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

              {activeTab === 'photos' && <PhotosTab />}
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
        .album-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; cursor: pointer; transition: all 0.2s ease; }
        .album-card:hover { border-color: rgba(207,181,59,0.3); transform: translateY(-2px); }
        .album-card:hover img { transform: scale(1.04); }
        .album-card-title { font-size: 0.85rem; color: #e0e0e0; font-weight: 600; margin: 0 0 3px; }
        .album-card-desc { font-size: 0.75rem; color: #9a9a9a; margin: 0; line-height: 1.4; }
        .album-detail-title { font-size: 1.2rem; color: #CFB53B; font-weight: 400; margin: 0 0 6px; }
        .album-detail-desc { font-size: 0.875rem; color: #9a9a9a; margin: 0 0 20px; }
        .media-back-btn { background: none; border: none; color: #CFB53B; font-size: 0.85rem; cursor: pointer; padding: 0; margin-bottom: 16px; }
        .media-back-btn:hover { text-decoration: underline; }
        .media-item { transition: border-color 0.15s; }
        .media-item:hover { border-color: rgba(207,181,59,0.4) !important; }
        .video-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; cursor: pointer; transition: all 0.2s ease; }
        .video-card:hover { border-color: rgba(207,181,59,0.3); transform: translateY(-2px); }
        .media-tab { padding: 10px 18px; background: none; border: none; border-bottom: 2px solid transparent; color: #9a9a9a; font-size: 0.85rem; cursor: pointer; white-space: nowrap; letter-spacing: 0.03em; transition: all 0.15s; margin-bottom: -1px; }
        .media-tab:hover { color: #e0e0e0; }
        .media-tab.active { color: #CFB53B; border-bottom-color: #CFB53B; }
        .media-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
        .media-count-badge { font-size: 0.8rem; color: #9a9a9a; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 4px 12px; }
        .media-layout-toggle { display: flex; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden; }
        .layout-btn { padding: 5px 12px; font-size: 0.75rem; background: transparent; border: none; color: #9a9a9a; cursor: pointer; transition: all 0.15s; }
        .layout-btn.active { background: #006633; color: #fff; }
        .news-item-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 14px 16px; transition: border-color 0.15s; }
        .news-item-card:hover { border-color: rgba(207,181,59,0.2); }
        .news-item-label { display: inline-block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; padding: 3px 8px; border-radius: 4px; }
        .news-item-label.gold { background: rgba(207,181,59,0.12); color: #CFB53B; }
        .news-item-label.green { background: rgba(0,102,51,0.2); color: #4caf50; }
        .news-item-title { font-size: 0.9rem; color: #e0e0e0; font-weight: 600; margin: 6px 0 4px; line-height: 1.35; }
        .news-item-desc { font-size: 0.82rem; color: #9a9a9a; line-height: 1.5; margin: 0; }
        .media-read-link { font-size: 0.78rem; color: #CFB53B; text-decoration: none; }
        .media-read-link:hover { text-decoration: underline; }
        .media-add-btn { padding: 6px 16px; background: rgba(207,181,59,0.1); border: 1px solid rgba(207,181,59,0.3); color: #CFB53B; border-radius: 6px; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; }
        .media-add-btn:hover { background: rgba(207,181,59,0.18); }
        .media-article-form { background: rgba(255,255,255,0.03); border: 1px solid rgba(207,181,59,0.15); border-radius: 10px; padding: 18px; margin-bottom: 20px; }
        .media-form-input { width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #e0e0e0; font-size: 0.875rem; outline: none; font-family: inherit; transition: border-color 0.15s; box-sizing: border-box; }
        .media-form-input:focus { border-color: rgba(207,181,59,0.4); }
        .media-form-input::placeholder { color: #555; }
        .media-submit-btn { padding: 8px 24px; background: #006633; border: none; color: #fff; border-radius: 6px; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; }
        .media-submit-btn:hover { background: #00522a; }
        @media (max-width: 640px) {
          .media-tab { padding: 8px 12px; font-size: 0.78rem; }
        }
      `}</style>
    </div>
  );
}