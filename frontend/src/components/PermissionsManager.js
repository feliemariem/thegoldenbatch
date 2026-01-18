import React, { useState, useEffect } from 'react';

export default function PermissionsManager({ token }) {
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [permissions, setPermissions] = useState({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  // Committee fields
  const [roleTitle, setRoleTitle] = useState('');
  const [subCommittees, setSubCommittees] = useState('');
  const [isCoreLeader, setIsCoreLeader] = useState(false);

  const allPermissions = [
    'invites_add',
    'invites_link',
    'invites_upload',
    'invites_export',
    'registered_export',
    'masterlist_edit',
    'masterlist_upload',
    'masterlist_export',
    'announcements_view',
    'announcements_send',
    'accounting_view',
    'accounting_edit',
    'accounting_export',
    'minutes_view',
    'minutes_edit'
  ];

  const permissionLabels = {
    invites_add: 'Add/Edit Invites',
    invites_link: 'Link Invites to Master List',
    invites_upload: 'Upload CSV (Invites)',
    invites_export: 'Export CSV (Invites)',
    registered_export: 'Export CSV (Registered)',
    masterlist_edit: 'Edit Master List entries',
    masterlist_upload: 'Upload CSV (Master List)',
    masterlist_export: 'Export CSV (Master List)',
    announcements_view: 'Show Announcements tab',
    announcements_send: 'Send Announcements',
    accounting_view: 'Show Accounting tab',
    accounting_edit: 'Add/Edit Donations',
    accounting_export: 'Export CSV (Donations)',
    minutes_view: 'Show Minutes tab',
    minutes_edit: 'Create/Edit Minutes'
  };

  useEffect(() => {
    fetchAdmins();
  }, [token]);

  const fetchAdmins = async () => {
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/permissions/admins', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      // Ensure adminList is always an array
      const adminList = Array.isArray(data) ? data : (Array.isArray(data?.admins) ? data.admins : []);
      setAdmins(adminList);

      if (adminList.length > 0) {
        setSelectedAdminId(adminList[0].id.toString());

        const normalizedPermissions = Array.isArray(adminList[0].permissions)
          ? adminList[0].permissions.reduce((acc, perm) => ({ ...acc, [perm]: true }), {})
          : (adminList[0].permissions || {});

        setPermissions(normalizedPermissions);
        setIsSuperAdmin(adminList[0].is_super_admin);

        // Set committee fields
        setRoleTitle(adminList[0].role_title || '');
        setSubCommittees(adminList[0].sub_committees || '');
        setIsCoreLeader(adminList[0].is_core_leader || false);
      }

    } catch (err) {
      console.error('Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminChange = (e) => {
    const id = e.target.value;
    setSelectedAdminId(id);
    setResult(null);

    const admin = admins.find(a => a.id.toString() === id);
    if (admin) {
      const normalizedPermissions = Array.isArray(admin.permissions)
        ? admin.permissions.reduce((acc, perm) => ({ ...acc, [perm]: true }), {})
        : (admin.permissions || {});

      setPermissions(normalizedPermissions);
      setIsSuperAdmin(admin.is_super_admin);

      // Set committee fields
      setRoleTitle(admin.role_title || '');
      setSubCommittees(admin.sub_committees || '');
      setIsCoreLeader(admin.is_core_leader || false);
    }

  };

  const handlePermissionChange = (permission) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }));
  };

  const handleCheckAll = () => {
    const allChecked = allPermissions.every(p => permissions[p]);
    const newPerms = {};
    allPermissions.forEach(p => newPerms[p] = !allChecked);
    setPermissions(newPerms);
    setIsSuperAdmin(!allChecked);
  };

  const handleSuperAdminToggle = () => {
    const newValue = !isSuperAdmin;
    setIsSuperAdmin(newValue);

    // If making super admin, check all permissions
    if (newValue) {
      const newPerms = {};
      allPermissions.forEach(p => newPerms[p] = true);
      setPermissions(newPerms);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setResult(null);

    try {
      const res = await fetch(`https://the-golden-batch-api.onrender.com/api/permissions/admins/${selectedAdminId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          permissions,
          is_super_admin: isSuperAdmin,
          role_title: roleTitle,
          sub_committees: subCommittees,
          is_core_leader: isCoreLeader
        })
      });

      if (res.ok) {
        setResult({ success: true, message: 'Permissions saved!' });
        fetchAdmins(); // Refresh list
      } else {
        const data = await res.json();
        setResult({ success: false, message: data.error || 'Failed to save' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Failed to save permissions' });
    } finally {
      setSaving(false);
    }
  };

  const allChecked = allPermissions.every(p => permissions[p]);

  if (loading) {
    return <p className="perm-muted">Loading permissions...</p>;
  }

  if (admins.length === 0) {
    return (
      <div>
        <h3>Permissions Manager</h3>
        <p className="perm-muted">No admins found. Flag someone as Admin in Master List first.</p>
      </div>
    );
  }

  const selectedAdmin = admins.find(a => a.id.toString() === selectedAdminId);

  return (
    <div>
      <h3>Permissions Manager</h3>
      <p className="perm-muted" style={{ marginBottom: '24px' }}>Control what each admin can access and edit.</p>

      {/* Admin Selector */}
      <div className="form-group" style={{ marginBottom: '24px' }}>
        <label>Select Admin:</label>
        <select
          value={selectedAdminId}
          onChange={handleAdminChange}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '1rem'
          }}
        >
          {admins.map(admin => (
            <option key={admin.id} value={admin.id}>
              {admin.current_name || `${admin.first_name} ${admin.last_name}`.trim()} {admin.is_super_admin ? '(Super Admin)' : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedAdmin && (
        <div className="perm-container">
          {/* Super Admin Toggle */}
          <label className={`perm-super-admin-row ${isSuperAdmin ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={isSuperAdmin}
              onChange={handleSuperAdminToggle}
              style={{ width: '18px', height: '18px' }}
            />
            <span className="perm-super-admin-label">
              SUPER ADMIN (Full Access)
            </span>
          </label>

          {!isSuperAdmin && (
            <>
              {/* Check All */}
              <label className="perm-check-all-row">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={handleCheckAll}
                  style={{ width: '18px', height: '18px' }}
                />
                <span className="perm-check-all-label">CHECK ALL</span>
              </label>

              {/* Registry Permissions */}
              <div style={{ marginBottom: '20px' }}>
                <h4 className="perm-section-title">REGISTRY</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '12px' }}>
                  {['invites_add', 'invites_link', 'invites_upload', 'invites_export', 'registered_export', 'masterlist_edit', 'masterlist_upload', 'masterlist_export'].map(perm => (
                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={permissions[perm] || false}
                        onChange={() => handlePermissionChange(perm)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span className="perm-label">{permissionLabels[perm]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Announcements Permissions */}
              <div style={{ marginBottom: '20px' }}>
                <h4 className="perm-section-title">ANNOUNCEMENTS</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '12px' }}>
                  {['announcements_view', 'announcements_send'].map(perm => (
                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={permissions[perm] || false}
                        onChange={() => handlePermissionChange(perm)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span className="perm-label">{permissionLabels[perm]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Accounting Permissions */}
              <div style={{ marginBottom: '20px' }}>
                <h4 className="perm-section-title">ACCOUNTING</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '12px' }}>
                  {['accounting_view', 'accounting_edit', 'accounting_export'].map(perm => (
                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={permissions[perm] || false}
                        onChange={() => handlePermissionChange(perm)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span className="perm-label">{permissionLabels[perm]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Minutes Permissions */}
              <div style={{ marginBottom: '20px' }}>
                <h4 className="perm-section-title">MINUTES</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '12px' }}>
                  {['minutes_view', 'minutes_edit'].map(perm => (
                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={permissions[perm] || false}
                        onChange={() => handlePermissionChange(perm)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span className="perm-label">{permissionLabels[perm]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Committee Profile Section */}
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #ddd' }}>
            <h4 className="perm-section-title">COMMITTEE PROFILE</h4>
            <p className="perm-muted" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
              These fields appear on the Committee page. Leave role title blank to hide from committee page.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '12px' }}>
              {/* Role Title */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Role Title
                </label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g., Treasurer, Events Coordinator"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              {/* Sub-Committees */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Sub-Committees
                </label>
                <input
                  type="text"
                  value={subCommittees}
                  onChange={(e) => setSubCommittees(e.target.value)}
                  placeholder="e.g., Financial Controller, Fundraising"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontSize: '0.95rem'
                  }}
                />
                <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px', display: 'block' }}>
                  Comma-separated list of sub-committees
                </span>
              </div>

              {/* Core Leader Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isCoreLeader}
                  onChange={(e) => setIsCoreLeader(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: '500' }}>Core Leader</span>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  (displays in top row on Committee page)
                </span>
              </label>
            </div>
          </div>

          {result && (
            <div className={`invite-result ${result.success ? 'success' : 'error'}`} style={{ marginBottom: '16px' }}>
              <p>{result.message}</p>
            </div>
          )}

          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={saving}
            style={{ width: 'auto', padding: '12px 32px' }}
          >
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      )}
    </div>
  );
}