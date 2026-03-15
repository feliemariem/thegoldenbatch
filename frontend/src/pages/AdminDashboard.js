import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AnnouncementComposer from '../components/AnnouncementComposer';
import AccountingDashboard from '../components/AccountingDashboard';
import PermissionsManager from '../components/PermissionsManager';
import SystemTest from '../components/SystemTest';
import InvitesTab from '../components/InvitesTab';
import RegisteredTab from '../components/RegisteredTab';
import MasterListTab from '../components/MasterListTab';
import Navbar from '../components/Navbar';
import MeetingMinutes from '../components/MeetingMinutes';
import StrategicPlanning from '../components/StrategicPlanning';
import AdminRoleErrorToast from "../components/AdminRoleErrorToast";
import AdminMessages from '../components/AdminMessages';
import EmailLog from '../components/EmailLog';
import MediaTab from '../components/admin/MediaTab';
import Footer from '../components/Footer';
import { apiGet } from '../api';

// Batch-rep deadline: March 21, 2026 at 11:59 PM PHT (UTC+8)
const BATCH_REP_DEADLINE = new Date('2026-03-21T23:59:00+08:00');

const getDaysUntilBatchRepDeadline = () => {
  const now = new Date();
  const diffTime = BATCH_REP_DEADLINE - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const formatPHT = (date) => {
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Parse URL parameters for meeting deep linking (e.g., /admin?tab=minutes&meetingId=5)
  const urlParams = new URLSearchParams(location.search);
  const urlMeetingId = urlParams.get('meetingId');

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('adminActiveTab') || 'invites';
  });
  const validTabs = ['registry', 'accounting', 'announcements', 'minutes', 'messages', 'strategic', 'permissions', 'emailLog', 'systemTest', 'media'];
  const [dashboardMode, setDashboardModeState] = useState(() => {
    const tabFromUrl = new URLSearchParams(window.location.search).get('tab');
    // Handle legacy 'meetings' param
    if (tabFromUrl === 'meetings') return 'minutes';
    if (tabFromUrl && validTabs.includes(tabFromUrl)) return tabFromUrl;
    return 'registry';
  });

  const setDashboardMode = (tab) => {
    setDashboardModeState(tab);
    window.history.replaceState(null, '', `?tab=${tab}`);
  };
  // Store the meeting ID from URL before it gets cleared
  const [selectedMeetingIdFromUrl, setSelectedMeetingIdFromUrl] = useState(() => {
    return urlMeetingId ? parseInt(urlMeetingId) : null;
  });
  const [permissions, setPermissions] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isRegistryAdmin, setIsRegistryAdmin] = useState(false);
  const [data, setData] = useState(null);
  const [inviteStats, setInviteStats] = useState({ total: 0, registered: 0, pending: 0 });
  const [registeredStats, setRegisteredStats] = useState({ total: 0, going: 0, maybe: 0, not_going: 0, no_response: 0 });
  const [masterListStats, setMasterListStats] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [showAdminRoleError, setShowAdminRoleError] = useState(false);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [emailLogCount, setEmailLogCount] = useState(0);
  const [mediaPendingCount, setMediaPendingCount] = useState(0);

  // Batch Rep Results state (System Admin only)
  const [batchRepResults, setBatchRepResults] = useState(null);
  const [batchRepOpen, setBatchRepOpen] = useState(false);
  const [batchRepLoading, setBatchRepLoading] = useState(false);
  const [batchRepLastUpdated, setBatchRepLastUpdated] = useState(null);

  // Batch Rep Response Stats by Section (user.id === 1 only)
  const [batchRepResponseStats, setBatchRepResponseStats] = useState(null);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });

  const [showGuide, setShowGuide] = useState(false);

  // Callback ref for refreshing master list from AccountingDashboard
  const [masterListRefresh, setMasterListRefresh] = useState(null);

  // Fetch all dashboard stats on mount (independent of tab selection)
  const fetchDashboardStats = async () => {
    try {
      // Fetch invite stats, registered stats, and master list stats in parallel
      const [invitesRes, usersRes, masterListRes] = await Promise.all([
        apiGet('/api/invites?page=1&limit=1'),
        apiGet('/api/admin/users?page=1&limit=1'),
        apiGet('/api/master-list?page=1&limit=1')
      ]);

      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        if (invitesData.stats) {
          setInviteStats(invitesData.stats);
        }
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.stats) {
          setRegisteredStats(usersData.stats);
        }
      }

      if (masterListRes.ok) {
        const masterListData = await masterListRes.json();
        if (masterListData.stats) {
          setMasterListStats(masterListData.stats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  };

  useEffect(() => {
    fetchPermissions();
    fetchDashboard();
    fetchAdminUnreadCount();
    fetchDashboardStats();
  }, [user]);

  // Fetch email log count for system admin (id=1)
  useEffect(() => {
    if (isSystemAdmin) {
      fetchEmailLogCount();
    }
  }, [isSystemAdmin]);

  // Fetch media pending count for users with media access
  useEffect(() => {
    const fetchMediaPendingCount = async () => {
      try {
        const res = await apiGet(`/api/media/photos?status=pending&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setMediaPendingCount(data.photos?.length || 0);
        }
      } catch (err) {
        // User may not have media access, ignore error
      }
    };

    if (isSuperAdmin || permissions?.can_approve_media) {
      fetchMediaPendingCount();
    }
  }, [isSuperAdmin, permissions]);

  const fetchAdminUnreadCount = async () => {
    try {
      const res = await apiGet('/api/messages/admin-inbox/unread-count');
      if (res.ok) {
        const data = await res.json();
        setAdminUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch admin unread count:', err);
    }
  };

  const fetchEmailLogCount = async () => {
    try {
      const res = await apiGet('/api/announcements/email-log/count');
      if (res.ok) {
        const data = await res.json();
        setEmailLogCount(data.count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch email log count:', err);
    }
  };

  const fetchBatchRepResults = async () => {
    setBatchRepLoading(true);
    try {
      const res = await apiGet('/api/batch-rep/results');
      if (res.ok) {
        const data = await res.json();
        setBatchRepResults(data);
        setBatchRepLastUpdated(new Date());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBatchRepLoading(false);
    }
  };

  useEffect(() => {
    if (batchRepOpen && !batchRepResults && isSystemAdmin) {
      fetchBatchRepResults();
    }
  }, [batchRepOpen, batchRepResults, isSystemAdmin]);

  // Fetch batch rep response stats for System tab (user.id === 1 only)
  useEffect(() => {
    const fetchBatchRepResponseStats = async () => {
      try {
        const res = await apiGet('/api/admin/batch-rep/response-stats');
        if (res.ok) {
          const data = await res.json();
          setBatchRepResponseStats(data);
        }
      } catch (err) {
        console.error('Error fetching batch rep response stats:', err);
      }
    };

    if (user?.id === 1 && dashboardMode === 'systemTest') {
      fetchBatchRepResponseStats();
    }
  }, [user?.id, dashboardMode]);

  // Handle legacy URL parameter (meetings → minutes) and set URL if not present
  useEffect(() => {
    const currentTab = new URLSearchParams(window.location.search).get('tab');
    if (!currentTab) {
      window.history.replaceState(null, '', `?tab=${dashboardMode}`);
    }
  }, []);

  // Save active tab to localStorage (skip for Registry Admins)
  useEffect(() => {
    if (!isRegistryAdmin) {
      localStorage.setItem('adminActiveTab', activeTab);
    }
  }, [activeTab, isRegistryAdmin]);

  const fetchPermissions = async () => {
    try {
      const res = await apiGet('/api/permissions/me');

      if (res.ok) {
        const data = await res.json();

        const normalizedPermissions = Array.isArray(data.permissions)
          ? data.permissions.reduce((acc, perm) => ({ ...acc, [perm]: true }), {})
          : (data.permissions || {});

        setPermissions(normalizedPermissions);
        setIsSuperAdmin(data.is_super_admin);
        // System admin is specifically admin id=1
        setIsSystemAdmin(data.is_super_admin && data.admin_id === 1);

        // Registry Admin: not super admin and has no permissions
        const registryAdminStatus = !data.is_super_admin && (!normalizedPermissions || Object.values(normalizedPermissions).every(v => !v));
        setIsRegistryAdmin(registryAdminStatus);
        if (registryAdminStatus) {
          // Force activeTab to 'registered' and don't persist to localStorage
          setActiveTab('registered');
        }
      }
    } catch (err) {
      console.error('Failed to fetch permissions');
    }
  };


  const fetchDashboard = async () => {
    try {
      const res = await apiGet('/api/admin/dashboard');

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


  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p>{['Dali lang gid ha?', 'Hulat!'][Math.floor(Math.random() * 2)]}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const pendingCount = inviteStats.pending;
  const registeredCount = inviteStats.registered;

  return (
    <div className="container admin-container" style={{ position: 'relative' }}>
      <Navbar />
      <div className="card">
        <p style={{ color: '#666', marginBottom: '4px', fontSize: '0.9rem' }}>Welcome, {user?.first_name || 'Admin'}!</p>
        <div className="header-row">
          <h1>Admin Dashboard</h1>
          {!isRegistryAdmin && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="btn-guide"
              >
                {showGuide ? 'Hide' : '📖 Guide'}
              </button>
            </div>
          )}
        </div>

        {!isRegistryAdmin && showGuide && (
          <div className="admin-guide">
            <h3 className="admin-guide-title">Admin Guide</h3>

            <div className="admin-guide-content">
              <div className="admin-guide-item">
                <h4>Registry Mode</h4>
                <ul>
                  <li><strong>Invites</strong> — Add batchmates and send them registration links via email</li>
                  <li><strong>Registered</strong> — View who has signed up and their RSVP status</li>
                  <li><strong>Master List</strong> — Track all batchmates and their payment progress</li>
                </ul>
              </div>

              <div className="admin-guide-item">
                <h4>Accounting Mode</h4>
                <ul>
                  <li>Record deposits (contributions) and withdrawals (expenses)</li>
                  <li>Link payments to batchmates — this updates their Payment status in Master List</li>
                  <li>Upload receipts for each transaction</li>
                </ul>
              </div>

              <div className="admin-guide-item">
                <h4>Announce Mode</h4>
                <ul>
                  <li>Send email announcements to registered batchmates (filter by RSVP status)</li>
                  <li>Batchmates also receive announcements in their Inbox on the site</li>
                  <li>View announcement history and export to CSV</li>
                </ul>
              </div>

              <div className="admin-guide-item">
                <h4>Meetings Mode</h4>
                <ul>
                  <li>Upload and manage meeting minutes (PDF)</li>
                  <li>Keep a record of committee decisions and discussions</li>
                </ul>
              </div>

              <div className="admin-guide-item">
                <h4>Messages Mode</h4>
                <ul>
                  <li>Shared inbox for all admin committee members</li>
                  <li>View and respond to messages from batchmates</li>
                  <li>When users click "Reply to Committee" — it shows up here</li>
                  <li>All admins can see the same messages</li>
                </ul>
              </div>

              <div className="admin-guide-item">
                <h4>Permissions Mode</h4>
                <ul>
                  <li>Control what each admin can view/edit (Super Admins only)</li>
                </ul>
              </div>

              <div className="admin-guide-tip">
                <span className="tip-icon">💡</span>
                <span className="tip-text"><strong>Tip:</strong> Use the filters and search in each tab to quickly find what you need. If you have further questions or feedback, please contact Felie <span className="heart-emoji">♥</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Mode Toggle */}
        {(() => {
          const showAllTabs = user?.is_super_admin || user?.hasNonRegistryPermissions;
          return (
            <div className="dashboard-mode-tabs">
              <button
                onClick={() => setDashboardMode('registry')}
                className={dashboardMode === 'registry' ? 'active' : ''}
              >
                Registry
              </button>
              {showAllTabs && (isSuperAdmin || permissions?.accounting_view) && (
                <button
                  onClick={() => setDashboardMode('accounting')}
                  className={dashboardMode === 'accounting' ? 'active' : ''}
                >
                  Accounting
                </button>
              )}
              {showAllTabs && (isSuperAdmin || permissions?.announcements_view) && (
                <button
                  onClick={() => setDashboardMode('announcements')}
                  className={dashboardMode === 'announcements' ? 'active' : ''}
                >
                  Announce
                </button>
              )}
              {showAllTabs && (isSuperAdmin || permissions?.minutes_view) && (
                <button
                  onClick={() => setDashboardMode('minutes')}
                  className={dashboardMode === 'minutes' ? 'active' : ''}
                >
                  Meetings
                </button>
              )}
              {showAllTabs && (isSuperAdmin || permissions?.messages_view) && (
                <button
                  onClick={() => setDashboardMode('messages')}
                  className={dashboardMode === 'messages' ? 'active has-badge' : 'has-badge'}
                >
                  Messages
                  {adminUnreadCount > 0 && (
                    <span
                      className={dashboardMode === 'messages' ? 'unread-badge active-badge' : 'unread-badge'}
                    >
                      {adminUnreadCount}
                    </span>
                  )}
                </button>
              )}
              {showAllTabs && (isSuperAdmin || permissions?.strategic_view) && (
                <button
                  onClick={() => setDashboardMode('strategic')}
                  className={dashboardMode === 'strategic' ? 'active' : ''}
                >
                  Strategic
                </button>
              )}
              {showAllTabs && (isSuperAdmin || permissions?.can_approve_media) && (
                <button
                  onClick={() => setDashboardMode('media')}
                  className={dashboardMode === 'media' ? 'active has-badge' : 'has-badge'}
                >
                  Media
                  {mediaPendingCount > 0 && (
                    <span
                      className={dashboardMode === 'media' ? 'unread-badge active-badge' : 'unread-badge'}
                    >
                      {mediaPendingCount}
                    </span>
                  )}
                </button>
              )}
              {showAllTabs && isSuperAdmin && (
                <button
                  onClick={() => setDashboardMode('permissions')}
                  className={dashboardMode === 'permissions' ? 'active' : ''}
                >
                  Permissions
                </button>
              )}
              {showAllTabs && isSystemAdmin && (
                <button
                  onClick={() => setDashboardMode('emailLog')}
                  className={dashboardMode === 'emailLog' ? 'active has-badge' : 'has-badge'}
                >
                  Email Log
                  {emailLogCount > 0 && (
                    <span className="email-log-badge">
                      {emailLogCount}
                    </span>
                  )}
                </button>
              )}
              {showAllTabs && user?.email?.toLowerCase() === 'uslsis.batch2003@gmail.com' && (
                <button
                  onClick={() => setDashboardMode('systemTest')}
                  className={dashboardMode === 'systemTest' ? 'active' : ''}
                >
                  System Test
                </button>
              )}
            </div>
          );
        })()}

        {/* REGISTRY MODE */}
        {dashboardMode === 'registry' && (
          <>
            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{inviteStats.total}</div>
                <div className="stat-label">Emails Received</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{registeredCount}</div>
                <div className="stat-label">Registered</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{pendingCount}</div>
                <div className="stat-label">Pending</div>
              </div>
              {!isRegistryAdmin && (
                <>
                  <div className="stat-card going">
                    <div className="stat-number">{registeredStats.going || 0}</div>
                    <div className="stat-label">Going</div>
                  </div>
                  <div className="stat-card maybe">
                    <div className="stat-number">{registeredStats.maybe || 0}</div>
                    <div className="stat-label">Maybe</div>
                  </div>
                  <div className="stat-card not-going">
                    <div className="stat-number">{registeredStats.not_going || 0}</div>
                    <div className="stat-label">Not Going</div>
                  </div>
                </>
              )}
            </div>

            {/* Percentage Stats */}
            <div className="percentage-stats">
              <div className="percentage-box">
                <span className="percentage-label">Invited:</span>
                <div className="percentage-grid">
                  <span className="percentage-item">{inviteStats.total ? Math.round(((registeredCount || 0) / inviteStats.total) * 100) : 0}% Registered</span>
                  <span className="percentage-item">{inviteStats.total ? Math.round(((pendingCount || 0) / inviteStats.total) * 100) : 0}% Pending</span>
                </div>
              </div>
              {!isRegistryAdmin && (
                <div className="percentage-box">
                  <span className="percentage-label">Registered:</span>
                  <div className="percentage-grid">
                    <span className="percentage-item going">{registeredStats.total ? Math.round(((registeredStats.going || 0) / registeredStats.total) * 100) : 0}% Going</span>
                    <span className="percentage-item maybe">{registeredStats.total ? Math.round(((registeredStats.maybe || 0) / registeredStats.total) * 100) : 0}% Maybe</span>
                    <span className="percentage-item not-going full-width">{registeredStats.total ? Math.round(((registeredStats.not_going || 0) / registeredStats.total) * 100) : 0}% Not Going</span>
                  </div>
                </div>
              )}
            </div>

            {/* Batch Rep Results - System Admin Only */}
            {isSystemAdmin && (
              <div style={{
                marginBottom: '24px',
                background: 'var(--color-bg-card)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => setBatchRepOpen(!batchRepOpen)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-hover)' }}>
                      🗳️ Batch Positions Results
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      background: getDaysUntilBatchRepDeadline() > 0 ? 'rgba(39, 174, 96, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                      color: getDaysUntilBatchRepDeadline() > 0 ? 'var(--color-status-positive)' : 'var(--color-status-negative)'
                    }}>
                      {getDaysUntilBatchRepDeadline() > 0 ? `Active · ${getDaysUntilBatchRepDeadline()} day${getDaysUntilBatchRepDeadline() !== 1 ? 's' : ''} left` : 'Closed'}
                    </span>
                  </div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                    {batchRepOpen ? '▲' : '▼'}
                  </span>
                </button>

                {batchRepOpen && (
                  <div style={{ padding: '0 20px 20px' }}>
                    {batchRepLoading ? (
                      <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{['Hulat!', 'Dali lang gid ha?', 'Wait lang...'][Math.floor(Math.random() * 3)]}</p>
                    ) : batchRepResults ? (
                      <>
                        {batchRepLastUpdated && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                            Last updated: {formatPHT(batchRepLastUpdated)}
                            <button
                              onClick={fetchBatchRepResults}
                              style={{
                                marginLeft: '8px',
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-hover)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                textDecoration: 'underline'
                              }}
                            >
                              Refresh
                            </button>
                          </p>
                        )}

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '12px',
                          marginBottom: '24px'
                        }}>
                          {[
                            { label: 'AA Rep Confirms', value: batchRepResults.aa_rep_confirms },
                            { label: 'Batch Rep Confirms', value: batchRepResults.batch_rep_confirms },
                            { label: 'Willing to Serve', value: batchRepResults.willing_to_serve_unique }
                          ].map((stat, i) => (
                            <div key={i} style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: '8px',
                              padding: '12px',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-hover)' }}>
                                {stat.value}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {stat.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Position 1 · Alumni Association Representative */}
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                            Position 1 · Alumni Association Representative
                          </h4>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Bianca Jison</span>
                                <span style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(207, 181, 59, 0.15)',
                                  color: 'var(--color-hover)'
                                }}>
                                  Committee Nominee
                                </span>
                              </div>
                              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                {batchRepResults.confirmationsPos1} ({batchRepResults.confirmationPos1Pct}%)
                              </span>
                            </div>
                            <div style={{
                              height: '8px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${batchRepResults.confirmationPos1Pct}%`,
                                background: '#006633',
                                borderRadius: '4px'
                              }} />
                            </div>
                          </div>
                          {/* Position 1 Alternative Nominations */}
                          {batchRepResults.nominees.filter(n => n.position === 1).map((nominee, i) => (
                            <div key={i} style={{ marginTop: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>{nominee.name}</span>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: nominee.willing === true
                                      ? 'rgba(39, 174, 96, 0.15)'
                                      : nominee.willing === false
                                        ? 'rgba(231, 76, 60, 0.15)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                    color: nominee.willing === true
                                      ? 'var(--color-status-positive)'
                                      : nominee.willing === false
                                        ? 'var(--color-status-negative)'
                                        : 'var(--color-text-secondary)'
                                  }}>
                                    {nominee.willing === true ? '✓ Willing' : nominee.willing === false ? '✕ Not willing' : '? Unknown'}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                  {nominee.count} ({nominee.pct}%)
                                </span>
                              </div>
                              <div style={{
                                height: '8px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${nominee.pct}%`,
                                  background: '#006633',
                                  borderRadius: '4px'
                                }} />
                              </div>
                              <div style={{
                                display: 'flex',
                                gap: '16px',
                                marginTop: '8px',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-secondary)'
                              }}>
                                <span><strong>Status:</strong> {nominee.registered ? 'Registered' : 'Not registered'}</span>
                                <span><strong>City:</strong> {nominee.city || '—'}</span>
                                <span><strong>Country:</strong> {nominee.country || '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Position 2 · Batch Representative */}
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                            Position 2 · Batch Representative
                          </h4>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Felie Magbanua</span>
                                <span style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(207, 181, 59, 0.15)',
                                  color: 'var(--color-hover)'
                                }}>
                                  Committee Nominee
                                </span>
                              </div>
                              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                {batchRepResults.confirmationsPos2} ({batchRepResults.confirmationPos2Pct}%)
                              </span>
                            </div>
                            <div style={{
                              height: '8px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${batchRepResults.confirmationPos2Pct}%`,
                                background: '#006633',
                                borderRadius: '4px'
                              }} />
                            </div>
                          </div>
                          {/* Position 2 Alternative Nominations */}
                          {batchRepResults.nominees.filter(n => n.position === 2).map((nominee, i) => (
                            <div key={i} style={{ marginTop: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>{nominee.name}</span>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: nominee.willing === true
                                      ? 'rgba(39, 174, 96, 0.15)'
                                      : nominee.willing === false
                                        ? 'rgba(231, 76, 60, 0.15)'
                                        : 'rgba(255, 255, 255, 0.1)',
                                    color: nominee.willing === true
                                      ? 'var(--color-status-positive)'
                                      : nominee.willing === false
                                        ? 'var(--color-status-negative)'
                                        : 'var(--color-text-secondary)'
                                  }}>
                                    {nominee.willing === true ? '✓ Willing' : nominee.willing === false ? '✕ Not willing' : '? Unknown'}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                                  {nominee.count} ({nominee.pct}%)
                                </span>
                              </div>
                              <div style={{
                                height: '8px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${nominee.pct}%`,
                                  background: '#006633',
                                  borderRadius: '4px'
                                }} />
                              </div>
                              <div style={{
                                display: 'flex',
                                gap: '16px',
                                marginTop: '8px',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-secondary)'
                              }}>
                                <span><strong>Status:</strong> {nominee.registered ? 'Registered' : 'Not registered'}</span>
                                <span><strong>City:</strong> {nominee.city || '—'}</span>
                                <span><strong>Country:</strong> {nominee.country || '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                            Willingness Summary
                          </h4>

                          {/* AA Rep Willingness */}
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              AA Rep
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>Yes</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                  {batchRepResults.willingnessPos1Yes}
                                </span>
                              </div>
                              <div style={{
                                height: '6px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '3px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: batchRepResults.willingnessTotal > 0 ? `${(batchRepResults.willingnessPos1Yes / batchRepResults.willingnessTotal) * 100}%` : '0%',
                                  background: '#006633',
                                  borderRadius: '3px'
                                }} />
                              </div>
                            </div>
                          </div>

                          {/* Batch Rep Willingness */}
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Batch Rep
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>Yes</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                  {batchRepResults.willingnessPos2Yes}
                                </span>
                              </div>
                              <div style={{
                                height: '6px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '3px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: batchRepResults.willingnessTotal > 0 ? `${(batchRepResults.willingnessPos2Yes / batchRepResults.willingnessTotal) * 100}%` : '0%',
                                  background: '#006633',
                                  borderRadius: '3px'
                                }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: 'var(--color-text-secondary)' }}>Failed to load results.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'invites' ? 'active' : ''}`}
                onClick={() => setActiveTab('invites')}
              >
                Invites ({inviteStats.total})
              </button>
              <button
                className={`tab ${activeTab === 'registered' ? 'active' : ''}`}
                onClick={() => setActiveTab('registered')}
              >
                Registered ({registeredStats.total || 0})
              </button>
              <button
                className={`tab ${activeTab === 'masterlist' ? 'active' : ''}`}
                onClick={() => setActiveTab('masterlist')}
              >
                Master List ({masterListStats.total || 0})
              </button>
            </div>

            {/* Invites Tab */}
            {activeTab === 'invites' && (
              <InvitesTab
                                isSuperAdmin={isSuperAdmin}
                permissions={permissions}
                onRefresh={fetchDashboard}
                onStatsUpdate={setInviteStats}
                onConfirm={({ message, onConfirm }) => {
                  setConfirmModal({
                    show: true,
                    message,
                    onConfirm: async () => {
                      await onConfirm();
                      setConfirmModal({ show: false, message: '', onConfirm: null });
                    }
                  });
                }}
              />
            )}

            {/* Registered Tab */}
            {activeTab === 'registered' && (
              <RegisteredTab
                isSuperAdmin={isSuperAdmin}
                isRegistryAdmin={isRegistryAdmin}
                permissions={permissions}
                onStatsUpdate={setRegisteredStats}
              />
            )}

            {/* Master List Tab */}
            {activeTab === 'masterlist' && (
              <MasterListTab
                isSuperAdmin={isSuperAdmin}
                isSystemAdmin={isSystemAdmin}
                isRegistryAdmin={isRegistryAdmin}
                permissions={permissions}
                onShowAdminRoleError={() => setShowAdminRoleError(true)}
                onRefreshReady={setMasterListRefresh}
                onStatsUpdate={setMasterListStats}
              />
            )}
          </>
        )}

        {/* ANNOUNCEMENTS MODE */}
        {dashboardMode === 'announcements' && (
          <AnnouncementComposer
            registeredCount={registeredStats.total || 0}
            goingCount={registeredStats.going || 0}
            maybeCount={registeredStats.maybe || 0}
            notGoingCount={registeredStats.not_going || 0}
            fullAdminsCount={data?.stats?.full_admins_count || 0}
            registryAdminsCount={data?.stats?.registry_admins_count || 0}
            graduatesCount={masterListStats.registered_graduates || 0}
            user={user}
            canSend={isSuperAdmin || permissions?.announcements_send}
          />
        )}

        {/* ACCOUNTING MODE */}
        {dashboardMode === 'accounting' && (
          <AccountingDashboard
                        canEdit={isSuperAdmin || permissions?.accounting_edit}
            canExport={isSuperAdmin || permissions?.accounting_export}
            onPaymentLinked={() => masterListRefresh?.()}
          />
        )}

        {/* MINUTES MODE */}
        {dashboardMode === 'minutes' && (
          <MeetingMinutes
                        canEdit={isSuperAdmin || permissions?.minutes_edit}
            initialMeetingId={selectedMeetingIdFromUrl}
            onMeetingSelected={() => setSelectedMeetingIdFromUrl(null)}
          />
        )}

        {/* MESSAGES MODE */}
        {dashboardMode === 'messages' && (
          <AdminMessages onUnreadCountChange={fetchAdminUnreadCount} />
        )}

        {/* STRATEGIC PLANNING MODE */}
        {dashboardMode === 'strategic' && (
          <StrategicPlanning />
        )}

        {/* MEDIA MODE */}
        {dashboardMode === 'media' && (isSuperAdmin || permissions?.can_approve_media) && (
          <MediaTab onPendingCountChange={setMediaPendingCount} isSuperAdmin={isSuperAdmin} />
        )}

        {/* PERMISSIONS MODE - Super Admin Only */}
        {dashboardMode === 'permissions' && isSuperAdmin && (
          <PermissionsManager />
        )}

        {/* EMAIL LOG MODE - System Admin (id=1) Only */}
        {dashboardMode === 'emailLog' && isSystemAdmin && (
          <div className="invite-section">
            <h3>Email Log</h3>
            <EmailLog />
          </div>
        )}

        {/* SYSTEM TEST MODE - Super Admin (uslsis.batch2003@gmail.com) Only */}
        {dashboardMode === 'systemTest' && user?.email?.toLowerCase() === 'uslsis.batch2003@gmail.com' && (
          <>
            {/* Batch Rep Response Rate Card - user.id === 1 only */}
            {user?.id === 1 && batchRepResponseStats && (
              <div style={{
                marginBottom: '24px',
                padding: '20px',
                background: 'var(--color-bg-card)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Batch rep response rate
                  </h3>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: '#0d2b1a',
                    color: '#CFB53B'
                  }}>
                    Admin only
                  </span>
                </div>

                {/* Section columns */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '16px',
                  marginBottom: '20px'
                }}>
                  {batchRepResponseStats.sections.map((section) => {
                    const pct = section.total > 0 ? Math.round((section.responded / section.total) * 100) : 0;
                    return (
                      <div key={section.section} style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                          marginBottom: '8px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {section.section}
                        </div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)'
                        }}>
                          {section.responded}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary)',
                          marginBottom: '8px'
                        }}>
                          of {section.total}
                        </div>
                        <div style={{
                          height: '4px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          marginBottom: '6px'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: '#006633',
                            borderRadius: '2px'
                          }} />
                        </div>
                        <div style={{
                          fontSize: '0.7rem',
                          color: 'var(--color-text-secondary)'
                        }}>
                          {pct}%
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Divider */}
                <div style={{
                  height: '1px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  margin: '16px 0'
                }} />

                {/* Total row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)'
                  }}>
                    Total respondents
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontSize: '0.85rem',
                      color: 'var(--color-text-secondary)'
                    }}>
                      {batchRepResponseStats.totalResponded} of {batchRepResponseStats.registeredGradsCount} grads
                    </span>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)'
                    }}>
                      {batchRepResponseStats.registeredGradsCount > 0
                        ? Math.round((batchRepResponseStats.totalResponded / batchRepResponseStats.registeredGradsCount) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
            <SystemTest />
          </>
        )}
      </div>

      {/* Confirm Modal */}
      {
        confirmModal.show && (
          <div className="modal-overlay">
            <div className="modal-content">
              <p>{confirmModal.message}</p>
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
        )
      }
      <Footer />
      {/* Admin role error toast */}
      <AdminRoleErrorToast
        show={showAdminRoleError}
        onClose={() => setShowAdminRoleError(false)}
      />
    </div>
  );
}