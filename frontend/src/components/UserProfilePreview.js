import React, { useState, useEffect } from 'react';
import { apiGet } from '../api';

// Batch Rep Phase 1 allowed emails (must match ProfileNew.js)
const BATCH_REP_PHASE = 3;
const BATCH_REP_PHASE1_EMAILS = [
  'felie@fnrcore.com',
  'emvjanklow@gmail.com',
  'nqa.attynea@gmail.com',
  'jmrnv07@gmail.com',
  'chayamalonso@gmail.com',
  'eckkee03@gmail.com',
  'coycoy.cordova@gmail.com',
  'johannajison@gmail.com',
  'pngolez@gmail.com',
  'narcisojavelosa@yahoo.com',
  'willkramer27@gmail.com'
];

const checkBatchRepAccess = (email, isAdmin, isGrad) => {
  const userEmail = email?.toLowerCase();
  switch (BATCH_REP_PHASE) {
    case 1:
      return BATCH_REP_PHASE1_EMAILS.includes(userEmail);
    case 2:
      return isAdmin === true;
    case 3:
      return isGrad === true;
    default:
      return false;
  }
};

export default function UserProfilePreview() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiGet('/api/admin/users?limit=1000');
        const data = await res.json();
        const sorted = (data.users || []).sort((a, b) => {
          const lastNameCompare = (a.last_name || '').localeCompare(b.last_name || '');
          if (lastNameCompare !== 0) return lastNameCompare;
          return (a.first_name || '').localeCompare(b.first_name || '');
        });
        setUsers(sorted);
      } catch (err) {
        console.error('Failed to fetch users');
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchProfile(selectedUserId);
    } else {
      setProfile(null);
    }
  }, [selectedUserId]);

  const fetchProfile = async (userId) => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiGet(`/api/admin/users/${userId}/profile`);

      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Derive access context from profile
  const getAccessContext = (p) => {
    if (!p) return null;

    const isGrad = p.is_graduate;
    const isAdmin = p.isAdmin;
    const isSuperAdmin = p.is_super_admin;
    const hasNonRegistryPerms = p.hasNonRegistryPermissions;
    const goesToNewProfile = isSuperAdmin || (isAdmin && hasNonRegistryPerms);
    const hasBatchRepAccess = checkBatchRepAccess(p.email, isAdmin, isGrad);

    // Registry Admin: isAdmin but no non-registry permissions
    const isRegistryAdmin = isAdmin && !hasNonRegistryPerms && !isSuperAdmin;

    return {
      profilePage: goesToNewProfile ? 'New Profile (ProfileNew.js)' : 'Old Profile (Profile.js)',
      navLinks: {
        home: !isRegistryAdmin,
        profile: true,
        inbox: !isRegistryAdmin,
        batchmates: !isRegistryAdmin,
        committee: !isRegistryAdmin,
        funds: !isRegistryAdmin && isGrad,
        admin: isAdmin
      },
      features: {
        contributionCard: !isRegistryAdmin && isGrad,
        committeeMemo: isAdmin,
        batchRepModal: !isRegistryAdmin && hasBatchRepAccess,
        myTasks: isAdmin,
        alumniCardNudge: !isRegistryAdmin && isGrad && !p.has_alumni_card
      }
    };
  };

  const CheckItem = ({ label, enabled }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    }}>
      <span style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        background: enabled ? 'rgba(40, 167, 69, 0.15)' : 'rgba(108, 117, 125, 0.1)',
        color: enabled ? '#28a745' : '#666'
      }}>
        {enabled ? '✓' : '—'}
      </span>
      <span style={{ color: enabled ? 'var(--text-primary)' : '#666' }}>
        {label}
      </span>
    </div>
  );

  const access = getAccessContext(profile);

  return (
    <div className="user-profile-preview">
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        background: 'rgba(0, 102, 51, 0.08)',
        border: '1px solid rgba(0, 102, 51, 0.2)',
        borderRadius: '12px'
      }}>
        <h3 style={{ color: '#006633', margin: '0 0 8px 0', fontSize: '1rem' }}>
          User Access Preview
        </h3>
        <p style={{ color: '#666', margin: '0 0 16px 0', fontSize: '0.85rem' }}>
          See routing and feature access for any registered user.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{
              flex: '1',
              minWidth: '250px',
              padding: '12px 16px',
              fontSize: '0.95rem',
              borderRadius: '8px',
              border: '1px solid rgba(0, 102, 51, 0.3)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value="">-- Select a user --</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.last_name}, {user.first_name} ({user.email})
              </option>
            ))}
          </select>

          {selectedUserId && (
            <button
              onClick={() => setSelectedUserId('')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: '1px solid rgba(220, 53, 69, 0.3)',
                borderRadius: '8px',
                color: '#dc3545',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Loading...
        </div>
      )}

      {error && (
        <div style={{
          padding: '16px',
          background: 'rgba(220, 53, 69, 0.1)',
          border: '1px solid rgba(220, 53, 69, 0.3)',
          borderRadius: '8px',
          color: '#dc3545',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {profile && access && !loading && (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          {/* User Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              {profile.first_name} {profile.last_name}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
              {profile.email}
            </div>
          </div>

          {/* Profile Page Routing */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              fontSize: '0.75rem',
              color: '#888',
              textTransform: 'uppercase',
              marginBottom: '8px',
              letterSpacing: '0.5px'
            }}>
              Profile Page
            </div>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(207, 181, 59, 0.1)',
              border: '1px solid rgba(207, 181, 59, 0.2)',
              borderRadius: '8px',
              color: '#CFB53B',
              fontWeight: '600'
            }}>
              {access.profilePage}
            </div>
          </div>

          {/* Nav Links */}
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              fontSize: '0.75rem',
              color: '#888',
              textTransform: 'uppercase',
              marginBottom: '12px',
              letterSpacing: '0.5px'
            }}>
              Nav Links Visible
            </div>
            <CheckItem label="Home" enabled={access.navLinks.home} />
            <CheckItem label="Profile" enabled={access.navLinks.profile} />
            <CheckItem label="Inbox" enabled={access.navLinks.inbox} />
            <CheckItem label="Batchmates" enabled={access.navLinks.batchmates} />
            <CheckItem label="Committee" enabled={access.navLinks.committee} />
            <CheckItem label="Funds (graduates only)" enabled={access.navLinks.funds} />
            <CheckItem label="Admin Dashboard" enabled={access.navLinks.admin} />
          </div>

          {/* Profile Features */}
          <div style={{ padding: '20px' }}>
            <div style={{
              fontSize: '0.75rem',
              color: '#888',
              textTransform: 'uppercase',
              marginBottom: '12px',
              letterSpacing: '0.5px'
            }}>
              Profile Features
            </div>
            <CheckItem label="Contribution Card (graduates only)" enabled={access.features.contributionCard} />
            <CheckItem label="Committee Memo (admins only)" enabled={access.features.committeeMemo} />
            <CheckItem label={`Batch Rep Modal (Phase ${BATCH_REP_PHASE})`} enabled={access.features.batchRepModal} />
            <CheckItem label="My Tasks Section (admins only)" enabled={access.features.myTasks} />
            <CheckItem label="Alumni Card Nudge (grads without card)" enabled={access.features.alumniCardNudge} />
          </div>

          {/* User Type Tags */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '600',
              background: profile.is_graduate ? 'rgba(40, 167, 69, 0.15)' : 'rgba(108, 117, 125, 0.15)',
              color: profile.is_graduate ? '#28a745' : '#6c757d'
            }}>
              {profile.is_graduate ? 'Graduate' : 'Non-Graduate'}
            </span>

            {profile.isAdmin && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                background: 'rgba(207, 181, 59, 0.15)',
                color: '#CFB53B'
              }}>
                {profile.is_super_admin ? 'Super Admin' : profile.hasNonRegistryPermissions ? 'Full Admin' : 'Registry Admin'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
