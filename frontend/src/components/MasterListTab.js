import { useState, useEffect, useRef, useCallback } from 'react';
import ScrollableTable from './ScrollableTable';
import { AMOUNT_DUE } from '../config';
import { apiGet, apiPut } from '../api';

const MASTER_LIST_PAGE_SIZE = 45;

export default function MasterListTab({
  isSuperAdmin,
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
  const [masterListSearch, setMasterListSearch] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
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
        search = masterListSearch
      } = options;

      const params = new URLSearchParams();
      if (section && section !== 'all') params.append('section', section);
      params.append('page', page);
      params.append('limit', MASTER_LIST_PAGE_SIZE);
      if (status && status !== 'all') params.append('status', status);
      if (paymentStatus && paymentStatus !== 'all') params.append('paymentStatus', paymentStatus);
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
  }, [masterListFilter, masterListPage, masterListStatusFilter, masterListPaymentFilter, masterListSearch]);

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
    setMasterListSearch('');
    setMasterListPage(1);
    fetchMasterList({ section: 'all', status: 'all', paymentStatus: 'all', search: '', page: 1 });
  };

  const exportMasterListCSV = () => {
    if (!masterList?.length) return;

    const headers = ['Section', 'Last Name', 'First Name', 'Current Name', 'Email', 'Status'];
    const rows = masterList.map(m => [
      m.section,
      m.last_name,
      m.first_name,
      m.current_name || '',
      m.email || '',
      m.status
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usls-batch-2003-master-list.csv';
    a.click();
  };

  const hasActiveFilters = masterListFilter !== 'all' || masterListStatusFilter !== 'all' || masterListPaymentFilter !== 'all' || masterListSearch;

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
            <div className="status-card-header">Payment Status (Graduates)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <span><strong style={{ color: 'var(--color-status-positive)' }}>{parseInt(masterListStats.full_paid) || 0}</strong> Full ({parseInt(masterListStats.total_graduates) ? Math.round((parseInt(masterListStats.full_paid) / parseInt(masterListStats.total_graduates)) * 100) : 0}%)</span>
              <span><strong style={{ color: 'var(--color-status-warning)' }}>{parseInt(masterListStats.partial_paid) || 0}</strong> Partial ({parseInt(masterListStats.total_graduates) ? Math.round((parseInt(masterListStats.partial_paid) / parseInt(masterListStats.total_graduates)) * 100) : 0}%)</span>
              <span><strong style={{ color: 'var(--color-status-negative)' }}>{parseInt(masterListStats.unpaid) || 0}</strong> Unpaid ({parseInt(masterListStats.total_graduates) ? Math.round((parseInt(masterListStats.unpaid) / parseInt(masterListStats.total_graduates)) * 100) : 0}%)</span>
              <span>/ {parseInt(masterListStats.total_graduates) || 0} total</span>
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
          value={masterListPaymentFilter}
          onChange={handleMasterListPaymentFilterChange}
          style={{ width: '150px' }}
        >
          <option value="all">All Payment</option>
          <option value="full">Full (Paid)</option>
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
                  <th>Email</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th style={{ fontSize: '0.85rem' }}>Balance<br /><span style={{ fontWeight: 'normal', color: '#888', fontSize: '0.75rem' }}>(P25k target)</span></th>
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
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#fff' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            defaultValue={entry.first_name}
                            id={`edit-firstname-${entry.id}`}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#fff' }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            defaultValue={entry.current_name || ''}
                            id={`edit-current-name-${entry.id}`}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', color: '#fff' }}
                          />
                        </td>
                        <td>
                          <input
                            type="email"
                            defaultValue={entry.email || ''}
                            id={`edit-email-${entry.id}`}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 12px', color: '#666', cursor: 'not-allowed' }}
                            readOnly
                            title="Email is set via Invites tab"
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
                                    email: document.getElementById(`edit-email-${entry.id}`).value,
                                    is_unreachable: document.getElementById(`edit-unreachable-${entry.id}`).checked,
                                  };

                                  if (isSuperAdmin) {
                                    updates.in_memoriam = document.getElementById(`edit-memoriam-${entry.id}`)?.checked;
                                    updates.is_admin = document.getElementById(`edit-admin-${entry.id}`)?.checked;
                                  }

                                  handleUpdateEntry(entry.id, updates);
                                }}
                                className="btn-link"
                              >
                                Save
                              </button>
                              <button onClick={() => setEditingEntry(null)} className="btn-link">
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
                        <td>{entry.email || '-'}</td>
                        <td>
                          <span style={{ whiteSpace: 'nowrap' }} className={`rsvp-badge ${entry.status === 'Registered' ? 'going' : entry.status === 'Pending' ? 'maybe' : entry.status === 'In Memoriam' ? 'memoriam' : entry.status === 'Unreachable' ? 'pending' : 'pending'}`}>
                            {entry.status === 'In Memoriam' ? 'IN MEMORIAM' : entry.status === 'Unreachable' ? 'UNREACHABLE' : entry.status}
                          </span>
                        </td>
                        <td>
                          {entry.in_memoriam || entry.section === 'Non-Graduate' ? (
                            <span style={{ color: '#666' }}>-</span>
                          ) : (
                            <span className={`payment-badge ${entry.payment_status === 'Full' ? 'full' : entry.payment_status === 'Partial' ? 'partial' : 'unpaid'}`}>
                              {entry.payment_status || 'Unpaid'}
                            </span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                          {entry.in_memoriam || entry.section === 'Non-Graduate' ? (
                            <span style={{ color: '#666' }}>-</span>
                          ) : entry.payment_status === 'Full' ? (
                            <span style={{ color: 'var(--color-status-positive)', fontWeight: '600' }}>Paid</span>
                          ) : (
                            <span style={{ color: 'var(--text-primary)' }}>P{parseFloat(entry.balance || AMOUNT_DUE).toLocaleString()}</span>
                          )}
                        </td>
                        {(isSuperAdmin || permissions?.masterlist_edit) && (
                          <td>
                            <button onClick={() => setEditingEntry(entry.id)} className="btn-link">
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
