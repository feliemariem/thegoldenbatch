import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AnnouncementComposer from '../components/AnnouncementComposer';
import AccountingDashboard from '../components/AccountingDashboard';
import PermissionsManager from '../components/PermissionsManager';
import ScrollableTable from '../components/ScrollableTable.js';
import logo from '../images/lasalle.jpg';
import MeetingMinutes from '../components/MeetingMinutes';

export default function AdminDashboard() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('adminActiveTab') || 'invites';
  });
  const [dashboardMode, setDashboardMode] = useState('registry');
  const [permissions, setPermissions] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [data, setData] = useState(null);
  const [invites, setInvites] = useState([]);
  const [inviteForm, setInviteForm] = useState({ first_name: '', last_name: '', email: '' });
  const [inviteResult, setInviteResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [inviteSearch, setInviteSearch] = useState('');
  const [registeredSearch, setRegisteredSearch] = useState('');
  const [registeredRsvpFilter, setRegisteredRsvpFilter] = useState('all');

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });

  // Editing invite state
  const [editingInvite, setEditingInvite] = useState(null);

  // Master List state
  const [masterList, setMasterList] = useState([]);
  const [masterListStats, setMasterListStats] = useState(null);
  const [masterListSections, setMasterListSections] = useState([]);
  const [masterListFilter, setMasterListFilter] = useState('all');
  const [masterListStatusFilter, setMasterListStatusFilter] = useState('all');
  const [masterListPaymentFilter, setMasterListPaymentFilter] = useState('all');
  const [masterListSearch, setMasterListSearch] = useState('');
  const [masterListUploading, setMasterListUploading] = useState(false);
  const [masterListUploadResult, setMasterListUploadResult] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  // Scroll refs
  const invitesTableRef = useRef(null);
  const registeredTableRef = useRef(null);
  const masterListTableRef = useRef(null);

  const scrollToTop = (ref) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    fetchPermissions();
    fetchDashboard();
    fetchInvites();
    fetchMasterList();
  }, [token]);

  // Save active tab to localStorage
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  const fetchPermissions = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/permissions/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions);
        setIsSuperAdmin(data.is_super_admin);
      }
    } catch (err) {
      console.error('Failed to fetch permissions');
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        navigate('/login');
        return;
      }

      const data = await res.json();
      setData(data);
    } catch (err) {
      console.error('Failed to fetch dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterList = async (section = 'all') => {
    try {
      const url = section === 'all'
        ? 'https://the-golden-batch-api.onrender.com/api/master-list'
        : `https://the-golden-batch-api.onrender.com/api/master-list?section=${section}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMasterList(data.entries || []);
      setMasterListStats(data.stats);
      setMasterListSections(data.sections || []);
    } catch (err) {
      console.error('Failed to fetch master list');
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/invites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setInvites(data);
    } catch (err) {
      console.error('Failed to fetch invites');
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setCreating(true);
    setInviteResult(null);

    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(inviteForm),
      });

      const data = await res.json();

      if (res.ok) {
        setInviteResult({ success: true, url: data.registrationUrl });
        setInviteForm({ first_name: '', last_name: '', email: '' });
        fetchInvites();
        fetchDashboard();
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
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/invites/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        fetchInvites();
        setEditingInvite(null);
      }
    } catch (err) {
      console.error('Failed to update invite');
    }
  };

  const handleDeleteInvite = async (id) => {
    setConfirmModal({
      show: true,
      message: 'Delete this invite? This cannot be undone.',
      onConfirm: async () => {
        try {
          await fetch(`https://the-golden-batch-api.onrender.com/api/invites/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          fetchInvites();
          fetchDashboard();
        } catch (err) {
          console.error('Failed to delete invite');
        }
        setConfirmModal({ show: false, message: '', onConfirm: null });
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

      const invites = [];
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));

        // Find email column (contains @)
        const emailIndex = parts.findIndex(p => p.includes('@'));
        if (emailIndex === -1) continue;

        if (emailIndex >= 2) {
          invites.push({
            first_name: parts[emailIndex - 2] || '',
            last_name: parts[emailIndex - 1] || '',
            email: parts[emailIndex]
          });
        } else if (emailIndex === 0) {
          invites.push({ email: parts[0] });
        }
      }

      const res = await fetch('https://the-golden-batch-api.onrender.com/api/invites/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invites }),
      });

      const data = await res.json();
      setUploadResult(data);
      fetchInvites();
      fetchDashboard();
    } catch (err) {
      setUploadResult({ error: 'Failed to process CSV' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Link copied to clipboard!');
  };

  // Master List handlers
  const handleMasterListCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMasterListUploading(true);
    setMasterListUploadResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      const startIndex = lines[0].toLowerCase().includes('section') ? 1 : 0;

      const entries = [];
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
        if (parts.length >= 3) {
          entries.push({
            section: parts[0] || '',
            last_name: parts[1] || '',
            first_name: parts[2] || '',
            email: parts[3] || '',
            in_memoriam: parts[4] || ''
          });
        }
      }

      const res = await fetch('https://the-golden-batch-api.onrender.com/api/master-list/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entries }),
      });

      const data = await res.json();
      setMasterListUploadResult(data);
      fetchMasterList();
    } catch (err) {
      setMasterListUploadResult({ error: 'Failed to process CSV' });
    } finally {
      setMasterListUploading(false);
      e.target.value = '';
    }
  };

  const handleMasterListFilterChange = (e) => {
    const section = e.target.value;
    setMasterListFilter(section);
    fetchMasterList(section);
  };

  const handleUpdateEntry = async (id, updates) => {
    try {
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/master-list/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        fetchMasterList(masterListFilter);
        setEditingEntry(null);
      }
    } catch (err) {
      console.error('Failed to update entry');
    }
  };

  const handleClearMasterList = async () => {
    setConfirmModal({
      show: true,
      message: 'Are you sure you want to clear the entire master list?',
      onConfirm: async () => {
        try {
          await fetch('https://the-golden-batch-api.onrender.com/api/master-list', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          fetchMasterList();
        } catch (err) {
          console.error('Failed to clear master list');
        }
        setConfirmModal({ show: false, message: '', onConfirm: null });
      }
    });
  };

  const handleLinkToMasterList = async (inviteId, masterListId) => {
    if (!masterListId) return;

    try {
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/invites/${inviteId}/link`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ master_list_id: masterListId }),
      });

      if (res.ok) {
        fetchInvites();
        fetchMasterList();
      }
    } catch (err) {
      console.error('Failed to link to master list');
    }
  };

  const handleUnlinkFromMasterList = async (inviteId) => {
    setConfirmModal({
      show: true,
      message: 'Unlink from master list?',
      onConfirm: async () => {
        try {
          const res = await fetch(`https://the-golden-batch-api.onrender.com/api/invites/${inviteId}/unlink`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (res.ok) {
            fetchInvites();
            fetchMasterList();
          }
        } catch (err) {
          console.error('Failed to unlink from master list');
        }
        setConfirmModal({ show: false, message: '', onConfirm: null });
      }
    });
  };

  const exportMasterListCSV = () => {
    if (!masterList?.length) return;

    const headers = ['Section', 'Last Name', 'First Name', 'Nickname', 'Email', 'Status'];
    const rows = masterList.map(m => [
      m.section,
      m.last_name,
      m.first_name,
      m.nickname || '',
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

  // Filter master list based on search and status
  const filteredMasterList = masterList.filter(entry => {
    const status = (entry.status || '').toLowerCase();

    // Status filter
    if (masterListStatusFilter !== 'all' && status !== masterListStatusFilter) {
      return false;
    }

    // Payment filter (only applies to graduates, not Non-Graduate or In Memoriam)
    if (masterListPaymentFilter !== 'all') {
      // Skip non-graduates and in memoriam for payment filter
      if (entry.section === 'Non-Graduate' || entry.in_memoriam) {
        return false;
      }
      const paymentStatus = (entry.payment_status || 'Unpaid').toLowerCase();
      if (paymentStatus !== masterListPaymentFilter.toLowerCase()) {
        return false;
      }
    }

    // Name search
    if (!masterListSearch.trim()) return true;
    const search = masterListSearch.toLowerCase().trim();
    const name = `${entry.last_name || ''} ${entry.first_name || ''}`.toLowerCase();

    return (
      name.includes(search) ||
      (entry.nickname || '').toLowerCase().includes(search)
    );
  });

  const exportToCSV = () => {
    if (!data?.users?.length) return;

    const headers = ['First Name', 'Last Name', 'Email', 'Birthday', 'Mobile', 'Address', 'City', 'Country', 'Occupation', 'Company', 'RSVP', 'Registered At'];
    const rows = data.users.map(u => [
      u.first_name,
      u.last_name,
      u.email,
      u.birthday ? new Date(u.birthday).toLocaleDateString() : '',
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

  const exportInvitesCSV = () => {
    if (!invites?.length) return;

    const headers = ['First Name', 'Last Name', 'Email', 'Status', 'Registration Link'];
    const rows = invites.map(i => [
      i.first_name || '',
      i.last_name || '',
      i.email,
      i.used ? 'Registered' : 'Pending',
      `http://localhost:3000/register/${i.invite_token}`
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usls-batch-2003-invites.csv';
    a.click();
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const pendingCount = invites.filter(i => !i.used).length;
  const registeredCount = invites.filter(i => i.used).length;

  // Filter invites based on search
  const filteredInvites = invites.filter(invite => {
    if (!inviteSearch.trim()) return true;
    const search = inviteSearch.toLowerCase();
    const name = `${invite.first_name || ''} ${invite.last_name || ''}`.toLowerCase();
    const status = invite.used ? 'registered' : 'pending';
    return (
      name.includes(search) ||
      invite.email.toLowerCase().includes(search) ||
      status.includes(search)
    );
  });

  // Filter registered users based on search and RSVP
  const filteredUsers = (data?.users || []).filter(user => {
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
  });

  return (
    <div className="container admin-container">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <img src={logo} alt="La Salle" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          <h2 style={{
            background: 'linear-gradient(135deg, #CFB53B 0%, #F5E6A3 50%, #CFB53B 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '1.1rem',
            fontWeight: '700',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            margin: 0
          }}>The Golden Batch</h2>
        </div>
        <p style={{ color: '#666', marginBottom: '4px', fontSize: '0.9rem' }}>Welcome, {user?.first_name || 'Admin'}!</p>
        <div className="header-row">
          <h1>Admin Dashboard</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setShowGuide(!showGuide)}
              style={{
                background: 'none',
                border: '1px solid rgba(207, 181, 59, 0.3)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#CFB53B',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {showGuide ? 'Hide' : '📖 Guide'}
            </button>
            <Link to="/profile" className="btn-link" style={{ marginRight: '8px' }}>
              My Profile
            </Link>
            <button onClick={handleLogout} className="btn-link">
              Logout
            </button>
          </div>
        </div>

        {showGuide && (
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid rgba(207, 181, 59, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            color: '#666'
          }}>
            <h3 style={{ color: '#006633', marginBottom: '16px', fontSize: '1rem' }}>📖 Admin Guide</h3>

            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#006633' }}>Registry Mode:</strong>
              <ul style={{ margin: '8px 0 0 20px' }}>
                <li><strong style={{ color: '#006633' }}>Invites</strong> — Add batchmates and send them registration links via email</li>
                <li><strong style={{ color: '#006633' }}>Registered</strong> — View who has signed up and their RSVP status</li>
                <li><strong style={{ color: '#006633' }}>Master List</strong> — Track all batchmates and their payment progress</li>
              </ul>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#006633' }}>Announce Mode:</strong>
              <ul style={{ margin: '8px 0 0 20px' }}>
                <li>Send email announcements to registered batchmates (filter by RSVP status)</li>
                <li>View announcement history and export to CSV</li>
              </ul>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#006633' }}>Accounting Mode:</strong>
              <ul style={{ margin: '8px 0 0 20px' }}>
                <li>Record deposits (contributions) and withdrawals (expenses)</li>
                <li>Link payments to batchmates — this updates their Payment status in Master List</li>
                <li>Upload receipts for each transaction</li>
              </ul>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: '#006633' }}>Minutes Mode:</strong>
              <ul style={{ margin: '8px 0 0 20px' }}>
                <li>Upload and manage meeting minutes (PDF)</li>
                <li>Keep a record of committee decisions and discussions</li>
              </ul>
            </div>

            <div>
              <strong style={{ color: '#006633' }}>Permissions Mode:</strong>
              <ul style={{ margin: '8px 0 0 20px' }}>
                <li>Control what each admin can view/edit (Super Admins only)</li>
              </ul>
            </div>

            <p style={{ marginTop: '16px', fontSize: '0.85rem' }}>
              💡 Tip: Use the filters and search in each tab to quickly find what you need.
            </p>
          </div>
        )}

        {/* Dashboard Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          background: 'rgba(0,0,0,0.2)',
          padding: '4px',
          borderRadius: '12px',
          width: '100%',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setDashboardMode('registry')}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.75rem',
              background: dashboardMode === 'registry' ? '#CFB53B' : 'transparent',
              color: dashboardMode === 'registry' ? '#1a1a2e' : '#999',
              whiteSpace: 'nowrap'
            }}
          >
            Registry
          </button>
          {(isSuperAdmin || permissions?.announcements_view) && (
            <button
              onClick={() => setDashboardMode('announcements')}
              style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.75rem',
                background: dashboardMode === 'announcements' ? '#CFB53B' : 'transparent',
                color: dashboardMode === 'announcements' ? '#1a1a2e' : '#999',
                whiteSpace: 'nowrap'
              }}
            >
              Announce
            </button>
          )}
          {(isSuperAdmin || permissions?.accounting_view) && (
            <button
              onClick={() => setDashboardMode('accounting')}
              style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.75rem',
                background: dashboardMode === 'accounting' ? '#CFB53B' : 'transparent',
                color: dashboardMode === 'accounting' ? '#1a1a2e' : '#999',
                whiteSpace: 'nowrap'
              }}
            >
              Accounting
            </button>
          )}
          {(isSuperAdmin || permissions?.minutes_view) && (
            <button
              onClick={() => setDashboardMode('minutes')}
              style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.75rem',
                background: dashboardMode === 'minutes' ? '#CFB53B' : 'transparent',
                color: dashboardMode === 'minutes' ? '#1a1a2e' : '#999',
                whiteSpace: 'nowrap'
              }}
            >
              Minutes
            </button>
          )}
          {isSuperAdmin && (
            <button
              onClick={() => setDashboardMode('permissions')}
              style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.75rem',
                background: dashboardMode === 'permissions' ? '#CFB53B' : 'transparent',
                color: dashboardMode === 'permissions' ? '#1a1a2e' : '#999',
                whiteSpace: 'nowrap'
              }}
            >
              Permissions
            </button>
          )}
        </div>

        {/* REGISTRY MODE */}
        {dashboardMode === 'registry' && (
          <>
            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{invites.length}</div>
                <div className="stat-label">Total Invited</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{registeredCount}</div>
                <div className="stat-label">Registered</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{pendingCount}</div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat-card going">
                <div className="stat-number">{data?.stats?.going || 0}</div>
                <div className="stat-label">Going</div>
              </div>
              <div className="stat-card maybe">
                <div className="stat-number">{data?.stats?.maybe || 0}</div>
                <div className="stat-label">Maybe</div>
              </div>
              <div className="stat-card not-going">
                <div className="stat-number">{data?.stats?.not_going || 0}</div>
                <div className="stat-label">Not Going</div>
              </div>
            </div>

            {/* Percentage Stats */}
            <div className="percentage-stats">
              <div className="percentage-box">
                <span className="percentage-label">Invited:</span>
                <div className="percentage-grid">
                  <span className="percentage-item">{invites.length ? Math.round((registeredCount / invites.length) * 100) : 0}% Registered</span>
                  <span className="percentage-item">{invites.length ? Math.round((pendingCount / invites.length) * 100) : 0}% Pending</span>
                </div>
              </div>
              <div className="percentage-box">
                <span className="percentage-label">Registered:</span>
                <div className="percentage-grid">
                  <span className="percentage-item going">{registeredCount ? Math.round(((data?.stats?.going || 0) / registeredCount) * 100) : 0}% Going</span>
                  <span className="percentage-item maybe">{registeredCount ? Math.round(((data?.stats?.maybe || 0) / registeredCount) * 100) : 0}% Maybe</span>
                  <span className="percentage-item not-going full-width">{registeredCount ? Math.round(((data?.stats?.not_going || 0) / registeredCount) * 100) : 0}% Not Going</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'invites' ? 'active' : ''}`}
                onClick={() => setActiveTab('invites')}
              >
                Invites ({invites.length})
              </button>
              <button
                className={`tab ${activeTab === 'registered' ? 'active' : ''}`}
                onClick={() => setActiveTab('registered')}
              >
                Registered ({data?.users?.length || 0})
              </button>
              <button
                className={`tab ${activeTab === 'masterlist' ? 'active' : ''}`}
                onClick={() => setActiveTab('masterlist')}
              >
                Master List ({masterList.length})
              </button>
            </div>

            {/* Invites Tab */}
            {activeTab === 'invites' && (
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
                                onClick={() => copyToClipboard(inviteResult.url)}
                                className="btn-copy"
                              >
                                Copy
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
                            <p>✅{uploadResult.success?.length || 0} invites created</p>
                            {uploadResult.duplicates?.length > 0 && (
                              <p>⚠️ {uploadResult.duplicates.length} duplicates skipped</p>
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
                    <h3>All Invites ({invites.length})</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {filteredInvites.length > 10 && (
                        <button onClick={() => scrollToTop(invitesTableRef)} className="btn-secondary" title="Scroll to top">
                          ^ Top
                        </button>
                      )}
                      {(isSuperAdmin || permissions?.invites_export) && (
                        <button onClick={exportInvitesCSV} className="btn-secondary">
                          Export CSV
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="search-bar">
                    <input
                      type="text"
                      placeholder="Search by name, email, or status..."
                      value={inviteSearch}
                      onChange={(e) => setInviteSearch(e.target.value)}
                    />
                    {inviteSearch && (
                      <span className="search-count">
                        {filteredInvites.length} of {invites.length}
                      </span>
                    )}
                  </div>

                  {filteredInvites.length > 0 ? (
                    <ScrollableTable>
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
                          {filteredInvites.map((invite) => (
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
                                      style={{ width: '100%', padding: '4px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }}
                                    />
                                  </td>
                                  <td>
                                    <span className={`rsvp-badge ${invite.used ? 'going' : 'pending'}`}>
                                      {invite.used ? 'Registered“' : 'Pending'}
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
                                        onClick={() => copyToClipboard(`http://localhost:3000/register/${invite.invite_token}`)}
                                        className="btn-link"
                                      >
                                        Copy Link
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
                                            className="btn-link"
                                            style={{ color: '#dc3545' }}
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
                  ) : (
                    <p className="no-data">{inviteSearch ? 'No matching invites' : 'No invites yet'}</p>
                  )}
                </div>
              </>
            )}

            {/* Registered Tab */}
            {activeTab === 'registered' && (
              <div className="users-section" ref={registeredTableRef}>
                <div className="section-header">
                  <h3>Registered Alumni ({data?.users?.length || 0})</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {filteredUsers.length > 10 && (
                      <button onClick={() => scrollToTop(registeredTableRef)} className="btn-secondary" title="Scroll to top">
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
                  <ScrollableTable>
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
                            <td>{user.birthday ? new Date(user.birthday).toLocaleDateString() : '-'}</td>
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
            )}

            {/* Master List Tab */}
            {activeTab === 'masterlist' && (
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
                    <div style={{
                      background: 'rgba(0,102,51,0.08)',
                      border: '1px solid rgba(0,102,51,0.2)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      flex: '1',
                      minWidth: '280px'
                    }}>
                      <div style={{ color: '#006633', marginBottom: '8px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Master List Status</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <span><strong style={{ color: '#006633' }}>{masterListStats.registered || 0}</strong> Registered</span>
                        <span><strong style={{ color: '#006633' }}>{masterListStats.invited || 0}</strong> Invited</span>
                        <span><strong style={{ color: '#006633' }}>{masterListStats.not_invited || 0}</strong> Not Invited</span>
                        <span><strong style={{ color: '#006633' }}>{masterListStats.in_memoriam || 0}</strong> In Memoriam</span>
                        <span><strong style={{ color: '#006633' }}>{masterListStats.unreachable || 0}</strong> Unreachable</span>
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(0,102,51,0.08)',
                      border: '1px solid rgba(0,102,51,0.2)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      flex: '1',
                      minWidth: '280px'
                    }}>
                      <div style={{ color: '#006633', marginBottom: '8px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Status (Graduates)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <span><strong style={{ color: '#28a745' }}>{parseInt(masterListStats.full_paid) || 0}</strong> Full ({parseInt(masterListStats.total_graduates) ? Math.round((parseInt(masterListStats.full_paid) / parseInt(masterListStats.total_graduates)) * 100) : 0}%)</span>
                        <span><strong style={{ color: '#CFB53B' }}>{parseInt(masterListStats.partial_paid) || 0}</strong> Partial ({parseInt(masterListStats.total_graduates) ? Math.round((parseInt(masterListStats.partial_paid) / parseInt(masterListStats.total_graduates)) * 100) : 0}%)</span>
                        <span><strong style={{ color: '#dc3545' }}>{parseInt(masterListStats.unpaid) || 0}</strong> Unpaid ({parseInt(masterListStats.total_graduates) ? Math.round((parseInt(masterListStats.unpaid) / parseInt(masterListStats.total_graduates)) * 100) : 0}%)</span>
                        <span>/ {parseInt(masterListStats.total_graduates) || 0} total</span>
                      </div>
                    </div>
                  </div>
                )}

               {/* BULK UPLOAD MASTER LIST - ENABLED FOR NOW <div className="invite-section">
              <h3>Upload Master List (CSV)</h3>
              <p className="help-text-small">CSV format: Section, Last Name, First Name, Nickname (optional)</p>
              <div className="upload-row">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleMasterListCSVUpload}
                  disabled={masterListUploading}
                  id="master-list-csv-upload"
                  className="file-input"
                />
                <label htmlFor="master-list-csv-upload" className="btn-secondary upload-btn">
                  {masterListUploading ? 'Uploading...' : 'Choose CSV File'}
                </label>
              </div>

              {masterListUploadResult && (
                <div className={`invite-result ${masterListUploadResult.error ? 'error' : 'success'}`}>
                  {masterListUploadResult.error ? (
                    <p>{masterListUploadResult.error}</p>
                  ) : (
                    <>
                      <p>✅ {masterListUploadResult.created} entries added</p>
                      {masterListUploadResult.duplicates > 0 && (
                        <p>⚠️ {masterListUploadResult.duplicates} duplicates skipped</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div> 
            */}      
               
  
       

                {/* Filter and Search */}
                <div className="section-header">
                  <h3>Batch Directory ({filteredMasterList.length})</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {filteredMasterList.length > 10 && (
                      <button onClick={() => scrollToTop(masterListTableRef)} className="btn-secondary" title="Scroll to top">
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
                    onChange={(e) => setMasterListStatusFilter(e.target.value)}
                    style={{ width: '150px' }}
                  >
                    <option value="all">All Status</option>
                    <option value="not invited">Not Invited</option>
                    <option value="invited">Invited</option>
                    <option value="registered">Registered</option>
                    <option value="in memoriam">In Memoriam</option>
                    <option value="unreachable">Unreachable</option>
                  </select>
                  <select
                    value={masterListPaymentFilter}
                    onChange={(e) => setMasterListPaymentFilter(e.target.value)}
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
                    onChange={(e) => setMasterListSearch(e.target.value)}
                    className="search-input"
                  />
                  {(masterListFilter !== 'all' || masterListStatusFilter !== 'all' || masterListPaymentFilter !== 'all' || masterListSearch) && (
                    <button
                      onClick={() => {
                        setMasterListFilter('all');
                        setMasterListStatusFilter('all');
                        setMasterListPaymentFilter('all');
                        setMasterListSearch('');
                        fetchMasterList('all');
                      }}
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
                {filteredMasterList.length > 0 ? (
                  <ScrollableTable>
                    <table>
                      <thead>
                        <tr>
                          <th>Last Name</th>
                          <th>First Name</th>
                          <th>Nickname</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Payment</th>
                          <th style={{ fontSize: '0.85rem' }}>Balance<br /><span style={{ fontWeight: 'normal', color: '#888', fontSize: '0.75rem' }}>(P25k target)</span></th>
                          {(isSuperAdmin || permissions?.masterlist_edit) && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMasterList.map((entry) => (
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
                                    defaultValue={entry.nickname || ''}
                                    id={`edit-nickname-${entry.id}`}
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
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <input
                                        type="checkbox"
                                        defaultChecked={entry.in_memoriam}
                                        id={`edit-memoriam-${entry.id}`}
                                      />
                                      In Memoriam
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <input
                                        type="checkbox"
                                        defaultChecked={entry.is_unreachable}
                                        id={`edit-unreachable-${entry.id}`}
                                      />
                                      Unreachable
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <input
                                        type="checkbox"
                                        defaultChecked={entry.is_admin}
                                        id={`edit-admin-${entry.id}`}
                                      />
                                      Admin
                                    </label>
                                  </div>
                                </td>
                                <td style={{ color: '#666', textAlign: 'center' }}>-</td>
                                <td style={{ color: '#666', textAlign: 'center' }}>-</td>
                                {(isSuperAdmin || permissions?.masterlist_edit) && (
                                  <td>
                                    <div style={{ display: 'flex', gap: '8px', whiteSpace: 'nowrap' }}>
                                      <button
                                        onClick={() => {
                                          handleUpdateEntry(entry.id, {
                                            last_name: document.getElementById(`edit-lastname-${entry.id}`).value,
                                            first_name: document.getElementById(`edit-firstname-${entry.id}`).value,
                                            nickname: document.getElementById(`edit-nickname-${entry.id}`).value,
                                            email: document.getElementById(`edit-email-${entry.id}`).value,
                                            in_memoriam: document.getElementById(`edit-memoriam-${entry.id}`).checked,
                                            is_unreachable: document.getElementById(`edit-unreachable-${entry.id}`).checked,
                                            is_admin: document.getElementById(`edit-admin-${entry.id}`).checked,
                                          });
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
                                <td>{entry.nickname || '-'}</td>
                                <td>{entry.email || '-'}</td>
                                <td>
                                  <span style={{ whiteSpace: 'nowrap' }} className={`rsvp-badge ${entry.status === 'Registered' ? 'going' : entry.status === 'Invited' ? 'maybe' : entry.status === 'In Memoriam' ? 'memoriam' : entry.status === 'Unreachable' ? 'pending' : 'pending'}`}>
                                    {entry.status === 'In Memoriam' ? 'IN MEMORIAM' : entry.status === 'Unreachable' ? 'UNREACHABLE' : entry.status}
                                  </span>
                                </td>
                                <td>
                                  {entry.in_memoriam || entry.section === 'Non-Graduate' ? (
                                    <span style={{ color: '#666' }}>-</span>
                                  ) : (
                                    <span style={{
                                      padding: '4px 10px',
                                      borderRadius: '12px',
                                      fontSize: '0.8rem',
                                      fontWeight: '600',
                                      background: entry.payment_status === 'Full' ? 'rgba(40, 167, 69, 0.15)' :
                                        entry.payment_status === 'Partial' ? 'rgba(207, 181, 59, 0.15)' :
                                          'rgba(220, 53, 69, 0.15)',
                                      color: entry.payment_status === 'Full' ? '#28a745' :
                                        entry.payment_status === 'Partial' ? '#CFB53B' :
                                          '#dc3545'
                                    }}>
                                      {entry.payment_status || 'Unpaid'}
                                    </span>
                                  )}
                                </td>
                                <td style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                                  {entry.in_memoriam || entry.section === 'Non-Graduate' ? (
                                    <span style={{ color: '#666' }}>-</span>
                                  ) : entry.payment_status === 'Full' ? (
                                    <span style={{ color: '#28a745', fontWeight: '600' }}>Paid</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-primary)' }}>P{parseFloat(entry.balance || 25000).toLocaleString()}</span>
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
                ) : (
                  <p className="no-data">{masterListSearch ? 'No matching entries' : 'No master list entries.'}</p>
                )}
              </div>
            )}
          </>
        )}

        {/* ANNOUNCEMENTS MODE */}
        {dashboardMode === 'announcements' && (
          <AnnouncementComposer
            token={token}
            registeredCount={data?.users?.length || 0}
            goingCount={data?.stats?.going || 0}
            maybeCount={data?.stats?.maybe || 0}
            notGoingCount={data?.stats?.not_going || 0}
            canSend={isSuperAdmin || permissions?.announcements_send}
          />
        )}

        {/* ACCOUNTING MODE */}
        {dashboardMode === 'accounting' && (
          <AccountingDashboard
            token={token}
            canEdit={isSuperAdmin || permissions?.accounting_edit}
            canExport={isSuperAdmin || permissions?.accounting_export}
          />
        )}

        {/* MINUTES MODE */}
        {dashboardMode === 'minutes' && (
          <MeetingMinutes token={token} canEdit={isSuperAdmin || permissions?.minutes_edit} />
        )}

        {/* PERMISSIONS MODE - Super Admin Only */}
        {dashboardMode === 'permissions' && isSuperAdmin && (
          <PermissionsManager token={token} />
        )}
      </div>

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(165deg, rgba(30, 40, 35, 0.98) 0%, rgba(20, 28, 24, 0.99) 100%)',
            border: '1px solid rgba(207, 181, 59, 0.2)',
            borderRadius: '16px',
            padding: '24px 32px',
            maxWidth: '320px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <p style={{ color: '#e0e0e0', marginBottom: '20px', fontSize: '0.95rem' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
                className="btn-secondary"
                style={{ padding: '10px 20px' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="btn-primary"
                style={{ padding: '10px 20px', width: 'auto', marginTop: 0 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}