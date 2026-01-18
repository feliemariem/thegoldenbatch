import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MyTasks({ token }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchMyTasks();
  }, [token]);

  const fetchMyTasks = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/action-items/my-tasks', {
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
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/action-items/${taskId}`, {
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
      not_started: { bg: 'rgba(128, 128, 128, 0.2)', color: '#888', text: 'Not Started' },
      in_progress: { bg: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', text: 'In Progress' },
      done: { bg: 'rgba(40, 167, 69, 0.2)', color: '#28a745', text: 'Done' }
    };
    const style = styles[status] || styles.not_started;
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

  const getPriorityBadge = (priority) => {
    const styles = {
      critical: { bg: 'rgba(220, 53, 69, 0.2)', color: '#dc3545', text: 'Critical' },
      high: { bg: 'rgba(255, 140, 0, 0.2)', color: '#ff8c00', text: 'High' },
      medium: { bg: 'rgba(255, 193, 7, 0.2)', color: '#ffc107', text: 'Medium' },
      low: { bg: 'rgba(128, 128, 128, 0.2)', color: '#888', text: 'Low' }
    };
    const style = styles[priority] || styles.medium;
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

  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    let color = '#888';
    if (diffDays < 0) color = '#dc3545'; // Overdue
    else if (diffDays === 0) color = '#ff8c00'; // Today
    else if (diffDays <= 3) color = '#ffc107'; // Soon

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

  if (tasks.length === 0) {
    return null;
  }

  const summary = getSummary();

  return (
    <div style={{
      background: 'rgba(207, 181, 59, 0.05)',
      border: '1px solid rgba(207, 181, 59, 0.2)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px'
    }}>
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
          <h3 style={{ margin: 0, color: '#CFB53B', fontSize: '1rem' }}>
            My Tasks
          </h3>
          <span style={{
            fontSize: '0.75rem',
            color: summary.completed === summary.total ? '#28a745' : '#CFB53B',
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
              color: '#dc3545',
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
          {tasks.map(task => (
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
                  onClick={() => navigateToMeeting(task.meeting_id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#CFB53B',
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
