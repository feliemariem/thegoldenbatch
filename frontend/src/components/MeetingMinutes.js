import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { useActionItems } from '../context/ActionItemsContext';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '../api';
import ActionItemModal from './ActionItemModal';

export default function MeetingMinutes({ canEdit = false, initialMeetingId = null, onMeetingSelected = null }) {
  const { user } = useAuth();
  const { updateVersion, lastUpdatedItem, notifyActionItemUpdate } = useActionItems();
  const navigate = useNavigate();
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
    location: '',
    attendees: '',
    notes: ''
  });

  // Action items state
  const [actionItems, setActionItems] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [showActionItems, setShowActionItems] = useState(true);
  const [showActionItemModal, setShowActionItemModal] = useState(false);
  const [editingActionItem, setEditingActionItem] = useState(null);
  const [confirmDeleteActionItem, setConfirmDeleteActionItem] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(null); // track which action item is uploading

  useEffect(() => {
    fetchMeetings();
    fetchAdmins();

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch action items when a meeting is selected
  useEffect(() => {
    if (selectedMeeting?.id) {
      fetchActionItems(selectedMeeting.id);
    } else {
      setActionItems([]);
    }
  }, [selectedMeeting?.id]);

  // Listen for action item updates from other components (e.g., MyTasks)
  useEffect(() => {
    if (updateVersion > 0 && lastUpdatedItem) {
      // Update the local action items state if the updated item is in our list
      setActionItems(prevItems =>
        prevItems.map(item =>
          item.id === lastUpdatedItem.id
            ? { ...item, status: lastUpdatedItem.status }
            : item
        )
      );
    }
  }, [updateVersion, lastUpdatedItem]);

  const fetchMeetings = async () => {
    try {
      const res = await apiGet('/api/meetings');
      const data = await res.json();
      const meetingsList = data.meetings || [];
      setMeetings(meetingsList);

      // Check if there's an initialMeetingId from URL navigation (priority)
      if (initialMeetingId) {
        const meetingToSelect = meetingsList.find(m => m.id === initialMeetingId);
        if (meetingToSelect) {
          setSelectedMeeting(meetingToSelect);
          // Notify parent that meeting was selected (so it can clear the URL state)
          if (onMeetingSelected) {
            onMeetingSelected();
          }
        }
      } else {
        // Fallback: Check if there's a selectedMeetingId from localStorage (legacy)
        const storedMeetingId = localStorage.getItem('selectedMeetingId');
        if (storedMeetingId) {
          const meetingToSelect = meetingsList.find(m => m.id === parseInt(storedMeetingId));
          if (meetingToSelect) {
            setSelectedMeeting(meetingToSelect);
          }
          localStorage.removeItem('selectedMeetingId');
        }
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await apiGet('/api/meetings/admins/list');
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  };

  const fetchActionItems = async (meetingId) => {
    try {
      const res = await apiGet(`/api/meetings/${meetingId}/action-items`);
      const data = await res.json();
      setActionItems(data.actionItems || []);
    } catch (err) {
      console.error('Failed to fetch action items:', err);
    }
  };

  // Action item handlers
  const handleCreateActionItem = () => {
    setEditingActionItem(null);
    setShowActionItemModal(true);
  };

  const handleEditActionItem = (item) => {
    setEditingActionItem(item);
    setShowActionItemModal(true);
  };

  const handleSaveActionItem = async (formData, editingItem) => {
    try {
      const res = editingItem
        ? await apiPut(`/api/meetings/${selectedMeeting.id}/action-items/${editingItem.id}`, formData)
        : await apiPost(`/api/meetings/${selectedMeeting.id}/action-items`, formData);

      if (res.ok) {
        setShowActionItemModal(false);
        fetchActionItems(selectedMeeting.id);
        // Notify other components (like MyTasks) about the update
        if (editingItem) {
          notifyActionItemUpdate(editingItem.id, formData.status);
        }
      }
    } catch (err) {
      console.error('Failed to save action item:', err);
    }
  };

  const handleDeleteActionItem = async (actionItemId) => {
    try {
      const res = await apiDelete(`/api/meetings/${selectedMeeting.id}/action-items/${actionItemId}`);

      if (res.ok) {
        setActionItems(actionItems.filter(ai => ai.id !== actionItemId));
        setConfirmDeleteActionItem(null);
      }
    } catch (err) {
      console.error('Failed to delete action item:', err);
    }
  };

  // Toggle action item status (Done <-> Not Started)
  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'done' ? 'not_started' : 'done';
    try {
      const res = await apiPut(`/api/meetings/${selectedMeeting.id}/action-items/${item.id}`, {
        ...item,
        status: newStatus
      });
      if (res.ok) {
        setActionItems(actionItems.map(ai =>
          ai.id === item.id ? { ...ai, status: newStatus } : ai
        ));
        notifyActionItemUpdate(item.id, newStatus);
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Toggle pin to pipeline
  const handleTogglePin = async (item) => {
    try {
      const res = await apiPut(
        `/api/meetings/${selectedMeeting.id}/action-items/${item.id}`,
        { ...item, show_in_pipeline: !item.show_in_pipeline }
      );
      if (res.ok) {
        fetchActionItems(selectedMeeting.id);
        // Notify PipelineBoard to refetch
        window.dispatchEvent(new Event('pipeline-refresh'));
        localStorage.setItem('pipeline_last_pin', Date.now().toString());
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Upload action item attachment
  const handleActionItemAttachmentUpload = async (e, actionItemId) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File too large (max 15MB)');
      e.target.value = '';
      return;
    }

    setUploadingAttachment(actionItemId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiUpload(`/api/action-items/${actionItemId}/attachments`, formData);
      if (res.ok) {
        fetchActionItems(selectedMeeting.id);
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
    } finally {
      setUploadingAttachment(null);
      e.target.value = '';
    }
  };

  // Delete action item attachment
  const handleDeleteActionItemAttachment = async (actionItemId, attachmentId) => {
    try {
      const res = await apiDelete(`/api/action-items/${actionItemId}/attachments/${attachmentId}`);
      if (res.ok) {
        fetchActionItems(selectedMeeting.id);
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      not_started: { bg: 'var(--color-status-neutral-bg)', color: 'var(--color-status-neutral)', text: 'Not Started', className: 'status-not-started' },
      in_progress: { bg: 'var(--color-status-info-bg)', color: 'var(--color-status-info)', text: 'In Progress', className: 'status-in-progress' },
      done: { bg: 'var(--color-status-positive-bg)', color: 'var(--color-status-positive)', text: 'Done', className: 'status-done' }
    };
    const style = styles[status] || styles.not_started;
    return (
      <span className={`task-status-badge ${style.className}`} style={{
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.7rem',
        fontWeight: '500',
        background: style.bg,
        color: style.color
      }}>
        {style.text}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      critical: { bg: 'var(--color-priority-critical-bg)', color: 'var(--color-priority-critical)', text: 'Critical', className: 'priority-critical' },
      high: { bg: 'var(--color-priority-high-bg)', color: 'var(--color-priority-high)', text: 'High', className: 'priority-high' },
      medium: { bg: 'var(--color-status-warning-bg)', color: 'var(--color-status-warning)', text: 'Medium', className: 'priority-medium' },
      low: { bg: 'var(--color-status-neutral-bg)', color: 'var(--color-status-neutral)', text: 'Low', className: 'priority-low' }
    };
    const style = styles[priority] || styles.medium;
    return (
      <span className={`task-priority-badge ${style.className}`} style={{
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '0.65rem',
        fontWeight: '600',
        background: style.bg,
        color: style.color
      }}>
        {style.text}
      </span>
    );
  };

  const getActionItemSummary = () => {
    const total = actionItems.length;
    const completed = actionItems.filter(ai => ai.status === 'done').length;
    return { total, completed };
  };

  // Navigate to assignee's profile or committee page
  const handleAssigneeClick = (e, assigneeEmail, assigneeName) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if the assignee is the current user (case-insensitive email comparison)
    const isCurrentUser = user?.email && assigneeEmail &&
      user.email.toLowerCase() === assigneeEmail.toLowerCase();

    if (isCurrentUser) {
      // Navigate to own profile page and scroll to My Tasks section
      const profilePath = user?.isAdmin ? '/profile-preview' : '/profile';
      navigate(profilePath, { state: { scrollToMyTasks: true } });
    } else {
      // Navigate to Committee page and highlight this person
      navigate('/committee', { state: { highlightEmail: assigneeEmail, highlightName: assigneeName } });
    }
  };

  const handleCreate = () => {
    setForm({
      title: '',
      meeting_date: new Date().toISOString().split('T')[0],
      location: '',
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
      location: meeting.location || '',
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
      const res = editMode
        ? await apiPut(`/api/meetings/${selectedMeeting.id}`, form)
        : await apiPost('/api/meetings', form);

      if (res.ok) {
        const data = await res.json();
        setShowModal(false);
        fetchMeetings();
        // Update selectedMeeting for both new meetings and edits
        setSelectedMeeting(data);
      }
    } catch (err) {
      console.error('Failed to save meeting:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await apiDelete(`/api/meetings/${id}`);

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
      const res = await apiUpload(`/api/meetings/${selectedMeeting.id}/attachments`, formData);

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
      const res = await apiDelete(`/api/meetings/${selectedMeeting.id}/attachments/${attachmentId}`);

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
      day: 'numeric',
      timeZone: 'UTC'
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
                color: 'var(--color-hover)', 
                cursor: 'pointer',
                fontSize: '0.95rem',
                padding: 0
              }}
            >
              ← Back to list
            </button>
          ) : (
            <div>
              <h3>Meeting Minutes</h3>
              <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.8rem' }}>
                {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} recorded
              </p>
            </div>
          )}
          {!selectedMeeting && canEdit && (
            <button onClick={handleCreate} className="btn-new-meeting" style={{ width: 'auto', padding: '10px 16px', marginTop: 0, fontSize: '0.85rem' }}>
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
                  <div className="meeting-date" style={{ fontSize: '0.7rem', color: 'var(--color-hover)', marginBottom: '4px' }}>
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
              <div className="meeting-date" style={{ color: 'var(--color-hover)', fontSize: '0.8rem', marginBottom: '6px' }}>
                {formatDate(selectedMeeting.meeting_date)}
              </div>
              {selectedMeeting.location && (
                <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '6px' }}>
                  {selectedMeeting.location}
                </div>
              )}
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
                  style={{ padding: '8px 14px', fontSize: '0.8rem', color: 'var(--color-status-negative)', borderColor: 'var(--color-status-negative)' }}
                >
                  Delete
                </button>
              </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ padding: '16px' }}>
              {selectedMeeting.notes ? (
                <div className="meeting-notes-markdown meeting-notes-markdown-mobile">
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h1 style={{ color: 'var(--color-hover)', fontSize: '1.1rem', fontWeight: '600', margin: '16px 0 8px 0', borderBottom: '1px solid rgba(0, 102, 51, 0.3)', paddingBottom: '6px' }} {...props} />,
                      h2: ({node, ...props}) => <h2 style={{ color: 'var(--color-hover)', fontSize: '1rem', fontWeight: '600', margin: '14px 0 8px 0' }} {...props} />,
                      h3: ({node, ...props}) => <h3 style={{ color: 'var(--color-hover)', fontSize: '0.95rem', fontWeight: '600', margin: '12px 0 6px 0' }} {...props} />,
                      h4: ({node, ...props}) => <h4 style={{ color: 'var(--color-hover)', fontSize: '0.9rem', fontWeight: '600', margin: '10px 0 6px 0' }} {...props} />,
                      p: ({node, ...props}) => <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 8px 0', fontSize: '0.9rem' }} {...props} />,
                      ul: ({node, ...props}) => <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'var(--text-secondary)' }} {...props} />,
                      ol: ({node, ...props}) => <ol style={{ margin: '8px 0', paddingLeft: '20px', color: 'var(--text-secondary)' }} {...props} />,
                      li: ({node, ...props}) => <li style={{ marginBottom: '4px', lineHeight: '1.5', fontSize: '0.9rem' }} {...props} />,
                      strong: ({node, ...props}) => <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }} {...props} />,
                      em: ({node, ...props}) => <em style={{ color: 'var(--text-secondary)' }} {...props} />,
                      table: ({node, ...props}) => <div style={{ overflowX: 'auto', margin: '12px 0' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }} {...props} /></div>,
                      thead: ({node, ...props}) => <thead style={{ background: 'rgba(0, 102, 51, 0.2)' }} {...props} />,
                      th: ({node, ...props}) => <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid rgba(0, 102, 51, 0.3)', color: 'var(--color-hover)', fontWeight: '600' }} {...props} />,
                      td: ({node, ...props}) => <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }} {...props} />,
                      blockquote: ({node, ...props}) => <blockquote style={{ margin: '12px 0', paddingLeft: '12px', borderLeft: '3px solid var(--color-hover)', color: '#888', fontStyle: 'italic' }} {...props} />,
                      code: ({node, inline, ...props}) => inline
                        ? <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85em', color: 'var(--color-hover)' }} {...props} />
                        : <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '0.85em', overflowX: 'auto', color: 'var(--text-secondary)' }} {...props} />,
                      pre: ({node, ...props}) => <pre style={{ margin: '12px 0', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', overflowX: 'auto' }} {...props} />,
                      a: ({node, ...props}) => <a style={{ color: 'var(--color-hover)', textDecoration: 'underline' }} {...props} />,
                      hr: ({node, ...props}) => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} {...props} />
                    }}
                  >
                    {selectedMeeting.notes}
                  </ReactMarkdown>
                </div>
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic' }}>No notes recorded</p>
              )}
            </div>

            {/* Action Items Section - Mobile */}
            <div style={{
              padding: '16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.1)'
            }}>
              <div
                onClick={() => setShowActionItems(!showActionItems)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: showActionItems ? '12px' : 0,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                    Action Items
                  </h4>
                  {actionItems.length > 0 && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: getActionItemSummary().completed === getActionItemSummary().total ? 'var(--color-status-positive)' : 'var(--color-hover)',
                      background: getActionItemSummary().completed === getActionItemSummary().total
                        ? 'rgba(40, 167, 69, 0.15)'
                        : 'rgba(207, 181, 59, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      {getActionItemSummary().completed}/{getActionItemSummary().total} completed
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {canEdit && showActionItems && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCreateActionItem(); }}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      + Add
                    </button>
                  )}
                  <span style={{ color: '#888', fontSize: '0.8rem' }}>{showActionItems ? '▼' : '▶'}</span>
                </div>
              </div>

              {showActionItems && (
                actionItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {actionItems.map(item => {
                      const isDone = item.status === 'done';
                      return (
                        <div
                          key={item.id}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            opacity: isDone ? 0.6 : 1
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                            {/* Check ring */}
                            <button
                              onClick={() => handleToggleStatus(item)}
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                border: isDone ? '2px solid var(--color-status-positive)' : '2px solid #888',
                                background: isDone ? 'var(--color-status-positive)' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: '2px'
                              }}
                            >
                              {isDone && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</span>}
                            </button>
                            <div style={{
                              flex: 1,
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)'
                            }}>
                              {item.task}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                              {getPriorityBadge(item.priority)}
                              {getStatusBadge(item.status)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.75rem', color: '#888', alignItems: 'center', marginLeft: '30px' }}>
                            {item.assignee_name && (
                              <button
                                className="meeting-assignee-link"
                                style={{
                                  color: 'var(--color-hover)',
                                  textDecoration: 'none',
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  fontSize: 'inherit',
                                  fontFamily: 'inherit'
                                }}
                                onClick={(e) => handleAssigneeClick(e, item.assignee_email, item.assignee_name)}
                              >
                                {item.assignee_name}
                              </button>
                            )}
                            {item.due_date && (
                              <span>Due: {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                            )}
                            {canEdit && (
                              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleTogglePin(item)}
                                  title={item.show_in_pipeline ? 'Unpin from Pipeline' : 'Pin to Pipeline'}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    padding: '2px',
                                    opacity: item.show_in_pipeline ? 1 : 0.5
                                  }}
                                >
                                  <span style={{ color: item.show_in_pipeline ? 'var(--color-hover)' : '#888' }}>📌</span>
                                </button>
                                <button
                                  onClick={() => handleEditActionItem(item)}
                                  style={{ background: 'none', border: 'none', color: 'var(--color-hover)', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteActionItem(item.id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--color-status-negative)', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Attachments row */}
                          <div style={{ marginTop: '8px', marginLeft: '30px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                            {item.attachments?.map(att => (
                              <div
                                key={att.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(0, 102, 51, 0.15)',
                                  border: '1px solid rgba(0, 102, 51, 0.3)',
                                  borderRadius: '12px',
                                  padding: '3px 8px',
                                  fontSize: '0.7rem'
                                }}
                              >
                                <a
                                  href={att.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: 'var(--color-hover)',
                                    textDecoration: 'none',
                                    maxWidth: '80px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {att.file_name}
                                </a>
                                {canEdit && (
                                  <button
                                    onClick={() => handleDeleteActionItemAttachment(item.id, att.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#888',
                                      cursor: 'pointer',
                                      padding: 0,
                                      fontSize: '0.7rem',
                                      lineHeight: 1
                                    }}
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            {canEdit && (
                              <label style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '12px',
                                padding: '3px 8px',
                                fontSize: '0.7rem',
                                color: '#888',
                                cursor: 'pointer'
                              }}>
                                {uploadingAttachment === item.id ? '...' : '+ Attach'}
                                <input
                                  type="file"
                                  onChange={(e) => handleActionItemAttachmentUpload(e, item.id)}
                                  style={{ display: 'none' }}
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                                  disabled={uploadingAttachment === item.id}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#666', fontSize: '0.8rem', margin: 0 }}>No action items yet</p>
                )
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
                          color: 'var(--color-hover)',
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
                <h2 style={{ margin: 0, color: 'var(--color-hover)', fontSize: '1.1rem' }}>
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
                <label>Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g., Akashya, Zoom, Google Meet"
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
                  style={{ flex: 1, marginTop: 0, background: 'var(--color-status-negative)' }}
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
          <h3>Meeting Minutes</h3>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: '0.85rem' }}>
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        {canEdit && (
        <button onClick={handleCreate} className="btn-new-meeting" style={{ width: 'auto', padding: '12px 24px', marginTop: 0 }}>
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
                <div className="meeting-date" style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-hover)',
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
                  <div className="meeting-date" style={{ color: 'var(--color-hover)', fontSize: '0.85rem', marginBottom: '6px' }}>
                    {formatDate(selectedMeeting.meeting_date)}
                  </div>
                  {selectedMeeting.location && (
                    <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '6px' }}>
                      {selectedMeeting.location}
                    </div>
                  )}
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
                    style={{ padding: '8px 16px', color: 'var(--color-status-negative)', borderColor: 'var(--color-status-negative)' }}
                  >
                    Delete
                  </button>
                </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ padding: '24px' }}>
                {selectedMeeting.notes ? (
                  <div className="meeting-notes-markdown meeting-notes-markdown-desktop">
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 style={{ color: 'var(--color-hover)', fontSize: '1.25rem', fontWeight: '600', margin: '20px 0 10px 0', borderBottom: '1px solid rgba(0, 102, 51, 0.3)', paddingBottom: '8px' }} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{ color: 'var(--color-hover)', fontSize: '1.1rem', fontWeight: '600', margin: '18px 0 10px 0' }} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{ color: 'var(--color-hover)', fontSize: '1rem', fontWeight: '600', margin: '14px 0 8px 0' }} {...props} />,
                        h4: ({node, ...props}) => <h4 style={{ color: 'var(--color-hover)', fontSize: '0.95rem', fontWeight: '600', margin: '12px 0 6px 0' }} {...props} />,
                        p: ({node, ...props}) => <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', margin: '0 0 10px 0', fontSize: '0.95rem' }} {...props} />,
                        ul: ({node, ...props}) => <ul style={{ margin: '10px 0', paddingLeft: '24px', color: 'var(--text-secondary)' }} {...props} />,
                        ol: ({node, ...props}) => <ol style={{ margin: '10px 0', paddingLeft: '24px', color: 'var(--text-secondary)' }} {...props} />,
                        li: ({node, ...props}) => <li style={{ marginBottom: '6px', lineHeight: '1.6', fontSize: '0.95rem' }} {...props} />,
                        strong: ({node, ...props}) => <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }} {...props} />,
                        em: ({node, ...props}) => <em style={{ color: 'var(--text-secondary)' }} {...props} />,
                        table: ({node, ...props}) => <div style={{ overflowX: 'auto', margin: '16px 0' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }} {...props} /></div>,
                        thead: ({node, ...props}) => <thead style={{ background: 'rgba(0, 102, 51, 0.2)' }} {...props} />,
                        th: ({node, ...props}) => <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid rgba(0, 102, 51, 0.3)', color: 'var(--color-hover)', fontWeight: '600' }} {...props} />,
                        td: ({node, ...props}) => <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }} {...props} />,
                        blockquote: ({node, ...props}) => <blockquote style={{ margin: '16px 0', paddingLeft: '16px', borderLeft: '3px solid var(--color-hover)', color: '#888', fontStyle: 'italic' }} {...props} />,
                        code: ({node, inline, ...props}) => inline
                          ? <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85em', color: 'var(--color-hover)' }} {...props} />
                          : <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', fontSize: '0.85em', overflowX: 'auto', color: 'var(--text-secondary)' }} {...props} />,
                        pre: ({node, ...props}) => <pre style={{ margin: '16px 0', background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '8px', overflowX: 'auto' }} {...props} />,
                        a: ({node, ...props}) => <a style={{ color: 'var(--color-hover)', textDecoration: 'underline' }} {...props} />,
                        hr: ({node, ...props}) => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '20px 0' }} {...props} />
                      }}
                    >
                      {selectedMeeting.notes}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No notes recorded</p>
                )}
              </div>

              {/* Action Items Section - Desktop */}
              <div style={{
                padding: '20px 24px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.1)'
              }}>
                <div
                  onClick={() => setShowActionItems(!showActionItems)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: showActionItems ? '16px' : 0,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      Action Items
                    </h4>
                    {actionItems.length > 0 && (
                      <span style={{
                        fontSize: '0.75rem',
                        color: getActionItemSummary().completed === getActionItemSummary().total ? 'var(--color-status-positive)' : 'var(--color-hover)',
                        background: getActionItemSummary().completed === getActionItemSummary().total
                          ? 'rgba(40, 167, 69, 0.15)'
                          : 'rgba(207, 181, 59, 0.15)',
                        padding: '3px 10px',
                        borderRadius: '12px'
                      }}>
                        {getActionItemSummary().completed}/{getActionItemSummary().total} completed
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {canEdit && showActionItems && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCreateActionItem(); }}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        + Add Item
                      </button>
                    )}
                    <span style={{ color: '#888', fontSize: '0.85rem' }}>{showActionItems ? '▼' : '▶'}</span>
                  </div>
                </div>

                {showActionItems && (
                  actionItems.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {actionItems.map(item => {
                        const isDone = item.status === 'done';
                        return (
                          <div
                            key={item.id}
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '8px',
                              padding: '14px 16px',
                              opacity: isDone ? 0.6 : 1
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                              {/* Check ring */}
                              <button
                                onClick={() => handleToggleStatus(item)}
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  border: isDone ? '2px solid var(--color-status-positive)' : '2px solid #888',
                                  background: isDone ? 'var(--color-status-positive)' : 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: '2px'
                                }}
                              >
                                {isDone && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>✓</span>}
                              </button>
                              <div style={{
                                flex: 1,
                                fontSize: '0.9rem',
                                color: 'var(--text-primary)',
                                fontWeight: '500'
                              }}>
                                {item.task}
                              </div>
                              <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                                {getPriorityBadge(item.priority)}
                                {getStatusBadge(item.status)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', color: '#888', alignItems: 'center', marginLeft: '34px' }}>
                              {item.assignee_name && (
                                <span>
                                  Assigned to:{' '}
                                  <button
                                    className="meeting-assignee-link"
                                    style={{
                                      color: 'var(--color-hover)',
                                      textDecoration: 'none',
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      cursor: 'pointer',
                                      fontSize: 'inherit',
                                      fontFamily: 'inherit'
                                    }}
                                    onClick={(e) => handleAssigneeClick(e, item.assignee_email, item.assignee_name)}
                                  >
                                    {item.assignee_name}
                                  </button>
                                </span>
                              )}
                              {item.due_date && (
                                <span>Due: {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                              )}
                              {canEdit && (
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <button
                                    onClick={() => handleTogglePin(item)}
                                    title={item.show_in_pipeline ? 'Unpin from Pipeline' : 'Pin to Pipeline'}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '1rem',
                                      padding: '2px 4px',
                                      opacity: item.show_in_pipeline ? 1 : 0.5
                                    }}
                                  >
                                    <span style={{ color: item.show_in_pipeline ? 'var(--color-hover)' : '#888' }}>📌</span>
                                  </button>
                                  <button
                                    onClick={() => handleEditActionItem(item)}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-hover)', cursor: 'pointer', fontSize: '0.8rem' }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteActionItem(item.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-status-negative)', cursor: 'pointer', fontSize: '0.8rem' }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                            {/* Attachments row */}
                            <div style={{ marginTop: '10px', marginLeft: '34px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                              {item.attachments?.map(att => (
                                <div
                                  key={att.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(0, 102, 51, 0.15)',
                                    border: '1px solid rgba(0, 102, 51, 0.3)',
                                    borderRadius: '14px',
                                    padding: '4px 10px',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  <a
                                    href={att.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      color: 'var(--color-hover)',
                                      textDecoration: 'none',
                                      maxWidth: '120px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {att.file_name}
                                  </a>
                                  {canEdit && (
                                    <button
                                      onClick={() => handleDeleteActionItemAttachment(item.id, att.id)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#888',
                                        cursor: 'pointer',
                                        padding: 0,
                                        fontSize: '0.8rem',
                                        lineHeight: 1
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                              {canEdit && (
                                <label style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  borderRadius: '14px',
                                  padding: '4px 10px',
                                  fontSize: '0.75rem',
                                  color: '#888',
                                  cursor: 'pointer'
                                }}>
                                  {uploadingAttachment === item.id ? 'Uploading...' : '+ Attach'}
                                  <input
                                    type="file"
                                    onChange={(e) => handleActionItemAttachmentUpload(e, item.id)}
                                    style={{ display: 'none' }}
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                                    disabled={uploadingAttachment === item.id}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: '#666', fontSize: '0.85rem', margin: 0 }}>No action items yet</p>
                  )
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
                            color: 'var(--color-hover)',
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
              <h2 style={{ margin: 0, color: 'var(--color-hover)', fontSize: '1.2rem' }}>
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
              <label>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Akashya, Zoom, Google Meet"
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
                style={{ padding: '10px 20px', width: 'auto', marginTop: 0, background: 'var(--color-status-negative)' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Item Modal */}
      <ActionItemModal
        isOpen={showActionItemModal}
        onClose={() => setShowActionItemModal(false)}
        onSave={handleSaveActionItem}
        editingItem={editingActionItem}
        admins={admins}
        meetingId={selectedMeeting?.id}
        defaultPinned={false}
      />

      {/* Confirm Delete Action Item Modal */}
      {confirmDeleteActionItem && (
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
              Delete this action item?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDeleteActionItem(null)}
                className="btn-secondary"
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteActionItem(confirmDeleteActionItem)}
                className="btn-primary"
                style={{ padding: '10px 20px', width: 'auto', marginTop: 0, background: 'var(--color-status-negative)' }}
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