import React, { useState, useEffect } from 'react';

export default function PermissionsManager({ token }) {
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [permissions, setPermissions] = useState({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

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
      const res = await fetch('http://localhost:5000/api/permissions/admins', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAdmins(data);
      
      if (data.length > 0) {
        setSelectedAdminId(data[0].id.toString());
        setPermissions(data[0].permissions);
        setIsSuperAdmin(data[0].is_super_admin);
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
      setPermissions(admin.permissions);
      setIsSuperAdmin(admin.is_super_admin);
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
      const res = await fetch(`http://localhost:5000/api/permissions/admins/${selectedAdminId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ permissions, is_super_admin: isSuperAdmin })
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
              {admin.first_name} {admin.last_name} {admin.is_super_admin ? '(Super Admin)' : ''}
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