import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../api';
import ActionItemModal from './ActionItemModal';

export default function PipelineBoard({ readOnly = true }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [admins, setAdmins] = useState([]);

  // Permission check
  const canEdit = user?.is_super_admin || user?.pipeline_edit;

  // Don't render if user doesn't have permission
  if (!user?.is_super_admin && !user?.pipeline_edit) {
    return null;
  }

  useEffect(() => {
    fetchPipelineItems();
    if (!readOnly) {
      fetchAdmins();
    }
  }, [readOnly]);

  const fetchPipelineItems = async () => {
    try {
      const res = await apiGet('/api/pipeline-items');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch pipeline items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await apiGet('/api/meetings/admins/list');
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins || []);
      }
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    }
  };

  const handleSaveItem = async (formData) => {
    try {
      const res = await apiPost('/api/pipeline-items', formData);
      if (res.ok) {
        setShowModal(false);
        fetchPipelineItems();
      }
    } catch (err) {
      console.error('Failed to create pipeline item:', err);
    }
  };

  // Filter to active items only (not done)
  const activeItems = items.filter(item => item.status !== 'done');

  const getPriorityBadge = (priority) => {
    const styles = {
      critical: { bg: 'var(--color-priority-critical-bg)', color: 'var(--color-priority-critical)', text: 'Critical' },
      high: { bg: 'var(--color-priority-high-bg)', color: 'var(--color-priority-high)', text: 'High' },
      medium: { bg: 'var(--color-status-warning-bg)', color: 'var(--color-status-warning)', text: 'Medium' },
      low: { bg: 'var(--color-status-neutral-bg)', color: 'var(--color-status-neutral)', text: 'Low' }
    };
    const style = styles[priority?.toLowerCase()] || styles.medium;
    return (
      <span style={{
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

  const getStatusBadge = (status) => {
    const styles = {
      not_started: { bg: 'var(--color-status-neutral-bg)', color: 'var(--color-status-neutral)', text: 'Not Started' },
      in_progress: { bg: 'var(--color-status-info-bg)', color: 'var(--color-status-info)', text: 'In Progress' },
      done: { bg: 'var(--color-status-positive-bg)', color: 'var(--color-status-positive)', text: 'Done' }
    };
    const style = styles[status?.toLowerCase()] || styles.not_started;
    return (
      <span style={{
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

  if (loading) {
    return null;
  }

  // If no active items and user can't edit → hide completely
  if (activeItems.length === 0 && !canEdit) {
    return null;
  }

  // If no active items but user can edit → show only add button
  if (activeItems.length === 0 && canEdit) {
    return (
      <div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          + Add Pipeline Item
        </button>

        {!readOnly && (
          <ActionItemModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onSave={handleSaveItem}
            editingItem={null}
            admins={admins}
            meetingId={null}
            defaultPinned={true}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Green dot */}
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'var(--color-hover)',
            display: 'inline-block'
          }} />
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
            Pipeline
          </span>
          <span style={{
            fontSize: '0.75rem',
            color: '#888',
            background: 'rgba(255,255,255,0.05)',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {activeItems.length} active
          </span>
        </div>

        {/* Add button - only if canEdit */}
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            + Add Item
          </button>
        )}
      </div>

      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeItems.map(item => (
          <div
            key={item.id}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              padding: '12px 14px'
            }}
          >
            {/* Task and badges */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '8px'
            }}>
              <div style={{
                flex: 1,
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontWeight: '500'
              }}>
                {item.task}
              </div>
              <div style={{ display: 'flex', gap: '6px', marginLeft: '10px', flexShrink: 0 }}>
                {getPriorityBadge(item.priority)}
                {getStatusBadge(item.status)}
              </div>
            </div>

            {/* Meta row */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '0.75rem',
              color: '#888',
              alignItems: 'center'
            }}>
              {/* Assignee */}
              {(item.assignee_first_name || item.first_name) && (
                <span>
                  {item.assignee_first_name || item.first_name} {item.assignee_last_name || item.last_name}
                </span>
              )}

              {/* Due date */}
              {item.due_date && (
                <span>
                  Due: {new Date(item.due_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC'
                  })}
                </span>
              )}

              {/* Meeting chip or standalone */}
              {item.meeting_title ? (
                <span style={{
                  background: 'rgba(0, 102, 51, 0.15)',
                  border: '1px solid rgba(0, 102, 51, 0.3)',
                  borderRadius: '10px',
                  padding: '2px 8px',
                  color: 'var(--color-hover)',
                  fontSize: '0.7rem'
                }}>
                  {item.meeting_title}
                </span>
              ) : (
                <span style={{
                  color: '#666',
                  fontStyle: 'italic',
                  fontSize: '0.7rem'
                }}>
                  standalone
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action Item Modal - only if not readOnly */}
      {!readOnly && (
        <ActionItemModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSaveItem}
          editingItem={null}
          admins={admins}
          meetingId={null}
          defaultPinned={true}
        />
      )}
    </div>
  );
}
