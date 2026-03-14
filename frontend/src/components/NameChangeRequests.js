import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut } from '../api';

export default function NameChangeRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [message, setMessage] = useState(null);

  // Only user id 1 can access this feature
  if (user?.id !== 1) {
    return null;
  }

  const fetchRequests = async () => {
    try {
      const res = await apiGet('/api/name-change-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Error fetching name change requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id) => {
    setProcessing(id);
    setMessage(null);
    try {
      const res = await apiPut(`/api/name-change-requests/${id}/approve`);
      if (res.ok) {
        setMessage({ type: 'success', text: 'Name change approved successfully.' });
        fetchRequests();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to approve' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to approve request' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id) => {
    setProcessing(id);
    setMessage(null);
    try {
      const res = await apiPut(`/api/name-change-requests/${id}/reject`);
      if (res.ok) {
        setMessage({ type: 'success', text: 'Name change rejected.' });
        fetchRequests();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to reject' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to reject request' });
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <p style={{ color: '#888' }}>Loading name change requests...</p>;
  }

  return (
    <div className="name-change-requests">
      <h3 style={{ color: 'var(--color-hover)', marginBottom: '16px' }}>Name Change Requests</h3>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: message.type === 'success' ? '#4ade80' : '#f87171'
        }}>
          {message.text}
        </div>
      )}

      {requests.length === 0 ? (
        <p style={{ color: '#888', fontStyle: 'italic' }}>No pending name change requests.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#888', fontWeight: '600' }}>Current Name</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#888', fontWeight: '600' }}>Requested Name</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#888', fontWeight: '600' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: '#888', fontWeight: '600' }}>Date</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', color: '#888', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--color-text-primary)' }}>
                    {request.current_first_name} {request.current_last_name}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--color-hover)', fontWeight: '500' }}>
                    {request.requested_first_name} {request.requested_last_name}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    {request.email}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    {formatDate(request.created_at)}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={processing === request.id}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: '#4ade80',
                          cursor: processing === request.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          opacity: processing === request.id ? 0.5 : 1
                        }}
                      >
                        {processing === request.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        disabled={processing === request.id}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          cursor: processing === request.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          opacity: processing === request.id ? 0.5 : 1
                        }}
                      >
                        {processing === request.id ? '...' : 'Reject'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
