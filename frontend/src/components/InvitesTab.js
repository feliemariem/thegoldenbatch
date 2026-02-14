import { useState, useRef, useEffect, useCallback } from 'react';
import ScrollableTable from './ScrollableTable';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';

export default function InvitesTab({
  isSuperAdmin,
  permissions,
  onRefresh,
  onConfirm,
  onStatsUpdate,
}) {
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState({ total: 0, registered: 0, pending: 0 });
  const [inviteForm, setInviteForm] = useState({ first_name: '', last_name: '', email: '' });
  const [inviteResult, setInviteResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [inviteSearch, setInviteSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [editingInvite, setEditingInvite] = useState(null);
  const [masterList, setMasterList] = useState([]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const invitesTableRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch invites with pagination
  const fetchInvites = useCallback(async (pageNum = 1, search = '', status = 'all') => {
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '45',
      });
      if (search.trim()) params.append('search', search.trim());
      if (status !== 'all') params.append('status', status);

      const res = await apiGet(`/api/invites?${params}`);
      const data = await res.json();

      setInvites(data.invites || []);
      setStats(data.stats || { total: 0, registered: 0, pending: 0 });
      setPage(data.pagination?.currentPage || 1);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);

      // Notify parent of stats update
      if (onStatsUpdate && data.stats) {
        onStatsUpdate(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch invites');
    }
  }, [onStatsUpdate]);

  // Initial fetch
  useEffect(() => {
    fetchInvites(1, inviteSearch, statusFilter);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchInvites(1, inviteSearch, statusFilter);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inviteSearch, statusFilter]);

  // Fetch master list for linking dropdown
  const fetchMasterList = async () => {
    try {
      const res = await apiGet('/api/master-list?limit=500');
      const data = await res.json();
      setMasterList(data.entries || []);
    } catch (err) {
      console.error('Failed to fetch master list');
    }
  };

  useEffect(() => {
    fetchMasterList();
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchInvites(newPage, inviteSearch, statusFilter);
      scrollToTop();
    }
  };

  const refreshInvites = () => {
    fetchInvites(page, inviteSearch, statusFilter);
    if (onRefresh) onRefresh();
  };

  const scrollToTop = () => {
    if (invitesTableRef.current) {
      invitesTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const copyLink = async (inviteToken) => {
    const link = `${window.location.origin}/register/${inviteToken}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(inviteToken);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const copyFullUrl = async (url) => {
    await navigator.clipboard.writeText(url);
    setCopiedId('invite-url');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setCreating(true);
    setInviteResult(null);

    try {
      const res = await apiPost('/api/invites', inviteForm);

      const data = await res.json();

      if (res.ok) {
        setInviteResult({ success: true, url: data.registrationUrl });
        setInviteForm({ first_name: '', last_name: '', email: '' });
        refreshInvites();
      } else {
        setInviteResult({ success: false, error: data.error });
      }
    } catch (err) {
      setInviteResult({ success: false, error: 'Failed to create invite' });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateInvite = async (id, updates) => {
    try {
      const res = await apiPut(`/api/invites/${id}`, updates);

      if (res.ok) {
        refreshInvites();
        setEditingInvite(null);
      }
    } catch (err) {
      console.error('Failed to update invite');
    }
  };

  const handleDeleteInvite = async (id) => {
    onConfirm({
      message: 'Delete this invite? This cannot be undone.',
      onConfirm: async () => {
        try {
          await apiDelete(`/api/invites/${id}`);
          refreshInvites();
        } catch (err) {
          console.error('Failed to delete invite');
        }
      }
    });
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header row if it exists
      const startIndex = lines[0].toLowerCase().includes('email') ? 1 : 0;

      const invitesToUpload = [];
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));

        // Find email column (contains @)
        const emailIndex = parts.findIndex(p => p.includes('@'));
        if (emailIndex === -1) continue;

        if (emailIndex >= 2) {
          invitesToUpload.push({
            first_name: parts[emailIndex - 2] || '',
            last_name: parts[emailIndex - 1] || '',
            email: parts[emailIndex]
          });
        } else if (emailIndex === 0) {
          invitesToUpload.push({ email: parts[0] });
        }
      }

      const res = await apiPost('/api/invites/bulk', { invites: invitesToUpload });

      const data = await res.json();
      setUploadResult(data);
      refreshInvites();
    } catch (err) {
      setUploadResult({ error: 'Failed to process CSV' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleLinkToMasterList = async (inviteId, masterListId) => {
    if (!masterListId) return;

    try {
      const res = await apiPut(`/api/invites/${inviteId}/link`, { master_list_id: masterListId });

      if (res.ok) {
        refreshInvites();
        fetchMasterList();
      }
    } catch (err) {
      console.error('Failed to link to master list');
    }
  };

  const handleUnlinkFromMasterList = async (inviteId) => {
    onConfirm({
      message: 'Unlink from master list?',
      onConfirm: async () => {
        try {
          const res = await apiPut(`/api/invites/${inviteId}/unlink`, {});

          if (res.ok) {
            refreshInvites();
            fetchMasterList();
          }
        } catch (err) {
          console.error('Failed to unlink from master list');
        }
      }
    });
  };

  const exportInvitesCSV = async () => {
    try {
      // Fetch all invites for export (no pagination)
      const res = await apiGet('/api/invites?limit=10000');
      const data = await res.json();
      const allInvites = data.invites || [];

      if (!allInvites.length) return;

      const headers = ['First Name', 'Last Name', 'Email', 'Status', 'Registration Link'];
      const rows = allInvites.map(i => [
        i.first_name || '',
        i.last_name || '',
        i.email,
        i.used ? 'Registered' : 'Pending',
        `${window.location.origin}/register/${i.invite_token}`
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'usls-batch-2003-invites.csv';
      a.click();
    } catch (err) {
      console.error('Failed to export invites');
    }
  };

  return (
    <>
      {/* Create Invite */}
      {(isSuperAdmin || permissions?.invites_add) && (
        <div className="invite-section">
          <h3>Add Single Invite</h3>
          <form onSubmit={handleCreateInvite} className="invite-form-full">
            <div className="form-row">
              <input
                type="text"
                value={inviteForm.first_name}
                onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                placeholder="First Name"
              />
              <input
                type="text"
                value={inviteForm.last_name}
                onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                placeholder="Last Name"
              />
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="Email *"
                required
              />
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>

          {inviteResult && (
            <div className={`invite-result ${inviteResult.success ? 'success' : 'error'}`}>
              {inviteResult.success ? (
                <>
                  <p>Invite created! Copy this link:</p>
                  <div className="invite-url">
                    <code>{inviteResult.url}</code>
                    <button
                      onClick={() => copyFullUrl(inviteResult.url)}
                      className={`btn-copy ${copiedId === 'invite-url' ? 'btn-copied' : ''}`}
                      disabled={copiedId === 'invite-url'}
                    >
                      {copiedId === 'invite-url' ? 'Copied ✓' : 'Copy'}
                    </button>
                  </div>
                </>
              ) : (
                <p>{inviteResult.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bulk Upload */}
      {(isSuperAdmin || permissions?.invites_upload) && (
        <div className="invite-section">
          <h3>Bulk Upload (CSV)</h3>
          <p className="help-text-small">CSV format: First Name, Last Name, Email</p>
          <div className="upload-row">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              disabled={uploading}
              id="csv-upload"
              className="file-input"
            />
            <label htmlFor="csv-upload" className="btn-secondary upload-btn">
              {uploading ? 'Uploading...' : 'Choose CSV File'}
            </label>
          </div>

          {uploadResult && (
            <div className={`invite-result ${uploadResult.error ? 'error' : 'success'}`}>
              {uploadResult.error ? (
                <p>{uploadResult.error}</p>
              ) : (
                <>
                  <p>
                    {uploadResult.success?.length || 0} invite{uploadResult.success?.length === 1 ? '' : 's'} created
                  </p>
                  {uploadResult.duplicates?.length > 0 && (
                    <p>
                      {uploadResult.duplicates.length} duplicate{uploadResult.duplicates.length === 1 ? '' : 's'} skipped
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invites Table */}
      <div className="users-section" ref={invitesTableRef}>
        <div className="section-header">
          <h3>All Invites ({stats.total})</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            {invites.length > 10 && (
              <button onClick={scrollToTop} className="btn-secondary" title="Scroll to top">
                ^ Top
              </button>
            )}
            {user?.email?.toLowerCase() === 'uslsis.batch2003@gmail.com' && (
              <button
                onClick={() => window.open('https://docs.google.com/spreadsheets/d/1Z-6dhL9CKeG6H4jFRSDLeqynfyFa-8HS0fZUqe8kAqE/edit?resourcekey=&gid=1685250365#gid=1685250365', '_blank')}
                className="btn-secondary"
              >
                📊 Responses
              </button>
            )}
            {(isSuperAdmin || permissions?.invites_export) && (
              <button onClick={exportInvitesCSV} className="btn-secondary">
                Export CSV
              </button>
            )}
          </div>
        </div>

        <div className="search-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={inviteSearch}
            onChange={(e) => setInviteSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending ({stats.pending})</option>
            <option value="registered">Registered ({stats.registered})</option>
          </select>
          {(inviteSearch || statusFilter !== 'all') && (
            <span className="search-count">
              {totalCount} result{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {invites.length > 0 ? (
          <>
            <ScrollableTable stickyHeader={true}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    {(isSuperAdmin || permissions?.invites_link) && <th>Link to Master List</th>}
                    <th>Registration Link</th>
                    {(isSuperAdmin || permissions?.invites_add) && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id}>
                      {editingInvite === invite.id ? (
                        <>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <input
                                type="text"
                                defaultValue={invite.first_name}
                                id={`edit-invite-firstname-${invite.id}`}
                                style={{ width: '80px', padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }}
                                placeholder="First"
                              />
                              <input
                                type="text"
                                defaultValue={invite.last_name}
                                id={`edit-invite-lastname-${invite.id}`}
                                style={{ width: '80px', padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }}
                                placeholder="Last"
                              />
                            </div>
                          </td>
                          <td>
                            <input
                              type="email"
                              defaultValue={invite.email}
                              id={`edit-invite-email-${invite.id}`}
                              style={{ width: '100%', padding: '4px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', color: '#666', cursor: 'not-allowed' }}
                              readOnly
                              title="Email cannot be changed after invite is created"
                            />
                          </td>
                          <td>
                            <span className={`rsvp-badge ${invite.used ? 'going' : 'pending'}`}>
                              {invite.used ? 'Registered"' : 'Pending'}
                            </span>
                          </td>
                          {(isSuperAdmin || permissions?.invites_link) && <td>-</td>}
                          <td>-</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => {
                                  handleUpdateInvite(invite.id, {
                                    first_name: document.getElementById(`edit-invite-firstname-${invite.id}`).value,
                                    last_name: document.getElementById(`edit-invite-lastname-${invite.id}`).value,
                                    email: document.getElementById(`edit-invite-email-${invite.id}`).value,
                                  });
                                }}
                                className="btn-link"
                              >
                                Save
                              </button>
                              <button onClick={() => setEditingInvite(null)} className="btn-link">
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ whiteSpace: 'nowrap' }}>{invite.first_name} {invite.last_name}</td>
                          <td>{invite.email}</td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                              <span className={`rsvp-badge ${invite.used ? 'going' : 'pending'}`} style={{ minWidth: '120px', textAlign: 'center' }}>
                                {invite.used ? 'Registered' : 'Pending'}
                              </span>
                              {invite.email_sent && <span>✉️</span>}
                            </span>
                          </td>
                          {(isSuperAdmin || permissions?.invites_link) && (
                            <td style={{ minWidth: '200px' }}>
                              {invite.master_list_id ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span className="linked-name">
                                    {invite.ml_last_name}, {invite.ml_first_name}
                                  </span>
                                  <button
                                    onClick={() => handleUnlinkFromMasterList(invite.id)}
                                    className="btn-link"
                                    style={{ fontSize: '0.75rem', color: '#666' }}
                                    title="Unlink"
                                  >
                                    undo
                                  </button>
                                </span>
                              ) : (
                                <select
                                  onChange={(e) => handleLinkToMasterList(invite.id, e.target.value)}
                                  defaultValue=""
                                  style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                                >
                                  <option value="">-- Select --</option>
                                  {masterList
                                    .filter(m => !m.email && !m.in_memoriam)
                                    .sort((a, b) => a.last_name.localeCompare(b.last_name))
                                    .map(m => (
                                      <option key={m.id} value={m.id}>
                                        {m.last_name}, {m.first_name}
                                      </option>
                                    ))
                                  }
                                </select>
                              )}
                            </td>
                          )}
                          <td>
                            {!invite.used && (
                              <button
                                className={`btn-link ${copiedId === invite.invite_token ? 'btn-copied-link' : ''}`}
                                onClick={() => copyLink(invite.invite_token)}
                                disabled={copiedId === invite.invite_token}
                              >
                                {copiedId === invite.invite_token ? 'Copied ✓' : 'Copy link'}
                              </button>
                            )}
                          </td>
                          {(isSuperAdmin || permissions?.invites_add) && (
                            <td>
                              {!invite.used && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => setEditingInvite(invite.id)} className="btn-link">
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    className="btn-link btn-delete"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-controls" style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '16px',
                marginTop: '20px',
                padding: '16px',
                borderTop: '1px solid rgba(255,255,255,0.1)'
              }}>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  ← Prev
                </button>
                <span style={{ color: '#888' }}>
                  Page {page} of {totalPages} ({totalCount} total)
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="btn-secondary"
                  style={{ padding: '8px 16px' }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="no-data">{inviteSearch || statusFilter !== 'all' ? 'No matching invites' : 'No invites yet'}</p>
        )}
      </div>
    </>
  );
}
