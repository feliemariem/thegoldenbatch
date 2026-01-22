import { useState, useRef } from 'react';
import ScrollableTable from './ScrollableTable';

export default function RegisteredTab({
  users,
  isSuperAdmin,
  permissions,
}) {
  const [registeredSearch, setRegisteredSearch] = useState('');
  const [registeredRsvpFilter, setRegisteredRsvpFilter] = useState('all');

  const registeredTableRef = useRef(null);

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

  const exportToCSV = () => {
    if (!users?.length) return;

    const headers = ['First Name', 'Last Name', 'Email', 'Birthday', 'Mobile', 'Address', 'City', 'Country', 'Occupation', 'Company', 'RSVP', 'Registered At'];
    const rows = users.map(u => [
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
  };

  // Filter registered users based on search and RSVP, then sort by last_name A-Z
  const filteredUsers = (users || []).filter(user => {
    const rsvp = user.rsvp_status || '';

    // RSVP filter
    if (registeredRsvpFilter !== 'all' && rsvp !== registeredRsvpFilter) {
      return false;
    }

    // Search
    if (!registeredSearch.trim()) return true;
    const search = registeredSearch.toLowerCase();
    const name = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    return (
      name.includes(search) ||
      user.email.toLowerCase().includes(search) ||
      (user.city || '').toLowerCase().includes(search) ||
      (user.country || '').toLowerCase().includes(search) ||
      (user.occupation || '').toLowerCase().includes(search) ||
      (user.company || '').toLowerCase().includes(search)
    );
  }).sort((a, b) => {
    // Sort by last_name A-Z, null/empty values go to the end
    const lastNameA = (a.last_name || '').toLowerCase();
    const lastNameB = (b.last_name || '').toLowerCase();
    if (!lastNameA && lastNameB) return 1;
    if (lastNameA && !lastNameB) return -1;
    return lastNameA.localeCompare(lastNameB);
  });

  return (
    <div className="users-section" ref={registeredTableRef}>
      <div className="section-header">
        <h3>Registered Alumni ({users?.length || 0})</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {filteredUsers.length > 10 && (
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

      <div className="filter-row">
        <select
          value={registeredRsvpFilter}
          onChange={(e) => setRegisteredRsvpFilter(e.target.value)}
          style={{ width: '150px' }}
        >
          <option value="all">All RSVP</option>
          <option value="going">Going</option>
          <option value="maybe">Maybe</option>
          <option value="not_going">Not Going</option>
        </select>
        <input
          type="text"
          placeholder="Search by name, email, city, country..."
          value={registeredSearch}
          onChange={(e) => setRegisteredSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {filteredUsers.length > 0 ? (
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
              {filteredUsers.map((user) => (
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
      ) : (
        <p className="no-data">{registeredSearch ? 'No matching alumni' : 'No registrations yet'}</p>
      )}
    </div>
  );
}
