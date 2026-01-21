import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActionItems } from '../context/ActionItemsContext';
import { API_URL } from '../config';

export default function MyTasks({ token }) {
  const navigate = useNavigate();
  const { notifyActionItemUpdate, updateVersion, lastUpdatedItem } = useActionItems();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchMyTasks();
  }, [token]);

  // Listen for action item updates from other components (e.g., MeetingMinutes)
  useEffect(() => {
    if (updateVersion > 0 && lastUpdatedItem) {
      // Update the local tasks state if the updated item is in our list
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === lastUpdatedItem.id
            ? { ...task, status: lastUpdatedItem.status }
            : task
        )
      );
    }
  }, [updateVersion, lastUpdatedItem]);

  const fetchMyTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/action-items/my-tasks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch my tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    setUpdatingId(taskId);
    try {
      const res = await fetch(`${API_URL}/api/action-items/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        setTasks(tasks.map(task =>
          task.id === taskId ? { ...task, status: newStatus } : task
        ));
        // Notify other components (like MeetingMinutes) about the update
        notifyActionItemUpdate(taskId, newStatus);
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const navigateToMeeting = (meetingId) => {
    // Navigate to admin dashboard with meetings tab and specific meeting ID in URL
    navigate(`/admin?tab=meetings&meetingId=${meetingId}`);
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

  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    let color = 'var(--color-status-neutral)';
    if (diffDays < 0) color = 'var(--color-status-negative)'; // Overdue
    else if (diffDays === 0) color = 'var(--color-priority-high)'; // Today
    else if (diffDays <= 3) color = 'var(--color-status-warning)'; // Soon

    return (
      <span style={{ color, fontSize: '0.8rem' }}>
        {diffDays < 0 ? 'Overdue: ' : diffDays === 0 ? 'Today' : `Due: `}
        {diffDays !== 0 && date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
    );
  };

  const getSummary = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length;
    return { total, completed, overdue };
  };

  if (loading) {
    return null;
  }

  // Filter out completed tasks - only show 'not_started' and 'in_progress'
  const activeTasks = tasks.filter(t => t.status !== 'done');

  // Hide section if no active tasks (completed tasks still visible in Meetings tab)
  if (activeTasks.length === 0) {
    return null;
  }

  const summary = getSummary();

  return (
    <div
      id="my-tasks-section"
      style={{
        background: 'rgba(207, 181, 59, 0.05)',
        border: '1px solid rgba(207, 181, 59, 0.2)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          marginBottom: expanded ? '12px' : 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 className="my-tasks-heading" style={{ margin: 0, color: 'var(--color-hover)', fontSize: '1rem' }}>
            My Tasks
          </h3>
          <span className={summary.completed === summary.total ? 'my-tasks-badge completed' : 'my-tasks-badge pending'} style={{
            fontSize: '0.75rem',
            color: summary.completed === summary.total ? 'var(--color-status-positive)' : 'var(--color-hover)',
            background: summary.completed === summary.total
              ? 'rgba(40, 167, 69, 0.15)'
              : 'rgba(207, 181, 59, 0.15)',
            padding: '2px 8px',
            borderRadius: '10px'
          }}>
            {summary.completed}/{summary.total} completed
          </span>
          {summary.overdue > 0 && (
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--color-status-negative)',
              background: 'rgba(220, 53, 69, 0.15)',
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {summary.overdue} overdue
            </span>
          )}
        </div>
        <span style={{ color: '#888', fontSize: '0.85rem' }}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activeTasks.map(task => (
            <div
              key={task.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                  {task.task}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                  {getPriorityBadge(task.priority)}
                  {getStatusBadge(task.status)}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', fontSize: '0.8rem' }}>
                <button
                  className="task-meeting-link"
                  onClick={() => navigateToMeeting(task.meeting_id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-hover)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.8rem',
                    textDecoration: 'underline'
                  }}
                >
                  {task.meeting_title}
                </button>

                {task.due_date && formatDueDate(task.due_date)}

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem' }}>Status:</span>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    disabled={updatingId === task.id}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      cursor: updatingId === task.id ? 'wait' : 'pointer'
                    }}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
