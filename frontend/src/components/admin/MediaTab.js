import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch, apiDelete } from '../../api';
import { API_URL } from '../../config';

// Helper: insert Cloudinary enhancements into URL
const getEnhancedUrl = (url) => {
  // Original: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}
  // Enhanced: https://res.cloudinary.com/{cloud}/image/upload/e_restore,e_improve/v{version}/{public_id}
  const versionMatch = url.match(/(\/upload\/)(v\d+\/)/);
  if (versionMatch) {
    return url.replace(versionMatch[0], `${versionMatch[1]}e_restore,e_improve/${versionMatch[2]}`);
  }
  return url;
};

// Format date nicely
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

// Group photos by uploader and day
const groupPhotosByUploaderAndDay = (photos) => {
  const groups = {};
  photos.forEach(photo => {
    const date = new Date(photo.created_at).toDateString();
    const key = `${photo.uploaded_by}-${date}`;
    if (!groups[key]) {
      groups[key] = {
        uploaded_by: photo.uploaded_by,
        credit_name: photo.credit_name,
        date,
        photos: []
      };
    }
    groups[key].photos.push(photo);
  });
  return Object.values(groups);
};

export default function MediaTab({ onPendingCountChange, isSuperAdmin }) {
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [publishedPhotos, setPublishedPhotos] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingPublished, setLoadingPublished] = useState(true);
  const [error, setError] = useState(null);
  const [enhancedStates, setEnhancedStates] = useState({}); // { photoId: boolean }
  const [actionLoading, setActionLoading] = useState({}); // { photoId: 'approve' | 'reject' | 'delete' }
  const [downloadAllLoading, setDownloadAllLoading] = useState(false);
  const [activePhotoInGroup, setActivePhotoInGroup] = useState({}); // { groupKey: photoId }

  const fetchPendingPhotos = useCallback(async () => {
    try {
      setLoadingPending(true);
      const res = await apiGet(`/api/media/photos?status=pending&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setPendingPhotos(data.photos || []);
        onPendingCountChange?.(data.photos?.length || 0);
      }
    } catch (err) {
      console.error('Failed to fetch pending photos:', err);
      setError('Failed to load pending photos');
    } finally {
      setLoadingPending(false);
    }
  }, [onPendingCountChange]);

  const fetchPublishedPhotos = useCallback(async () => {
    try {
      setLoadingPublished(true);
      const res = await apiGet(`/api/media/photos?status=published&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setPublishedPhotos(data.photos || []);
      }
    } catch (err) {
      console.error('Failed to fetch published photos:', err);
    } finally {
      setLoadingPublished(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingPhotos();
    fetchPublishedPhotos();
  }, [fetchPendingPhotos, fetchPublishedPhotos]);

  const handleStatusChange = async (photoId, newStatus) => {
    setActionLoading(prev => ({ ...prev, [photoId]: newStatus === 'published' ? 'approve' : 'reject' }));
    try {
      const res = await apiPatch(`/api/media/photos/${photoId}/status`, { status: newStatus });
      if (res.ok) {
        // Remove from pending
        setPendingPhotos(prev => prev.filter(p => p.id !== photoId));
        onPendingCountChange?.(pendingPhotos.length - 1);

        // If published, add to published list
        if (newStatus === 'published') {
          const updatedPhoto = await res.json();
          setPublishedPhotos(prev => [updatedPhoto, ...prev]);
        }
      }
    } catch (err) {
      console.error('Failed to update photo status:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [photoId]: null }));
    }
  };

  const handleDelete = async (photoId, isPending = true) => {
    if (!window.confirm('Are you sure you want to permanently delete this photo?')) return;

    setActionLoading(prev => ({ ...prev, [photoId]: 'delete' }));
    try {
      const res = await apiDelete(`/api/media/photos/${photoId}`);
      if (res.ok) {
        if (isPending) {
          setPendingPhotos(prev => prev.filter(p => p.id !== photoId));
          onPendingCountChange?.(pendingPhotos.length - 1);
        } else {
          setPublishedPhotos(prev => prev.filter(p => p.id !== photoId));
        }
      }
    } catch (err) {
      console.error('Failed to delete photo:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [photoId]: null }));
    }
  };

  const toggleEnhanced = (photoId) => {
    setEnhancedStates(prev => ({ ...prev, [photoId]: !prev[photoId] }));
  };

  const handleDownloadAll = async () => {
    setDownloadAllLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/media/photos/download/album/throwback_vault`, {
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || data.error || 'Failed to download');
        return;
      }

      // Get filename from Content-Disposition header or use default
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition && disposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'memorylane-photos.zip';

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download photos');
    } finally {
      setDownloadAllLoading(false);
    }
  };

  const handleDownloadSingle = async (photoId) => {
    try {
      const res = await fetch(`${API_URL}/api/media/photos/${photoId}/download`, {
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to download');
        return;
      }

      // Get filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition && disposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `photo-${photoId}.jpg`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download photo');
    }
  };

  if (error) {
    return <p style={{ color: 'var(--color-status-negative)' }}>{error}</p>;
  }

  return (
    <div>
      {/* SECTION A: Pending Review Queue */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ marginBottom: '16px' }}>Pending Review</h3>

        {loadingPending ? (
          <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Loading...</p>
        ) : pendingPhotos.length === 0 ? (
          <div style={{
            padding: '24px',
            background: 'var(--color-bg-card)',
            borderRadius: '12px',
            textAlign: 'center',
            color: 'var(--color-text-secondary)'
          }}>
            No photos pending review
          </div>
        ) : (
          <>
            <p style={{ marginBottom: '16px', color: 'var(--color-text-secondary)' }}>
              {pendingPhotos.length} photo{pendingPhotos.length !== 1 ? 's' : ''} pending review
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {groupPhotosByUploaderAndDay(pendingPhotos).map(group => {
                const groupKey = `${group.uploaded_by}-${group.date}`;
                const activePhotoId = activePhotoInGroup[groupKey] || group.photos[0]?.id;
                const activePhoto = group.photos.find(p => p.id === activePhotoId) || group.photos[0];

                return (
                  <div
                    key={groupKey}
                    style={{
                      background: 'var(--color-bg-card)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    {/* Header with uploader info */}
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <p style={{ fontWeight: 600, marginBottom: '2px' }}>{group.credit_name}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          {group.photos.length} photo{group.photos.length !== 1 ? 's' : ''} &middot; {group.date}
                        </p>
                      </div>
                      {/* Enhancement Toggle for active photo */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => !enhancedStates[activePhoto.id] || toggleEnhanced(activePhoto.id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '16px',
                            border: 'none',
                            cursor: 'pointer',
                            background: !enhancedStates[activePhoto.id] ? 'var(--color-hover)' : 'rgba(255, 255, 255, 0.1)',
                            color: !enhancedStates[activePhoto.id] ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)'
                          }}
                        >
                          Original
                        </button>
                        <button
                          onClick={() => enhancedStates[activePhoto.id] || toggleEnhanced(activePhoto.id)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '16px',
                            border: 'none',
                            cursor: 'pointer',
                            background: enhancedStates[activePhoto.id] ? 'var(--color-hover)' : 'rgba(255, 255, 255, 0.1)',
                            color: enhancedStates[activePhoto.id] ? 'var(--color-bg-primary)' : 'var(--color-text-secondary)'
                          }}
                        >
                          Enhanced
                        </button>
                      </div>
                    </div>

                    {/* Filmstrip - only show if multiple photos */}
                    {group.photos.length > 1 && (
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        padding: '12px 16px',
                        overflowX: 'auto',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(0, 0, 0, 0.2)'
                      }}>
                        {group.photos.map(photo => (
                          <div
                            key={photo.id}
                            onClick={() => setActivePhotoInGroup(prev => ({ ...prev, [groupKey]: photo.id }))}
                            style={{
                              flexShrink: 0,
                              width: '60px',
                              height: '60px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              border: photo.id === activePhotoId ? '2px solid var(--color-hover)' : '2px solid transparent',
                              opacity: photo.id === activePhotoId ? 1 : 0.6,
                              transition: 'all 0.15s'
                            }}
                          >
                            <img
                              src={photo.cloudinary_url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active Photo Preview */}
                    <div style={{
                      width: '100%',
                      height: '320px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.3)'
                    }}>
                      <img
                        src={enhancedStates[activePhoto.id] ? getEnhancedUrl(activePhoto.cloudinary_url) : activePhoto.cloudinary_url}
                        alt="Pending review"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '320px',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                      />
                    </div>

                    {/* Action Buttons - apply to active photo only */}
                    <div style={{ padding: '16px' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                        {group.photos.length > 1
                          ? `Reviewing photo ${group.photos.findIndex(p => p.id === activePhotoId) + 1} of ${group.photos.length}`
                          : formatDate(activePhoto.created_at)
                        }
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleStatusChange(activePhoto.id, 'published')}
                          disabled={actionLoading[activePhoto.id]}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: actionLoading[activePhoto.id] ? 'not-allowed' : 'pointer',
                            background: '#27ae60',
                            color: '#fff',
                            opacity: actionLoading[activePhoto.id] ? 0.6 : 1
                          }}
                        >
                          {actionLoading[activePhoto.id] === 'approve' ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleStatusChange(activePhoto.id, 'rejected')}
                          disabled={actionLoading[activePhoto.id]}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: actionLoading[activePhoto.id] ? 'not-allowed' : 'pointer',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'var(--color-text-secondary)',
                            opacity: actionLoading[activePhoto.id] ? 0.6 : 1
                          }}
                        >
                          {actionLoading[activePhoto.id] === 'reject' ? 'Rejecting...' : 'Reject'}
                        </button>
                        <button
                          onClick={() => handleDelete(activePhoto.id, true)}
                          disabled={actionLoading[activePhoto.id]}
                          style={{
                            padding: '10px 16px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: actionLoading[activePhoto.id] ? 'not-allowed' : 'pointer',
                            background: '#c0392b',
                            color: '#fff',
                            opacity: actionLoading[activePhoto.id] ? 0.6 : 1
                          }}
                        >
                          {actionLoading[activePhoto.id] === 'delete' ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* SECTION B: Published Photos (Memory Lane) */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: 0 }}>Published Photos (Throwback Vault)</h3>
          {isSuperAdmin && publishedPhotos.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadAllLoading}
              style={{
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                cursor: downloadAllLoading ? 'not-allowed' : 'pointer',
                background: 'var(--color-hover)',
                color: 'var(--color-bg-primary)',
                opacity: downloadAllLoading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {downloadAllLoading ? 'Preparing ZIP...' : 'Download All'}
            </button>
          )}
        </div>

        {loadingPublished ? (
          <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Loading...</p>
        ) : publishedPhotos.length === 0 ? (
          <div style={{
            padding: '24px',
            background: 'var(--color-bg-card)',
            borderRadius: '12px',
            textAlign: 'center',
            color: 'var(--color-text-secondary)'
          }}>
            No published photos yet
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {publishedPhotos.map(photo => (
              <div
                key={photo.id}
                style={{
                  background: 'var(--color-bg-card)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <div style={{ aspectRatio: '1', overflow: 'hidden' }}>
                  <img
                    src={photo.cloudinary_url}
                    alt={`By ${photo.credit_name}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                <div style={{ padding: '12px' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '4px' }}>
                    {photo.credit_name}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    {formatDate(photo.created_at)}
                  </p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDownloadSingle(photo.id)}
                        title="Download"
                        style={{
                          padding: '8px',
                          fontSize: '0.75rem',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'var(--color-text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(photo.id, false)}
                      disabled={actionLoading[photo.id]}
                      style={{
                        flex: 1,
                        padding: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: actionLoading[photo.id] ? 'not-allowed' : 'pointer',
                        background: 'rgba(192, 57, 43, 0.2)',
                        color: '#e74c3c',
                        opacity: actionLoading[photo.id] ? 0.6 : 1
                      }}
                    >
                      {actionLoading[photo.id] === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
