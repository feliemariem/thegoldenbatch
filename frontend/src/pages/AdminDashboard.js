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
import AdminRoleErrorToast from "../components/AdminRoleErrorToast";
import AdminMessages from '../components/AdminMessages';
import Footer from '../components/Footer';
import { apiGet } from '../api';

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Parse URL parameters for tab navigation (e.g., /admin?tab=meetings&meetingId=5)
  const urlParams = new URLSearchParams(location.search);
  const urlTab = urlParams.get('tab');
  const urlMeetingId = urlParams.get('meetingId');

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('adminActiveTab') || 'invites';
  });
  const [dashboardMode, setDashboardMode] = useState(() => {
    // If URL has tab=meetings, start in minutes mode
    if (urlTab === 'meetings') return 'minutes';
    return 'registry';
  });
  // Store the meeting ID from URL before it gets cleared
  const [selectedMeetingIdFromUrl, setSelectedMeetingIdFromUrl] = useState(() => {
    return urlMeetingId ? parseInt(urlMeetingId) : null;
  });
  const [permissions, setPermissions] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [data, setData] = useState(null);
  const [inviteStats, setInviteStats] = useState({ total: 0, registered: 0, pending: 0 });
  const [registeredStats, setRegisteredStats] = useState({ total: 0, going: 0, maybe: 0, not_going: 0, no_response: 0 });
  const [loading, setLoading] = useState(true);
  const [showAdminRoleError, setShowAdminRoleError] = useState(false);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);


  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });

  const [showGuide, setShowGuide] = useState(false);

  // Callback ref for refreshing master list from AccountingDashboard
  const [masterListRefresh, setMasterListRefresh] = useState(null);

  // Fetch all dashboard stats on mount (independent of tab selection)
  const fetchDashboardStats = async () => {
    try {
      // Fetch invite stats and registered stats in parallel
      const [invitesRes, usersRes] = await Promise.all([
        apiGet('/api/invites?page=1&limit=1'),
        apiGet('/api/admin/users?page=1&limit=1')
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
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  };

  useEffect(() => {
    fetchPermissions();
    fetchDashboard();
    fetchAdminUnreadCount();
    fetchDashboardStats();
  }, [token]);

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

  // Handle URL parameter changes for deep linking (e.g., /admin?tab=meetings&meetingId=5)
  useEffect(() => {
    if (urlTab === 'meetings') {
      setDashboardMode('minutes');
      // Clear URL params after processing to keep URL clean
      navigate('/admin', { replace: true });
    }
  }, [urlTab, urlMeetingId, navigate]);

  // Save active tab to localStorage
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

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
          <p>Loading dashboard...</p>
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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="btn-guide"
            >
              {showGuide ? 'Hide' : '📖 Guide'}
            </button>
          </div>
        </div>

        {showGuide && (
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
        <div className="dashboard-mode-tabs">

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
              Meetings
            </button>
          )}
          {(isSuperAdmin || permissions?.messages_view) && (
            <button
              onClick={() => setDashboardMode('messages')}
              style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.75rem',
                background: dashboardMode === 'messages' ? '#CFB53B' : 'transparent',
                color: dashboardMode === 'messages' ? '#1a1a2e' : '#999',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Messages
              {adminUnreadCount > 0 && (
                <span
                  className={dashboardMode === 'messages' ? '' : 'unread-badge'}
                  style={dashboardMode === 'messages' ? {
                    background: '#1a1a2e',
                    color: '#CFB53B',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    minWidth: '16px',
                    textAlign: 'center'
                  } : {
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    minWidth: '16px',
                    textAlign: 'center'
                  }}
                >
                  {adminUnreadCount}
                </span>
              )}
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
          {user?.email?.toLowerCase() === 'uslsis.batch2003@gmail.com' && (
            <button
              onClick={() => setDashboardMode('systemTest')}
              style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.75rem',
                background: dashboardMode === 'systemTest' ? '#CFB53B' : 'transparent',
                color: dashboardMode === 'systemTest' ? '#1a1a2e' : '#999',
                whiteSpace: 'nowrap'
              }}
            >
              System Test
            </button>
          )}
        </div>

        {/* REGISTRY MODE */}
        {dashboardMode === 'registry' && (
          <>
            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{inviteStats.total}</div>
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
            </div>

            {/* Percentage Stats */}
            <div className="percentage-stats">
              <div className="percentage-box">
                <span className="percentage-label">Invited:</span>
                <div className="percentage-grid">
                  <span className="percentage-item">{inviteStats.total ? Math.round((registeredCount / inviteStats.total) * 100) : 0}% Registered</span>
                  <span className="percentage-item">{inviteStats.total ? Math.round((pendingCount / inviteStats.total) * 100) : 0}% Pending</span>
                </div>
              </div>
              <div className="percentage-box">
                <span className="percentage-label">Registered:</span>
                <div className="percentage-grid">
                  <span className="percentage-item going">{registeredStats.total ? Math.round(((registeredStats.going || 0) / registeredStats.total) * 100) : 0}% Going</span>
                  <span className="percentage-item maybe">{registeredStats.total ? Math.round(((registeredStats.maybe || 0) / registeredStats.total) * 100) : 0}% Maybe</span>
                  <span className="percentage-item not-going full-width">{registeredStats.total ? Math.round(((registeredStats.not_going || 0) / registeredStats.total) * 100) : 0}% Not Going</span>
                </div>
              </div>
            </div>

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
                Master List
              </button>
            </div>

            {/* Invites Tab */}
            {activeTab === 'invites' && (
              <InvitesTab
                token={token}
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
                token={token}
                isSuperAdmin={isSuperAdmin}
                permissions={permissions}
                onStatsUpdate={setRegisteredStats}
              />
            )}

            {/* Master List Tab */}
            {activeTab === 'masterlist' && (
              <MasterListTab
                token={token}
                isSuperAdmin={isSuperAdmin}
                permissions={permissions}
                onShowAdminRoleError={() => setShowAdminRoleError(true)}
                onRefreshReady={setMasterListRefresh}
              />
            )}
          </>
        )}

        {/* ANNOUNCEMENTS MODE */}
        {dashboardMode === 'announcements' && (
          <AnnouncementComposer
            token={token}
            registeredCount={registeredStats.total || 0}
            goingCount={registeredStats.going || 0}
            maybeCount={registeredStats.maybe || 0}
            notGoingCount={registeredStats.not_going || 0}
            adminsCount={data?.stats?.admins_count || 0}
            canSend={isSuperAdmin || permissions?.announcements_send}
          />
        )}

        {/* ACCOUNTING MODE */}
        {dashboardMode === 'accounting' && (
          <AccountingDashboard
            token={token}
            canEdit={isSuperAdmin || permissions?.accounting_edit}
            canExport={isSuperAdmin || permissions?.accounting_export}
            onPaymentLinked={() => masterListRefresh?.()}
          />
        )}

        {/* MINUTES MODE */}
        {dashboardMode === 'minutes' && (
          <MeetingMinutes
            token={token}
            canEdit={isSuperAdmin || permissions?.minutes_edit}
            initialMeetingId={selectedMeetingIdFromUrl}
            onMeetingSelected={() => setSelectedMeetingIdFromUrl(null)}
          />
        )}

        {/* MESSAGES MODE */}
        {dashboardMode === 'messages' && (
          <AdminMessages token={token} onUnreadCountChange={fetchAdminUnreadCount} />
        )}

        {/* PERMISSIONS MODE - Super Admin Only */}
        {dashboardMode === 'permissions' && isSuperAdmin && (
          <PermissionsManager token={token} />
        )}

        {/* SYSTEM TEST MODE - Super Admin (uslsis.batch2003@gmail.com) Only */}
        {dashboardMode === 'systemTest' && user?.email?.toLowerCase() === 'uslsis.batch2003@gmail.com' && (
          <SystemTest token={token} />
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