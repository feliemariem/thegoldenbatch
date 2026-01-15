import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function MeetingMinutes({ token, canEdit = false }) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [uploadError, setUploadError] = useState(null);

  const [form, setForm] = useState({
    title: '',
    meeting_date: '',
    attendees: '',
    notes: ''
  });

  useEffect(() => {
    fetchMeetings();
    
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [token]);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/meetings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMeetings(data.meetings || []);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setForm({
      title: '',
      meeting_date: new Date().toISOString().split('T')[0],
      attendees: '',
      notes: ''
    });
    setEditMode(false);
    setShowModal(true);
  };

  const handleEdit = (meeting) => {
    setForm({
      title: meeting.title,
      meeting_date: meeting.meeting_date.split('T')[0],
      attendees: meeting.attendees || '',
      notes: meeting.notes || ''
    });
    setSelectedMeeting(meeting);
    setEditMode(true);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editMode 
        ? `http://localhost:5000/api/meetings/${selectedMeeting.id}`
        : 'http://localhost:5000/api/meetings';
      
      const res = await fetch(url, {
        method: editMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        const data = await res.json();
        setShowModal(false);
        fetchMeetings();
        if (!editMode) {
          setSelectedMeeting(data);
        }
      }
    } catch (err) {
      console.error('Failed to save meeting:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/meetings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setMeetings(meetings.filter(m => m.id !== id));
        if (selectedMeeting?.id === id) {
          setSelectedMeeting(null);
        }
        setConfirmDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete meeting:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedMeeting) return;

    // Check file size (15MB limit)
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('File too large (max 15MB)');
      e.target.value = '';
      return;
    }

    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`http://localhost:5000/api/meetings/${selectedMeeting.id}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        fetchMeetings();
        // Refresh selected meeting
        const updated = await res.json();
        setSelectedMeeting(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), updated]
        }));
      } else {
        const data = await res.json();
        setUploadError(data.error || 'Upload failed. File may be too large.');
      }
    } catch (err) {
      console.error('Failed to upload file:', err);
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/meetings/${selectedMeeting.id}/attachments/${attachmentId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.ok) {
        setSelectedMeeting(prev => ({
          ...prev,
          attachments: prev.attachments.filter(a => a.id !== attachmentId)
        }));
        fetchMeetings();
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const handleBack = () => {
    setSelectedMeeting(null);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getFileIcon = (fileType) => {
    if (fileType?.includes('pdf')) return '[PDF]';
    if (fileType?.includes('image')) return '[IMG]';
    if (fileType?.includes('word')) return '[DOC]';
    return '[FILE]';
  };

  if (loading) {
    return <p style={{ color: '#888' }}>Loading meetings...</p>;
  }

  // Mobile: Show either list OR detail, not both
  if (isMobile) {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          {selectedMeeting ? (
            <button 
              onClick={handleBack}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: '#CFB53B', 
                cursor: 'pointer',
                fontSize: '0.95rem',
                padding: 0
              }}
            >
              ← Back to list
            </button>
          ) : (
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Meeting Minutes</h2>
              <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.8rem' }}>
                {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} recorded
              </p>
            </div>
          )}
          {!selectedMeeting && canEdit && (
            <button onClick={handleCreate} className="btn-primary" style={{ width: 'auto', padding: '10px 16px', marginTop: 0, fontSize: '0.85rem' }}>
              + New
            </button>
          )}
        </div>

        {/* Mobile List View */}
        {!selectedMeeting && (
          <div>
            {meetings.length === 0 ? (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#666'
              }}>
                <p>No meetings yet</p>
                <p style={{ fontSize: '0.85rem' }}>Tap "+ New" to add one</p>
              </div>
            ) : (
              meetings.map(meeting => (
                <div
                  key={meeting.id}
                  onClick={() => setSelectedMeeting(meeting)}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '14px',
                    marginBottom: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: '#CFB53B', marginBottom: '4px' }}>
                    {formatDate(meeting.meeting_date)}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {meeting.title}
                  </div>
                  {meeting.attendees && (
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>
                      {meeting.attendees.split(',').slice(0, 3).join(', ')}
                      {meeting.attendees.split(',').length > 3 && '...'}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '0.7rem', color: '#666' }}>
                    {meeting.attachments?.length > 0 && (
                      <span>[{meeting.attachments.length}]</span>
                    )}
                    {meeting.created_by_name && (
                      <span>by {meeting.created_by_name}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Mobile Detail View */}
        {selectedMeeting && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ color: '#CFB53B', fontSize: '0.8rem', marginBottom: '6px' }}>
                {formatDate(selectedMeeting.meeting_date)}
              </div>
              <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                {selectedMeeting.title}
              </h3>
              {selectedMeeting.attendees && (
                <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '8px' }}>
                  Attendees: {selectedMeeting.attendees}
                </div>
              )}
              {selectedMeeting.created_by_name && (
                <div style={{ color: '#666', fontSize: '0.75rem' }}>
                  Created by: {selectedMeeting.created_by_name}
                </div>
              )}
              {canEdit && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => handleEdit(selectedMeeting)}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.8rem' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(selectedMeeting.id)}
                  className="btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '0.8rem', color: '#dc3545', borderColor: 'rgba(220,53,69,0.3)' }}
                >
                  Delete
                </button>
              </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ padding: '16px' }}>
              {selectedMeeting.notes ? (
                <div style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)'
                }}>
                  {selectedMeeting.notes.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) {
                      return <h4 key={i} style={{ color: '#006633', marginTop: '16px', marginBottom: '8px', fontSize: '0.95rem' }}>{line.replace('## ', '')}</h4>;
                    }
                    if (line.startsWith('- ')) {
                      return <div key={i} style={{ paddingLeft: '12px', marginBottom: '4px' }}>• {line.replace('- ', '')}</div>;
                    }
                    if (line.match(/^\d+\. /)) {
                      return <div key={i} style={{ paddingLeft: '12px', marginBottom: '4px' }}>{line}</div>;
                    }
                    return <div key={i}>{line}</div>;
                  })}
                </div>
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic' }}>No notes recorded</p>
              )}
            </div>

            {/* Attachments */}
            <div style={{
              padding: '16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                  Attachments ({selectedMeeting.attachments?.length || 0})
                </h4>
                <label className="btn-secondary" style={{ padding: '6px 12px', cursor: 'pointer', marginBottom: 0, fontSize: '0.8rem' }}>
                  {uploading ? 'Uploading...' : '+ Add'}
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                    disabled={uploading}
                  />
                </label>
              </div>

              {uploadError && (
                <div style={{
                  background: 'rgba(220, 53, 69, 0.15)',
                  border: '1px solid rgba(220, 53, 69, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  color: '#f87171',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{uploadError}</span>
                  <button 
                    onClick={() => setUploadError(null)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                  >✕</button>
                </div>
              )}

              {selectedMeeting.attachments?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedMeeting.attachments.map(att => (
                    <div
                      key={att.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{getFileIcon(att.file_type)}</span>
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          color: '#CFB53B',
                          textDecoration: 'none',
                          fontSize: '0.85rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {att.file_name}
                      </a>
                      {canEdit && (
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#888',
                          cursor: 'pointer',
                          padding: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        x
                      </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#666', fontSize: '0.8rem', margin: 0 }}>No attachments yet</p>
              )}
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000,
            overflowY: 'auto'
          }}>
            <div style={{
              background: 'linear-gradient(165deg, rgba(30, 40, 35, 0.98) 0%, rgba(20, 28, 24, 0.99) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '20px',
              width: '100%',
              maxWidth: '500px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#CFB53B', fontSize: '1.1rem' }}>
                  {editMode ? 'Edit Meeting' : 'New Meeting'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <div className="form-group">
                <label>Meeting Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Budget Review Meeting"
                />
              </div>

              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={form.meeting_date}
                  onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Attendees (comma separated)</label>
                <input
                  type="text"
                  value={form.attendees}
                  onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                  placeholder="e.g., Bia, Felie, Coy..."
                />
              </div>

              <div className="form-group">
                <label>Meeting Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={8}
                  placeholder="Enter meeting notes here...

Tip: Use ## for headers, - for bullet points"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#ffffff',
                    resize: 'vertical',
                    lineHeight: '1.6'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '12px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  style={{ flex: 1, marginTop: 0 }}
                  disabled={saving || !form.title || !form.meeting_date}
                >
                  {saving ? 'Saving...' : editMode ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Modal */}
        {confirmDelete && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1001
          }}>
            <div style={{
              background: 'linear-gradient(165deg, rgba(30, 40, 35, 0.98) 0%, rgba(20, 28, 24, 0.99) 100%)',
              border: '1px solid rgba(207, 181, 59, 0.2)',
              borderRadius: '16px',
              padding: '20px',
              width: '100%',
              maxWidth: '300px'
            }}>
              <p style={{ color: '#e0e0e0', marginBottom: '20px', fontSize: '0.9rem' }}>
                Delete this meeting? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="btn-primary"
                  style={{ flex: 1, marginTop: 0, background: '#dc3545' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>Meeting Minutes</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.85rem' }}>
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        {canEdit && (
        <button onClick={handleCreate} className="btn-primary" style={{ width: 'auto', padding: '12px 24px', marginTop: 0 }}>
          + New Meeting
        </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 280px)', minHeight: '500px' }}>
        {/* Meetings List */}
        <div style={{ width: '350px', flexShrink: 0, overflowY: 'auto' }}>
          {meetings.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              color: '#666'
            }}>
              <p>No meetings yet</p>
              <p style={{ fontSize: '0.85rem' }}>Click "+ New Meeting" to add one</p>
            </div>
          ) : (
            meetings.map(meeting => (
              <div
                key={meeting.id}
                onClick={() => setSelectedMeeting(meeting)}
                style={{
                  background: selectedMeeting?.id === meeting.id 
                    ? 'rgba(0, 102, 51, 0.2)' 
                    : 'rgba(255,255,255,0.03)',
                  border: selectedMeeting?.id === meeting.id 
                    ? '1px solid rgba(0, 102, 51, 0.5)' 
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#CFB53B',
                  marginBottom: '6px'
                }}>
                  {formatDate(meeting.meeting_date)}
                </div>
                <div style={{ 
                  fontSize: '0.95rem', 
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '6px'
                }}>
                  {meeting.title}
                </div>
                {meeting.attendees && (
                  <div style={{ 
                    fontSize: '0.8rem', 
                    color: '#888'
                  }}>
                    {meeting.attendees.split(',').slice(0, 3).join(', ')}
                    {meeting.attendees.split(',').length > 3 && '...'}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '0.75rem', color: '#666' }}>
                  {meeting.attachments?.length > 0 && (
                    <span>{meeting.attachments.length} attachment{meeting.attachments.length !== 1 ? 's' : ''}</span>
                  )}
                  {meeting.created_by_name && (
                    <span>by {meeting.created_by_name}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Meeting Detail */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {selectedMeeting ? (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              {/* Detail Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <div>
                  <div style={{ color: '#CFB53B', fontSize: '0.85rem', marginBottom: '6px' }}>
                    {formatDate(selectedMeeting.meeting_date)}
                  </div>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>
                    {selectedMeeting.title}
                  </h3>
                  {selectedMeeting.attendees && (
                    <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '8px' }}>
                      Attendees: {selectedMeeting.attendees}
                    </div>
                  )}
                  {selectedMeeting.created_by_name && (
                    <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '6px' }}>
                      Created by: {selectedMeeting.created_by_name}
                    </div>
                  )}
                </div>
                {canEdit && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEdit(selectedMeeting)}
                    className="btn-secondary"
                    style={{ padding: '8px 16px' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(selectedMeeting.id)}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', color: '#dc3545', borderColor: 'rgba(220,53,69,0.3)' }}
                  >
                    Delete
                  </button>
                </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ padding: '24px' }}>
                {selectedMeeting.notes ? (
                  <div style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.7',
                    fontSize: '0.95rem',
                    color: 'var(--text-secondary)'
                  }}>
                    {selectedMeeting.notes.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) {
                        return <h4 key={i} style={{ color: '#006633', marginTop: '20px', marginBottom: '10px', fontSize: '1rem' }}>{line.replace('## ', '')}</h4>;
                      }
                      if (line.startsWith('- ')) {
                        return <div key={i} style={{ paddingLeft: '16px', marginBottom: '4px' }}>• {line.replace('- ', '')}</div>;
                      }
                      if (line.match(/^\d+\. /)) {
                        return <div key={i} style={{ paddingLeft: '16px', marginBottom: '4px' }}>{line}</div>;
                      }
                      return <div key={i}>{line}</div>;
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No notes recorded</p>
                )}
              </div>

              {/* Attachments */}
              <div style={{
                padding: '20px 24px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.15)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    Attachments ({selectedMeeting.attachments?.length || 0})
                  </h4>
                  <label className="btn-secondary" style={{ padding: '8px 16px', cursor: 'pointer', marginBottom: 0 }}>
                    {uploading ? 'Uploading...' : '+ Add File'}
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      disabled={uploading}
                    />
                  </label>
                </div>

                {uploadError && (
                  <div style={{
                    background: 'rgba(220, 53, 69, 0.15)',
                    border: '1px solid rgba(220, 53, 69, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '12px',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{uploadError}</span>
                    <button 
                      onClick={() => setUploadError(null)}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                    >✕</button>
                  </div>
                )}

                {selectedMeeting.attachments?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedMeeting.attachments.map(att => (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>{getFileIcon(att.file_type)}</span>
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1,
                            color: '#CFB53B',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {att.file_name}
                        </a>
                        {canEdit && (
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '0.85rem'
                          }}
                        >
                          x
                        </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>No attachments yet</p>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '60px',
              textAlign: 'center',
              color: '#666'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.5 }}>-</div>
              <p>Select a meeting to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '80px',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'linear-gradient(165deg, rgba(30, 40, 35, 0.98) 0%, rgba(20, 28, 24, 0.99) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '28px',
            width: '600px',
            maxHeight: '85vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, color: '#CFB53B', fontSize: '1.2rem' }}>
                {editMode ? 'Edit Meeting' : 'New Meeting'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div className="form-group">
              <label>Meeting Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Budget Review Meeting"
              />
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={form.meeting_date}
                onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Attendees (comma separated)</label>
              <input
                type="text"
                value={form.attendees}
                onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                placeholder="e.g., Bia, Felie, Coy..."
              />
            </div>

            <div className="form-group">
              <label>Meeting Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={12}
                placeholder="Enter meeting notes here...

Tip: Use ## for headers, - for bullet points"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#ffffff',
                  resize: 'vertical',
                  lineHeight: '1.6'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
                style={{ padding: '12px 24px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
                style={{ width: 'auto', padding: '12px 28px', marginTop: 0 }}
                disabled={saving || !form.title || !form.meeting_date}
              >
                {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Create Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: 'linear-gradient(165deg, rgba(30, 40, 35, 0.98) 0%, rgba(20, 28, 24, 0.99) 100%)',
            border: '1px solid rgba(207, 181, 59, 0.2)',
            borderRadius: '16px',
            padding: '24px 32px',
            maxWidth: '320px'
          }}>
            <p style={{ color: '#e0e0e0', marginBottom: '20px', fontSize: '0.95rem' }}>
              Delete this meeting? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-secondary"
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="btn-primary"
                style={{ padding: '10px 20px', width: 'auto', marginTop: 0, background: '#dc3545' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}