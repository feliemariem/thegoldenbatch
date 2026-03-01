import { useState, useRef, useEffect, useCallback } from 'react';
import ScrollableTable from './ScrollableTable';
import { apiGet } from '../api';

// Grad attendance goal constants
const TOTAL_GRADS = 198;
const GRAD_TARGET_PERCENT = 65;
const GRAD_TARGET_COUNT = Math.ceil(TOTAL_GRADS * GRAD_TARGET_PERCENT / 100); // 129
const FUNDING_TARGET = 2100000;
const TARGET_AVG = Math.ceil(FUNDING_TARGET / GRAD_TARGET_COUNT / 100) * 100; // ~16,300

export default function RegisteredTab({
  isSuperAdmin,
  permissions,
  onStatsUpdate,
}) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, going: 0, maybe: 0, not_going: 0, no_response: 0, grads_going: 0 });
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
      setStats(data.stats || { total: 0, going: 0, maybe: 0, not_going: 0, no_response: 0, grads_going: 0 });
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

      const headers = ['First Name', 'Last Name', 'Email', 'Birthday', 'Mobile', 'Address', 'City', 'Country', 'Occupation', 'Company', 'RSVP', 'Alumni Card', 'Shirt Size', 'Jacket Size', 'Registered At'];
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
        u.section === 'Non-Graduate' ? 'N/A' : (u.has_alumni_card ? 'Yes' : 'No'),
        u.shirt_size || '',
        u.jacket_size || '',
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

  // Computed values for grad progress tracker
  const gradsGoing = stats.grads_going || 0;
  const currentPercent = (gradsGoing / TOTAL_GRADS * 100).toFixed(1);
  const progressWidth = Math.min((gradsGoing / GRAD_TARGET_COUNT) * 100, 100);
  const avgPerGrad = gradsGoing > 0 ? Math.ceil(FUNDING_TARGET / gradsGoing / 100) * 100 : 0;

  return (
    <div className="users-section" ref={registeredTableRef}>
      {/* Grad RSVP Progress Tracker */}
      <div className="grad-progress-tracker">
        <div className="grad-progress-label">GRAD ATTENDANCE GOAL</div>

        <div className="grad-progress-bar-labels">
          <span>{currentPercent}%</span>
          <span>Target: {GRAD_TARGET_PERCENT}%</span>
        </div>

        <div className="grad-progress-track">
          <div
            className="grad-progress-fill"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        <div className="grad-progress-context">
          {gradsGoing > 0 ? (
            gradsGoing >= GRAD_TARGET_COUNT ? (
              <>🎉 Target reached! {gradsGoing} grads going · avg ~₱{avgPerGrad.toLocaleString()} per grad</>
            ) : (
              <>{gradsGoing} of {GRAD_TARGET_COUNT} target grads going · avg ~₱{avgPerGrad.toLocaleString()} per grad to reach ₱{(FUNDING_TARGET / 1000000).toFixed(1)}M</>
            )
          ) : (
            'No grads have RSVP\'d going yet'
          )}
        </div>

        <div className="grad-progress-caption">
          This is a planning projection — the avg drops as more grads confirm. At {GRAD_TARGET_PERCENT}%, it's only ~₱{TARGET_AVG.toLocaleString()} each.
        </div>
      </div>

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
                  <th>Alumni Card</th>
                  <th>Shirt</th>
                  <th>Jacket</th>
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
                    <td style={{ textAlign: 'center' }}>
                      {user.section === 'Non-Graduate'
                        ? <span style={{ color: '#888', fontSize: '0.8em' }}>N/A</span>
                        : user.has_alumni_card ? '✓' : ''}
                    </td>
                    <td>{user.shirt_size || '—'}</td>
                    <td>{user.jacket_size || '—'}</td>
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
