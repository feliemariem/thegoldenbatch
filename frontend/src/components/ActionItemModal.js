import React, { useState, useEffect } from 'react';

export default function ActionItemModal({
  isOpen,
  onClose,
  onSave,
  editingItem = null,
  admins = [],
  meetingId = null,
  defaultPinned = false
}) {
  const [form, setForm] = useState({
    task: '',
    assignee_id: '',
    due_date: '',
    status: 'not_started',
    priority: 'medium',
    show_in_pipeline: defaultPinned
  });
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset form when modal opens or editingItem changes
  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setForm({
          task: editingItem.task || '',
          assignee_id: editingItem.assignee_id || '',
          due_date: editingItem.due_date ? editingItem.due_date.split('T')[0] : '',
          status: editingItem.status || 'not_started',
          priority: editingItem.priority || 'medium',
          show_in_pipeline: editingItem.show_in_pipeline || false
        });
      } else {
        setForm({
          task: '',
          assignee_id: '',
          due_date: '',
          status: 'not_started',
          priority: 'medium',
          show_in_pipeline: defaultPinned
        });
      }
    }
  }, [isOpen, editingItem, defaultPinned]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // If no meetingId, force show_in_pipeline to true (standalone pipeline item)
      const dataToSave = {
        ...form,
        show_in_pipeline: meetingId === null ? true : form.show_in_pipeline
      };
      await onSave(dataToSave, editingItem);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
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
          <h2 style={{ margin: 0, color: 'var(--color-hover)', fontSize: '1.1rem' }}>
            {editingItem ? 'Edit Action Item' : 'New Action Item'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        <div className="form-group">
          <label>Task Description *</label>
          <textarea
            value={form.task}
            onChange={(e) => setForm({ ...form, task: e.target.value })}
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
            value={form.assignee_id}
            onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
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
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
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
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
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
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
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

        {/* Footer with pin toggle (only when meetingId exists) and buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '20px',
          paddingTop: meetingId !== null ? '16px' : '0',
          borderTop: meetingId !== null ? '1px solid rgba(255,255,255,0.08)' : 'none'
        }}>
          {/* Pin toggle - only show when meetingId exists */}
          {meetingId !== null ? (
            <button
              type="button"
              onClick={() => setForm({ ...form, show_in_pipeline: !form.show_in_pipeline })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: form.show_in_pipeline ? 'rgba(207, 181, 59, 0.15)' : 'transparent',
                border: form.show_in_pipeline ? '1px solid rgba(207, 181, 59, 0.4)' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: form.show_in_pipeline ? 'var(--color-hover)' : '#888',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: '1rem' }}>📌</span>
              <span>{form.show_in_pipeline ? 'Pinned to Pipeline' : 'Pin to Pipeline'}</span>
            </button>
          ) : (
            <div /> // Empty div to maintain flex layout
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '10px 20px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary"
              style={{ width: 'auto', padding: '10px 24px', marginTop: 0 }}
              disabled={saving || !form.task}
            >
              {saving ? 'Saving...' : editingItem ? 'Save' : 'Add Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
