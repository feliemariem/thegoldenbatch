import { useState, useRef, useEffect, useCallback } from 'react';
import ScrollableTable from './ScrollableTable';
import { apiGet } from '../api';

export default function RegisteredTab({
  isSuperAdmin,
  permissions,
  onStatsUpdate,
}) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, going: 0, maybe: 0, not_going: 0, no_response: 0 });
  const [registeredSearch, setRegisteredSearch] = useState('');
  const [registeredRsvpFilter, setRegisteredRsvpFilter] = useState('all');

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const registeredTableRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch users with pagination
  const fetchUsers = useCallback(async (pageNum = 1, search = '', rsvp = 'all') => {
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '45',
      });
      if (search.trim()) params.append('search', search.trim());
      if (rsvp !== 'all') params.append('rsvp', rsvp);

      const res = await apiGet(`/api/admin/users?${params}`);
      const data = await res.json();

      setUsers(data.users || []);
      setStats(data.stats || { total: 0, going: 0, maybe: 0, not_going: 0, no_response: 0 });
      setPage(data.pagination?.currentPage || 1);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);

      // Notify parent of stats update
      if (onStatsUpdate && data.stats) {
        onStatsUpdate(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch users');
    }
  }, [onStatsUpdate]);

  // Initial fetch
  useEffect(() => {
    fetchUsers(1, registeredSearch, registeredRsvpFilter);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchUsers(1, registeredSearch, registeredRsvpFilter);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [registeredSearch, registeredRsvpFilter]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchUsers(newPage, registeredSearch, registeredRsvpFilter);
      scrollToTop();
    }
  };

  const scrollToTop = () => {
    if (registeredTableRef.current) {
      registeredTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Helper function to format birthday without timezone conversion
  const formatBirthday = (dateStr) => {
    if (!dateStr) return '';
    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  };

  const exportToCSV = async () => {
    try {
      // Fetch all users for export (no pagination)
      const res = await apiGet('/api/admin/users?limit=10000');
      const data = await res.json();
      const allUsers = data.users || [];

      if (!allUsers.length) return;

      const headers = ['First Name', 'Last Name', 'Email', 'Birthday', 'Mobile', 'Address', 'City', 'Country', 'Occupation', 'Company', 'RSVP', 'Registered At'];
      const rows = allUsers.map(u => [
        u.first_name,
        u.last_name,
        u.email,
        formatBirthday(u.birthday),
        u.mobile || '',
        u.address || '',
        u.city,
        u.country,
        u.occupation || '',
        u.company || '',
        u.rsvp_status || 'pending',
        u.registered_at ? new Date(u.registered_at).toLocaleDateString() : ''
      ]);

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'usls-batch-2003-alumni.csv';
      a.click();
    } catch (err) {
      console.error('Failed to export users');
    }
  };

  return (
    <div className="users-section" ref={registeredTableRef}>
      <div className="section-header">
        <h3>Registered Alumni ({stats.total})</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {users.length > 10 && (
            <button onClick={scrollToTop} className="btn-secondary" title="Scroll to top">
              ^ Top
            </button>
          )}
          {(isSuperAdmin || permissions?.registered_export) && (
            <button onClick={exportToCSV} className="btn-secondary">
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="filter-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={registeredRsvpFilter}
          onChange={(e) => setRegisteredRsvpFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minWidth: '150px' }}
        >
          <option value="all">All RSVP ({stats.total})</option>
          <option value="going">Going ({stats.going})</option>
          <option value="maybe">Maybe ({stats.maybe})</option>
          <option value="not_going">Not Going ({stats.not_going})</option>
          <option value="no_response">No Response ({stats.no_response})</option>
        </select>
        <input
          type="text"
          placeholder="Search by name, email, city, country..."
          value={registeredSearch}
          onChange={(e) => setRegisteredSearch(e.target.value)}
          className="search-input"
          style={{ flex: 1, minWidth: '200px' }}
        />
        {(registeredSearch || registeredRsvpFilter !== 'all') && (
          <span className="search-count">
            {totalCount} result{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {users.length > 0 ? (
        <>
          <ScrollableTable stickyHeader={true}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Birthday</th>
                  <th>Mobile</th>
                  <th>Address</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Occupation</th>
                  <th>Company</th>
                  <th>RSVP</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{user.first_name} {user.last_name}</td>
                    <td>{user.email}</td>
                    <td>{formatBirthday(user.birthday) || '-'}</td>
                    <td>{user.mobile || '-'}</td>
                    <td>{user.address || '-'}</td>
                    <td>{user.city}</td>
                    <td>{user.country}</td>
                    <td>{user.occupation || '-'}</td>
                    <td>{user.company || '-'}</td>
                    <td>
                      <span className={`rsvp-badge ${user.rsvp_status || 'pending'}`}>
                        {user.rsvp_status
                          ? user.rsvp_status.replace('_', ' ')
                          : 'pending'}
                      </span>
                    </td>
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
        <p className="no-data">{registeredSearch || registeredRsvpFilter !== 'all' ? 'No matching alumni' : 'No registrations yet'}</p>
      )}
    </div>
  );
}
