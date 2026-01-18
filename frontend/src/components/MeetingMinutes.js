import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useActionItems } from '../context/ActionItemsContext';

export default function MeetingMinutes({ token, canEdit = false, initialMeetingId = null, onMeetingSelected = null }) {
  const { user } = useAuth();
  const { updateVersion, lastUpdatedItem, notifyActionItemUpdate } = useActionItems();
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

  // Action items state
  const [actionItems, setActionItems] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [showActionItems, setShowActionItems] = useState(true);
  const [showActionItemModal, setShowActionItemModal] = useState(false);
  const [editingActionItem, setEditingActionItem] = useState(null);
  const [savingActionItem, setSavingActionItem] = useState(false);
  const [confirmDeleteActionItem, setConfirmDeleteActionItem] = useState(null);
  const [actionItemForm, setActionItemForm] = useState({
    task: '',
    assignee_id: '',
    due_date: '',
    status: 'not_started',
    priority: 'medium'
  });

  useEffect(() => {
    fetchMeetings();
    fetchAdmins();

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [token]);

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
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/meetings', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/meetings/admins/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  };

  const fetchActionItems = async (meetingId) => {
    try {
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/meetings/${meetingId}/action-items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setActionItems(data.actionItems || []);
    } catch (err) {
      console.error('Failed to fetch action items:', err);
    }
  };

  // Action item handlers
  const handleCreateActionItem = () => {
    setActionItemForm({
      task: '',
      assignee_id: '',
      due_date: '',
      status: 'not_started',
      priority: 'medium'
    });
    setEditingActionItem(null);
    setShowActionItemModal(true);
  };

  const handleEditActionItem = (item) => {
    setActionItemForm({
      task: item.task,
      assignee_id: item.assignee_id || '',
      due_date: item.due_date ? item.due_date.split('T')[0] : '',
      status: item.status,
      priority: item.priority || 'medium'
    });
    setEditingActionItem(item);
    setShowActionItemModal(true);
  };

  const handleSaveActionItem = async () => {
    setSavingActionItem(true);
    try {
      const url = editingActionItem
        ? `https://the-golden-batch-api.onrender.com/api/meetings/${selectedMeeting.id}/action-items/${editingActionItem.id}`
        : `https://the-golden-batch-api.onrender.com/api/meetings/${selectedMeeting.id}/action-items`;

      const res = await fetch(url, {
        method: editingActionItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(actionItemForm)
      });

      if (res.ok) {
        setShowActionItemModal(false);
        fetchActionItems(selectedMeeting.id);
        // Notify other components (like MyTasks) about the update
        if (editingActionItem) {
          notifyActionItemUpdate(editingActionItem.id, actionItemForm.status);
        }
      }
    } catch (err) {
      console.error('Failed to save action item:', err);
    } finally {
      setSavingActionItem(false);
    }
  };

  const handleDeleteActionItem = async (actionItemId) => {
    try {
      const res = await fetch(
        `https://the-golden-batch-api.onrender.com/api/meetings/${selectedMeeting.id}/action-items/${actionItemId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.ok) {
        setActionItems(actionItems.filter(ai => ai.id !== actionItemId));
        setConfirmDeleteActionItem(null);
      }
    } catch (err) {
      console.error('Failed to delete action item:', err);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      not_started: { bg: 'rgba(128, 128, 128, 0.2)', color: '#888', text: 'Not Started', className: 'status-not-started' },
      in_progress: { bg: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', text: 'In Progress', className: 'status-in-progress' },
      done: { bg: 'rgba(40, 167, 69, 0.2)', color: '#28a745', text: 'Done', className: 'status-done' }
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
      critical: { bg: 'rgba(220, 53, 69, 0.2)', color: '#dc3545', text: 'Critical', className: 'priority-critical' },
      high: { bg: 'rgba(255, 140, 0, 0.2)', color: '#ff8c00', text: 'High', className: 'priority-high' },
      medium: { bg: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', text: 'Medium', className: 'priority-medium' },
      low: { bg: 'rgba(128, 128, 128, 0.2)', color: '#888', text: 'Low', className: 'priority-low' }
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
        ? `https://the-golden-batch-api.onrender.com/api/meetings/${selectedMeeting.id}`
        : 'https://the-golden-batch-api.onrender.com/api/meetings';
      
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
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/meetings/${id}`, {
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
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/meetings/${selectedMeeting.id}/attachments`, {
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
        `https://the-golden-batch-api.onrender.com/api/meetings/${selectedMeeting.id}/attachments/${attachmentId}`,
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
                      color: getActionItemSummary().completed === getActionItemSummary().total ? '#28a745' : '#CFB53B',
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
                    {actionItems.map(item => (
                      <div
                        key={item.id}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '8px',
                          padding: '10px 12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {item.task}
                          </div>
                          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                            {getPriorityBadge(item.priority)}
                            {getStatusBadge(item.status)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.75rem', color: '#888' }}>
                          {item.assignee_name && (
                            <Link
                              to={`/profile/${item.assignee_email}`}
                              style={{ color: '#CFB53B', textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.assignee_name}
                            </Link>
                          )}
                          {item.due_date && (
                            <span>Due: {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                          {canEdit && (
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleEditActionItem(item)}
                                style={{ background: 'none', border: 'none', color: '#CFB53B', cursor: 'pointer', fontSize: '0.75rem' }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteActionItem(item.id)}
                                style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '0.75rem' }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
                        color: getActionItemSummary().completed === getActionItemSummary().total ? '#28a745' : '#CFB53B',
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
                      {actionItems.map(item => (
                        <div
                          key={item.id}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            padding: '14px 16px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                              {item.task}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                              {getPriorityBadge(item.priority)}
                              {getStatusBadge(item.status)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', color: '#888', alignItems: 'center' }}>
                            {item.assignee_name && (
                              <span>
                                Assigned to:{' '}
                                <Link
                                  to={`/profile/${item.assignee_email}`}
                                  style={{ color: '#CFB53B', textDecoration: 'none' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {item.assignee_name}
                                </Link>
                              </span>
                            )}
                            {item.due_date && (
                              <span>Due: {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            )}
                            {canEdit && (
                              <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
                                <button
                                  onClick={() => handleEditActionItem(item)}
                                  style={{ background: 'none', border: 'none', color: '#CFB53B', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteActionItem(item.id)}
                                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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

      {/* Action Item Modal */}
      {showActionItemModal && (
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
          paddingTop: isMobile ? '20px' : '80px',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div style={{
            background: 'linear-gradient(165deg, rgba(30, 40, 35, 0.98) 0%, rgba(20, 28, 24, 0.99) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: isMobile ? '20px' : '28px',
            width: isMobile ? '95%' : '450px',
            maxWidth: '450px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#CFB53B', fontSize: '1.1rem' }}>
                {editingActionItem ? 'Edit Action Item' : 'New Action Item'}
              </h2>
              <button
                onClick={() => setShowActionItemModal(false)}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div className="form-group">
              <label>Task Description *</label>
              <textarea
                value={actionItemForm.task}
                onChange={(e) => setActionItemForm({ ...actionItemForm, task: e.target.value })}
                placeholder="What needs to be done?"
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#ffffff',
                  resize: 'vertical'
                }}
              />
            </div>

            <div className="form-group">
              <label>Assignee</label>
              <select
                value={actionItemForm.assignee_id}
                onChange={(e) => setActionItemForm({ ...actionItemForm, assignee_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#ffffff'
                }}
              >
                <option value="">Unassigned</option>
                {admins.map(admin => (
                  <option key={admin.id} value={admin.id}>
                    {admin.display_name || `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.email}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Due Date</label>
                <input
                  type="date"
                  value={actionItemForm.due_date}
                  onChange={(e) => setActionItemForm({ ...actionItemForm, due_date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#ffffff'
                  }}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label>Priority</label>
                <select
                  value={actionItemForm.priority}
                  onChange={(e) => setActionItemForm({ ...actionItemForm, priority: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#ffffff'
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={actionItemForm.status}
                onChange={(e) => setActionItemForm({ ...actionItemForm, status: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '0.9rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#ffffff'
                }}
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setShowActionItemModal(false)}
                className="btn-secondary"
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveActionItem}
                className="btn-primary"
                style={{ width: 'auto', padding: '10px 24px', marginTop: 0 }}
                disabled={savingActionItem || !actionItemForm.task}
              >
                {savingActionItem ? 'Saving...' : editingActionItem ? 'Save' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

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