import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import ActionItemModal from './ActionItemModal';

export default function PipelineBoard({ readOnly = true }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('pipeline_collapsed');
    return saved !== 'false'; // Default to collapsed (true)
  });

  // Track last fetch time
  const lastFetchRef = useRef(0);

  // Permission check
  const canEdit = user?.is_super_admin || user?.pipeline_edit;

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('pipeline_collapsed', String(newState));
  };

  // Define fetchPipelineItems with useCallback so it's stable
  const fetchPipelineItems = useCallback(async () => {
    try {
      const res = await apiGet('/api/pipeline-items');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        lastFetchRef.current = Date.now();
      }
    } catch (err) {
      console.error('Failed to fetch pipeline items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Initial fetch, event listener, and polling - all in one useEffect with no dependencies
  useEffect(() => {
    // Initial fetch
    fetchPipelineItems();

    // Check if there's a recent pin toggle we missed
    const lastPinTime = parseInt(localStorage.getItem('pipeline_last_pin') || '0', 10);
    if (lastPinTime > lastFetchRef.current) {
      fetchPipelineItems();
    }

    // Listen for pipeline-refresh events from other components
    const handleRefresh = () => {
      fetchPipelineItems();
    };
    window.addEventListener('pipeline-refresh', handleRefresh);

    // Polling every 3 seconds
    const pollInterval = setInterval(() => {
      // Check localStorage for recent pin toggles
      const lastPinTime = parseInt(localStorage.getItem('pipeline_last_pin') || '0', 10);
      if (lastPinTime > lastFetchRef.current) {
        fetchPipelineItems();
      }
    }, 3000);

    return () => {
      window.removeEventListener('pipeline-refresh', handleRefresh);
      clearInterval(pollInterval);
    };
  }, [fetchPipelineItems]);

  // Fetch admins when not readOnly
  useEffect(() => {
    if (!readOnly) {
      fetchAdmins();
    }
  }, [readOnly]);

  // Don't render if user doesn't have permission (after all hooks)
  if (!user?.is_super_admin && !user?.pipeline_edit) {
    return null;
  }

  const handleSaveItem = async (formData, existingItem) => {
    try {
      if (existingItem) {
        // Update existing item
        const res = await apiPut(`/api/action-items/${existingItem.id}`, formData);
        if (res.ok) {
          setShowModal(false);
          setEditingItem(null);
          fetchPipelineItems();
        }
      } else {
        // Create new item
        const res = await apiPost('/api/pipeline-items', formData);
        if (res.ok) {
          setShowModal(false);
          fetchPipelineItems();
        }
      }
    } catch (err) {
      console.error('Failed to save pipeline item:', err);
    }
  };

  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'done' ? 'not_started' : 'done';
    try {
      const res = await apiPut(`/api/action-items/${item.id}`, { status: newStatus });
      if (res.ok) {
        setItems(items.map(i => i.id === item.id ? { ...i, status: newStatus, updated_at: new Date().toISOString() } : i));
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm('Delete this action item?')) return;
    try {
      const res = await apiDelete(`/api/action-items/${item.id}`);
      if (res.ok) {
        setItems(items.filter(i => i.id !== item.id));
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  // Split items into active and done
  const activeItems = items.filter(item => item.status !== 'done');
  const doneItems = items.filter(item => item.status === 'done');

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

  // While loading: show slim header with loading indicator
  if (loading) {
    return (
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
            Pipeline
          </span>
          <span style={{ fontSize: '0.75rem', color: '#666' }}>Loading...</span>
        </div>
      </div>
    );
  }

  // After loading: if no active items and can't edit → hide completely
  if (activeItems.length === 0 && !canEdit) {
    return null;
  }

  return (
    <div>
      {/* Collapsible Header */}
      <div
        onClick={toggleCollapsed}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          marginBottom: collapsed ? 0 : '16px'
        }}
      >
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

        {/* Chevron */}
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          {collapsed ? '▶' : '▼'}
        </span>
      </div>

      {/* Expanded Content */}
      {!collapsed && (
        <>
          {/* Add button - only if canEdit */}
          {canEdit && (
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingItem(null); setShowModal(true); }}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                + Add Item
              </button>
            </div>
          )}

          {/* Active Items list */}
          {activeItems.length > 0 && (
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    {/* Check ring - canEdit only */}
                    {canEdit && (
                      <button
                        onClick={() => handleToggleStatus(item)}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: '2px solid #888',
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}
                      />
                    )}

                    <div style={{ flex: 1 }}>
                      {/* Task text - full width */}
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        fontWeight: '500',
                        marginBottom: '6px'
                      }}>
                        {item.task}
                      </div>
                      {/* Badges row */}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        {getPriorityBadge(item.priority)}
                        {getStatusBadge(item.status)}
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

                        {/* Edit/Delete buttons - canEdit only */}
                        {canEdit && (
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleEditItem(item)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#888',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '2px 6px'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#888',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '2px 6px'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No active items message for canEdit users */}
          {activeItems.length === 0 && canEdit && doneItems.length > 0 && (
            <div style={{
              padding: '12px',
              color: '#666',
              fontSize: '0.85rem',
              fontStyle: 'italic'
            }}>
              No active items
            </div>
          )}

          {/* Done Items / History section */}
          {doneItems.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                fontSize: '0.8rem',
                color: '#666',
                marginBottom: '10px',
                fontWeight: '500'
              }}>
                Completed ({doneItems.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {doneItems.map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      opacity: 0.6
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      {/* Completed check ring */}
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: '2px solid var(--color-status-positive)',
                          background: 'var(--color-status-positive)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}
                      >
                        <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</span>
                      </div>

                      <div style={{ flex: 1 }}>
                        {/* Task - no strikethrough, just opacity from parent */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'
                        }}>
                          <div style={{
                            flex: 1,
                            fontSize: '0.85rem',
                            color: 'var(--text-primary)'
                          }}>
                            {item.task}
                          </div>

                          {/* Undo button - canEdit only */}
                          {canEdit && (
                            <button
                              onClick={() => handleToggleStatus(item)}
                              title="Undo - move back to active"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#888',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                padding: '2px 6px',
                                marginLeft: '10px'
                              }}
                            >
                              ↩
                            </button>
                          )}
                        </div>

                        {/* Meta row */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '10px',
                          fontSize: '0.7rem',
                          color: '#666',
                          marginTop: '4px'
                        }}>
                          {(item.assignee_first_name || item.first_name) && (
                            <span>
                              {item.assignee_first_name || item.first_name} {item.assignee_last_name || item.last_name}
                            </span>
                          )}
                          {item.meeting_title && (
                            <span>{item.meeting_title}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Action Item Modal */}
      <ActionItemModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingItem(null); }}
        onSave={handleSaveItem}
        editingItem={editingItem}
        admins={admins}
        meetingId={null}
        defaultPinned={true}
      />
    </div>
  );
}
