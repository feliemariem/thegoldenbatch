import { useState, useEffect, useRef, useCallback } from 'react';
import ScrollableTable from './ScrollableTable';
import { apiGet, apiPut } from '../api';

const MASTER_LIST_PAGE_SIZE = 45;

export default function MasterListTab({
  isSuperAdmin,
  isSystemAdmin,
  permissions,
  onShowAdminRoleError,
  onRefreshReady,
}) {
  const [masterList, setMasterList] = useState([]);
  const [masterListStats, setMasterListStats] = useState(null);
  const [masterListSections, setMasterListSections] = useState([]);
  const [masterListFilter, setMasterListFilter] = useState('all');
  const [masterListStatusFilter, setMasterListStatusFilter] = useState('all');
  const [masterListPaymentFilter, setMasterListPaymentFilter] = useState('all');
  const [masterListTierFilter, setMasterListTierFilter] = useState('all');
  const [masterListSearch, setMasterListSearch] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [editingTier, setEditingTier] = useState('');
  const [masterListPage, setMasterListPage] = useState(1);
  const [masterListTotalPages, setMasterListTotalPages] = useState(1);
  const [masterListTotalCount, setMasterListTotalCount] = useState(0);

  const masterListTableRef = useRef(null);

  const scrollToTop = () => {
    if (masterListTableRef.current) {
      masterListTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const fetchMasterList = useCallback(async (options = {}) => {
    try {
      const {
        section = masterListFilter,
        page = masterListPage,
        status = masterListStatusFilter,
        paymentStatus = masterListPaymentFilter,
        tier = masterListTierFilter,
        search = masterListSearch
      } = options;

      const params = new URLSearchParams();
      if (section && section !== 'all') params.append('section', section);
      params.append('page', page);
      params.append('limit', MASTER_LIST_PAGE_SIZE);
      if (status && status !== 'all') params.append('status', status);
      if (paymentStatus && paymentStatus !== 'all') params.append('paymentStatus', paymentStatus);
      if (tier && tier !== 'all') params.append('tier', tier);
      if (search && search.trim()) params.append('search', search.trim());

      const res = await apiGet(`/api/master-list?${params.toString()}`);
      const data = await res.json();
      setMasterList(data.entries || []);
      setMasterListStats(data.stats);
      setMasterListSections(data.sections || []);
      if (data.pagination) {
        setMasterListPage(data.pagination.currentPage);
        setMasterListTotalPages(data.pagination.totalPages);
        setMasterListTotalCount(data.pagination.totalCount);
      }
    } catch (err) {
      console.error('Failed to fetch master list');
    }
  }, [masterListFilter, masterListPage, masterListStatusFilter, masterListPaymentFilter, masterListTierFilter, masterListSearch]);

  // Initial fetch
  useEffect(() => {
    fetchMasterList();
  }, []);

  // Expose refresh function to parent
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(() => fetchMasterList());
    }
  }, [onRefreshReady, fetchMasterList]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMasterListPage(1);
      fetchMasterList({ search: masterListSearch, page: 1 });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [masterListSearch]);

  const handleMasterListFilterChange = (e) => {
    const section = e.target.value;
    setMasterListFilter(section);
    setMasterListPage(1);
    fetchMasterList({ section, page: 1 });
  };

  const handleMasterListStatusFilterChange = (e) => {
    const status = e.target.value;
    setMasterListStatusFilter(status);
    setMasterListPage(1);
    fetchMasterList({ status, page: 1 });
  };

  const handleMasterListPaymentFilterChange = (e) => {
    const paymentStatus = e.target.value;
    setMasterListPaymentFilter(paymentStatus);
    setMasterListPage(1);
    fetchMasterList({ paymentStatus, page: 1 });
  };

  const handleMasterListTierFilterChange = (e) => {
    const tier = e.target.value;
    setMasterListTierFilter(tier);
    setMasterListPage(1);
    fetchMasterList({ tier, page: 1 });
  };

  const handleMasterListSearchChange = (e) => {
    setMasterListSearch(e.target.value);
  };

  const handleMasterListPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= masterListTotalPages) {
      setMasterListPage(newPage);
      fetchMasterList({ page: newPage });
    }
  };

  const handleUpdateEntry = async (id, updates) => {
    try {
      const res = await apiPut(`/api/master-list/${id}`, updates);

      if (res.ok) {
        fetchMasterList({ page: masterListPage });
        setEditingEntry(null);
        setEditingTier('');
      } else {
        const data = await res.json();
        if (data.error === 'Cannot assign admin role: user has not completed registration') {
          onShowAdminRoleError?.();
        } else {
          alert(data.error || 'Failed to update entry');
        }
      }
    } catch (err) {
      console.error('Failed to update entry');
      alert('Failed to update entry');
    }
  };

  const handleClearFilters = () => {
    setMasterListFilter('all');
    setMasterListStatusFilter('all');
    setMasterListPaymentFilter('all');
    setMasterListTierFilter('all');
    setMasterListSearch('');
    setMasterListPage(1);
    fetchMasterList({ section: 'all', status: 'all', paymentStatus: 'all', tier: 'all', search: '', page: 1 });
  };

  const formatTierName = (tier) => {
    if (!tier) return '';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const getTierRange = (tier) => {
    const ranges = {
      cornerstone: { min: 25000, max: null, label: 'Min: ₱25,000' },
      pillar: { min: 18000, max: 24000, label: '₱18,000 – ₱24,000' },
      anchor: { min: 10000, max: 17000, label: '₱10,000 – ₱17,000' },
      root: { min: null, max: null, label: 'Open amount' }
    };
    return ranges[tier] || null;
  };

  const getTierDefault = (tier) => {
    const defaults = { cornerstone: 25000, pillar: 18000, anchor: 10000 };
    return defaults[tier] || null;
  };

  const handleStartEditing = (entry) => {
    setEditingEntry(entry.id);
    setEditingTier(entry.builder_tier || '');
  };

  const handleTierChange = (e, entryId) => {
    const newTier = e.target.value;
    setEditingTier(newTier);

    // Auto-fill default pledge amount when tier changes
    const pledgeInput = document.getElementById(`edit-pledge-${entryId}`);
    if (pledgeInput) {
      if (newTier === 'root' || !newTier) {
        pledgeInput.value = '';
      } else {
        const defaultAmount = getTierDefault(newTier);
        if (defaultAmount && !pledgeInput.value) {
          pledgeInput.value = defaultAmount;
        }
      }
    }
  };

  const exportMasterListCSV = () => {
    if (!masterList?.length) return;

    const headers = ['Section', 'Last Name', 'First Name', 'Current Name', 'Email', 'Status', 'Tier', 'Pledge', 'Paid', 'Balance'];
    const rows = masterList.map(m => [
      m.section,
      m.last_name,
      m.first_name,
      m.current_name || '',
      m.email || '',
      m.status,
      formatTierName(m.builder_tier) || '',
      m.builder_tier && m.builder_tier !== 'root' ? m.pledge_amount : '',
      m.total_paid || 0,
      m.balance != null ? m.balance : ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usls-batch-2003-master-list.csv';
    a.click();
  };

  const hasActiveFilters = masterListFilter !== 'all' || masterListStatusFilter !== 'all' || masterListPaymentFilter !== 'all' || masterListTierFilter !== 'all' || masterListSearch;

  return (
    <div className="users-section" ref={masterListTableRef}>
      {/* Stats */}
      {masterListStats && (
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          fontSize: '0.85rem',
          color: '#666'
        }}>
          <div className="status-card">
            <div className="status-card-header">Master List Status</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <span><strong className="status-card-value">{masterListStats.registered || 0}</strong> Registered</span>
              <span><strong className="status-card-value">{masterListStats.pending || 0}</strong> Pending</span>
              <span><strong className="status-card-value">{masterListStats.not_invited || 0}</strong> Not Invited</span>
              <span><strong className="status-card-value">{masterListStats.in_memoriam || 0}</strong> In Memoriam</span>
              <span><strong className="status-card-value">{masterListStats.unreachable || 0}</strong> Unreachable</span>
            </div>
          </div>
          <div className="status-card">
            <div className="status-card-header">Builder Tiers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <span><strong style={{ color: '#CFB53B' }}>{parseInt(masterListStats.tiers?.cornerstone) || 0}</strong> Cornerstone</span>
              <span><strong style={{ color: '#C0C0C0' }}>{parseInt(masterListStats.tiers?.pillar) || 0}</strong> Pillar</span>
              <span><strong style={{ color: '#CD7F32' }}>{parseInt(masterListStats.tiers?.anchor) || 0}</strong> Anchor</span>
              <span><strong style={{ color: 'var(--color-status-positive)' }}>{parseInt(masterListStats.tiers?.root) || 0}</strong> Root</span>
              <span><strong style={{ color: '#888' }}>{parseInt(masterListStats.tiers?.no_tier) || 0}</strong> No Tier</span>
            </div>
          </div>
          <div className="status-card">
            <div className="status-card-header">Payment Status (Builders)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <span><strong style={{ color: 'var(--color-status-positive)' }}>{parseInt(masterListStats.full_paid) || 0}</strong> Full</span>
              <span><strong style={{ color: 'var(--color-status-warning)' }}>{parseInt(masterListStats.partial_paid) || 0}</strong> Partial</span>
              <span><strong style={{ color: 'var(--color-status-negative)' }}>{parseInt(masterListStats.unpaid) || 0}</strong> Unpaid</span>
              <span><strong style={{ color: 'var(--color-status-positive)' }}>{parseInt(masterListStats.root_count) || 0}</strong> Root</span>
              <span style={{ color: '#888' }}>/ {parseInt(masterListStats.total_builders) || 0} builders</span>
            </div>
          </div>
          <div className="status-card">
            <div className="status-card-header">Funds</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <span><strong className="status-card-value">₱{parseInt(masterListStats.tiers?.total_pledged || 0).toLocaleString()}</strong> Pledged</span>
              <span><strong style={{ color: 'var(--color-status-positive)' }}>₱{parseInt(masterListStats.tiers?.total_collected || 0).toLocaleString()}</strong> Collected</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="section-header">
        <h3>Batch Directory ({masterListTotalCount})</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {masterList.length > 10 && (
            <button onClick={scrollToTop} className="btn-secondary" title="Scroll to top">
              ^ Top
            </button>
          )}
          {(isSuperAdmin || permissions?.masterlist_export) && (
            <button onClick={exportMasterListCSV} className="btn-secondary">
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="filter-row">
        <select value={masterListFilter} onChange={handleMasterListFilterChange}>
          <option value="all">All</option>
          <option value="graduates">Graduates</option>
          {masterListSections.map(section => (
            <option key={section} value={section}>{section === 'Non-Graduate' ? 'Non-Graduates' : section}</option>
          ))}
        </select>
        <select
          value={masterListStatusFilter}
          onChange={handleMasterListStatusFilterChange}
          style={{ width: '150px' }}
        >
          <option value="all">All Status</option>
          <option value="not invited">Not Invited</option>
          <option value="pending">Pending</option>
          <option value="registered">Registered</option>
          <option value="in memoriam">In Memoriam</option>
          <option value="unreachable">Unreachable</option>
        </select>
        <select
          value={masterListTierFilter}
          onChange={handleMasterListTierFilterChange}
          style={{ width: '150px' }}
        >
          <option value="all">All Tiers</option>
          <option value="cornerstone">Cornerstone</option>
          <option value="pillar">Pillar</option>
          <option value="anchor">Anchor</option>
          <option value="root">Root</option>
          <option value="none">No Tier</option>
        </select>
        <select
          value={masterListPaymentFilter}
          onChange={handleMasterListPaymentFilterChange}
          style={{ width: '150px' }}
        >
          <option value="all">All Payment</option>
          <option value="full">Full</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <input
          type="text"
          placeholder="Search by name..."
          value={masterListSearch}
          onChange={handleMasterListSearchChange}
          className="search-input"
        />
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            style={{
              background: 'rgba(220, 53, 69, 0.1)',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#dc3545',
              cursor: 'pointer',
              fontSize: '0.85rem',
              whiteSpace: 'nowrap'
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {masterList.length > 0 ? (
        <>
          <ScrollableTable stickyHeader={true}>
            <table>
              <thead>
                <tr>
                  <th>Last Name</th>
                  <th>First Name</th>
                  <th>Current Name</th>
                  <th>Status</th>
                  <th>Tier</th>
                  <th>Pledge</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  {(isSuperAdmin || permissions?.masterlist_edit) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {masterList.map((entry) => (
                  <tr key={entry.id}>
                    {editingEntry === entry.id ? (
                      <>
                        <td>
                          <input
                            type="text"
                            defaultValue={entry.last_name}
                            id={`edit-lastname-${entry.id}`}
                            style={{ width: '100%', background: isSystemAdmin ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: isSystemAdmin ? '#fff' : '#666', cursor: isSystemAdmin ? 'text' : 'not-allowed' }}
                            readOnly={!isSystemAdmin}
                            title={!isSystemAdmin ? 'Only System Admin can edit names' : undefined}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            defaultValue={entry.first_name}
                            id={`edit-firstname-${entry.id}`}
                            style={{ width: '100%', background: isSystemAdmin ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: isSystemAdmin ? '#fff' : '#666', cursor: isSystemAdmin ? 'text' : 'not-allowed' }}
                            readOnly={!isSystemAdmin}
                            title={!isSystemAdmin ? 'Only System Admin can edit names' : undefined}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            defaultValue={entry.current_name || ''}
                            id={`edit-current-name-${entry.id}`}
                            style={{ width: '100%', background: isSystemAdmin ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: isSystemAdmin ? '#fff' : '#666', cursor: isSystemAdmin ? 'text' : 'not-allowed' }}
                            readOnly={!isSystemAdmin}
                            title={!isSystemAdmin ? 'Only System Admin can edit names' : undefined}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                            {isSuperAdmin && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="checkbox"
                                  defaultChecked={entry.in_memoriam}
                                  id={`edit-memoriam-${entry.id}`}
                                />
                                In Memoriam
                              </label>
                            )}

                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="checkbox"
                                defaultChecked={entry.is_unreachable}
                                id={`edit-unreachable-${entry.id}`}
                              />
                              Unreachable
                            </label>

                            {isSuperAdmin && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="checkbox"
                                  defaultChecked={entry.is_admin}
                                  id={`edit-admin-${entry.id}`}
                                />
                                Admin
                              </label>
                            )}
                          </div>
                        </td>
                        <td>
                          {isSuperAdmin ? (
                            <select
                              value={editingTier}
                              onChange={(e) => handleTierChange(e, entry.id)}
                              id={`edit-tier-${entry.id}`}
                              className="edit-tier-select"
                            >
                              <option value="">None</option>
                              <option value="cornerstone">Cornerstone</option>
                              <option value="pillar">Pillar</option>
                              <option value="anchor">Anchor</option>
                              <option value="root">Root</option>
                            </select>
                          ) : (
                            <span style={{ color: '#666' }}>{formatTierName(entry.builder_tier) || '-'}</span>
                          )}
                        </td>
                        <td>
                          {isSuperAdmin ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <input
                                type="number"
                                defaultValue={entry.pledge_amount || ''}
                                id={`edit-pledge-${entry.id}`}
                                placeholder={!editingTier ? '-' : 'Optional'}
                                disabled={!editingTier}
                                className={`edit-pledge-input ${!editingTier ? 'disabled' : ''}`}
                              />
                              {getTierRange(editingTier) && (
                                <span style={{ fontSize: '0.7rem', color: '#888' }}>
                                  {getTierRange(editingTier).label}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#666' }}>{entry.pledge_amount ? `₱${parseFloat(entry.pledge_amount).toLocaleString()}` : '-'}</span>
                          )}
                        </td>
                        <td style={{ color: '#666', textAlign: 'center' }}>-</td>
                        <td style={{ color: '#666', textAlign: 'center' }}>-</td>
                        {(isSuperAdmin || permissions?.masterlist_edit) && (
                          <td>
                            <div style={{ display: 'flex', gap: '8px', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => {
                                  const updates = {
                                    last_name: document.getElementById(`edit-lastname-${entry.id}`).value,
                                    first_name: document.getElementById(`edit-firstname-${entry.id}`).value,
                                    current_name: document.getElementById(`edit-current-name-${entry.id}`).value,
                                    is_unreachable: document.getElementById(`edit-unreachable-${entry.id}`).checked,
                                  };

                                  if (isSuperAdmin) {
                                    updates.in_memoriam = document.getElementById(`edit-memoriam-${entry.id}`)?.checked;
                                    updates.is_admin = document.getElementById(`edit-admin-${entry.id}`)?.checked;
                                    updates.builder_tier = editingTier === '' ? null : editingTier;

                                    const pledgeValue = document.getElementById(`edit-pledge-${entry.id}`)?.value;
                                    const pledgeNum = pledgeValue ? parseFloat(pledgeValue) : null;

                                    // Validate pledge range if amount is entered (skip for root tier)
                                    const range = getTierRange(editingTier);
                                    if (pledgeNum && range && editingTier !== 'root') {
                                      if (range.min && pledgeNum < range.min) {
                                        alert(`${formatTierName(editingTier)} requires minimum ₱${range.min.toLocaleString()}. Leave blank to let the member set their own amount.`);
                                        return;
                                      }
                                      if (range.max && pledgeNum > range.max) {
                                        alert(`${formatTierName(editingTier)} maximum is ₱${range.max.toLocaleString()}.`);
                                        return;
                                      }
                                    }

                                    updates.pledge_amount = pledgeNum;
                                  }

                                  handleUpdateEntry(entry.id, updates);
                                }}
                                className="btn-link"
                              >
                                Save
                              </button>
                              <button onClick={() => { setEditingEntry(null); setEditingTier(''); }} className="btn-link">
                                Cancel
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    ) : (
                      <>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {entry.last_name}
                          {entry.is_admin && <span style={{ marginLeft: '6px', fontSize: '0.55rem', color: '#666', fontWeight: '600', letterSpacing: '0.05em', verticalAlign: 'super' }}>ADMIN</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {entry.first_name}
                        </td>
                        <td>{entry.current_name || '-'}</td>
                        <td>
                          <span style={{ whiteSpace: 'nowrap' }} className={`rsvp-badge ${entry.status === 'Registered' ? 'going' : entry.status === 'Pending' ? 'maybe' : entry.status === 'In Memoriam' ? 'memoriam' : entry.status === 'Unreachable' ? 'pending' : 'pending'}`}>
                            {entry.status === 'In Memoriam' ? 'IN MEMORIAM' : entry.status === 'Unreachable' ? 'UNREACHABLE' : entry.status}
                          </span>
                        </td>
                        <td>
                          {entry.in_memoriam || entry.section === 'Non-Graduate' ? (
                            <span style={{ color: '#666' }}>-</span>
                          ) : entry.builder_tier ? (
                            <span className={`tier-badge ${entry.builder_tier}`}>
                              {formatTierName(entry.builder_tier)}
                            </span>
                          ) : (
                            <span style={{ color: '#666' }}>-</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {entry.in_memoriam || entry.section === 'Non-Graduate' || !entry.builder_tier || entry.builder_tier === 'root' ? (
                            <span style={{ color: '#666' }}>-</span>
                          ) : (
                            <span>₱{parseFloat(entry.pledge_amount || 0).toLocaleString()}</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {entry.in_memoriam || entry.section === 'Non-Graduate' || !entry.builder_tier ? (
                            <span style={{ color: '#666' }}>-</span>
                          ) : (
                            <span style={{ color: 'var(--color-status-positive)' }}>₱{parseFloat(entry.total_paid || 0).toLocaleString()}</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                          {entry.in_memoriam || entry.section === 'Non-Graduate' || !entry.builder_tier ? (
                            <span style={{ color: '#666' }}>-</span>
                          ) : entry.builder_tier === 'root' ? (
                            <span style={{ color: 'var(--color-status-positive)', fontWeight: '600' }}>Root</span>
                          ) : entry.payment_status === 'Full' ? (
                            <span style={{ color: 'var(--color-status-positive)', fontWeight: '600' }}>Paid</span>
                          ) : (
                            <span style={{ color: 'var(--text-primary)' }}>₱{parseFloat(entry.balance || 0).toLocaleString()}</span>
                          )}
                        </td>
                        {(isSuperAdmin || permissions?.masterlist_edit) && (
                          <td>
                            <button onClick={() => handleStartEditing(entry)} className="btn-link">
                              Edit
                            </button>
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
          {masterListTotalPages > 1 && (
            <div className="pagination-controls" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '20px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => handleMasterListPageChange(masterListPage - 1)}
                disabled={masterListPage === 1}
                className="btn-secondary"
                style={{
                  padding: '8px 12px',
                  opacity: masterListPage === 1 ? 0.5 : 1,
                  cursor: masterListPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>

              {/* Page numbers */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {(() => {
                  const pages = [];
                  const maxVisiblePages = 5;
                  let startPage = Math.max(1, masterListPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(masterListTotalPages, startPage + maxVisiblePages - 1);

                  // Adjust start if we're near the end
                  if (endPage - startPage < maxVisiblePages - 1) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }

                  // First page
                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => handleMasterListPageChange(1)}
                        className="btn-secondary"
                        style={{
                          padding: '8px 12px',
                          minWidth: '40px',
                          background: 'transparent'
                        }}
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(<span key="start-ellipsis" style={{ color: '#666', padding: '0 4px' }}>...</span>);
                    }
                  }

                  // Page numbers
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => handleMasterListPageChange(i)}
                        className="btn-secondary"
                        style={{
                          padding: '8px 12px',
                          minWidth: '40px',
                          background: i === masterListPage ? '#CFB53B' : 'transparent',
                          color: i === masterListPage ? '#1a1a2e' : 'inherit',
                          fontWeight: i === masterListPage ? '600' : 'normal'
                        }}
                      >
                        {i}
                      </button>
                    );
                  }

                  // Last page
                  if (endPage < masterListTotalPages) {
                    if (endPage < masterListTotalPages - 1) {
                      pages.push(<span key="end-ellipsis" style={{ color: '#666', padding: '0 4px' }}>...</span>);
                    }
                    pages.push(
                      <button
                        key={masterListTotalPages}
                        onClick={() => handleMasterListPageChange(masterListTotalPages)}
                        className="btn-secondary"
                        style={{
                          padding: '8px 12px',
                          minWidth: '40px',
                          background: 'transparent'
                        }}
                      >
                        {masterListTotalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}
              </div>

              <button
                onClick={() => handleMasterListPageChange(masterListPage + 1)}
                disabled={masterListPage === masterListTotalPages}
                className="btn-secondary"
                style={{
                  padding: '8px 12px',
                  opacity: masterListPage === masterListTotalPages ? 0.5 : 1,
                  cursor: masterListPage === masterListTotalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>

              <span style={{ marginLeft: '12px', color: '#888', fontSize: '0.85rem' }}>
                Page {masterListPage} of {masterListTotalPages}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="no-data">{masterListSearch ? 'No matching entries' : 'No master list entries.'}</p>
      )}
    </div>
  );
}
