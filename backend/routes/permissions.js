const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin, authenticateToken } = require('../middleware/auth');

// List of all permissions
const ALL_PERMISSIONS = [
  'invites_add',
  'invites_link',
  'invites_upload',
  'invites_export',
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

// Middleware to check if user is super admin
const requireSuperAdmin = async (req, res, next) => {
  try {
    // Query by email instead of ID, since users logging in via the users table
    // have a different ID than their corresponding entry in the admins table
    const result = await db.query(
      'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );

    if (!result.rows[0]?.is_super_admin) {
      return res.status(403).json({ error: 'Super Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all admins with their permissions (Super Admin only)
router.get('/admins', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    // JOIN with master_list to get current_name for display
    const adminsResult = await db.query(
      `SELECT a.id, a.email, a.first_name, a.last_name, a.is_super_admin,
              a.role_title, a.sub_committees, a.is_core_leader,
              m.current_name
       FROM admins a
       LEFT JOIN master_list m ON LOWER(a.email) = LOWER(m.email)
       ORDER BY COALESCE(m.current_name, a.first_name), a.last_name`
    );

    const admins = [];

    for (const admin of adminsResult.rows) {
      const permsResult = await db.query(
        'SELECT permission, enabled FROM permissions WHERE admin_id = $1',
        [admin.id]
      );

      const permissions = {};
      ALL_PERMISSIONS.forEach(p => permissions[p] = false);
      permsResult.rows.forEach(p => permissions[p.permission] = p.enabled);

      admins.push({
        ...admin,
        permissions
      });
    }

    res.json(admins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update permissions for an admin (Super Admin only)
router.put('/admins/:id', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, is_super_admin, role_title, sub_committees, is_core_leader } = req.body;

    // Build dynamic update for admin fields
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (typeof is_super_admin === 'boolean') {
      updateFields.push(`is_super_admin = $${paramIndex++}`);
      updateValues.push(is_super_admin);
    }

    if (role_title !== undefined) {
      updateFields.push(`role_title = $${paramIndex++}`);
      updateValues.push(role_title || null);
    }

    if (sub_committees !== undefined) {
      updateFields.push(`sub_committees = $${paramIndex++}`);
      updateValues.push(sub_committees || null);
    }

    if (typeof is_core_leader === 'boolean') {
      updateFields.push(`is_core_leader = $${paramIndex++}`);
      updateValues.push(is_core_leader);
    }

    // Update admin fields if any
    if (updateFields.length > 0) {
      updateValues.push(id);
      await db.query(
        `UPDATE admins SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );
    }

    // Update permissions
    if (permissions) {
      for (const [permission, enabled] of Object.entries(permissions)) {
        if (ALL_PERMISSIONS.includes(permission)) {
          await db.query(
            `INSERT INTO permissions (admin_id, permission, enabled)
             VALUES ($1, $2, $3)
             ON CONFLICT (admin_id, permission)
             DO UPDATE SET enabled = $3`,
            [id, permission, enabled]
          );
        }
      }
    }

    res.json({ message: 'Permissions updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user's permissions
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // First check if they're a super admin in admins table
    const superAdminCheck = await db.query(
      'SELECT id, is_super_admin FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );
    
    if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].is_super_admin) {
      // Super admin has all permissions
      const permissions = {};
      ALL_PERMISSIONS.forEach(p => permissions[p] = true);
      return res.json({ is_super_admin: true, permissions });
    }

    // Check if user is admin via master_list
    const masterListCheck = await db.query(
      'SELECT id, is_admin FROM master_list WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );

    if (masterListCheck.rows.length === 0 || !masterListCheck.rows[0].is_admin) {
      // Not an admin - return empty permissions
      const permissions = {};
      ALL_PERMISSIONS.forEach(p => permissions[p] = false);
      return res.json({ is_super_admin: false, permissions });
    }

    // Get specific permissions from admins table
    const adminResult = await db.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );

    if (adminResult.rows.length === 0) {
      // Admin in master_list but not in admins table - give read-only access
      const permissions = {};
      ALL_PERMISSIONS.forEach(p => permissions[p] = false);
      return res.json({ is_super_admin: false, permissions });
    }

    const adminId = adminResult.rows[0].id;
    const permsResult = await db.query(
      'SELECT permission, enabled FROM permissions WHERE admin_id = $1',
      [adminId]
    );

    const permissions = {};
    ALL_PERMISSIONS.forEach(p => permissions[p] = false);
    permsResult.rows.forEach(p => permissions[p.permission] = p.enabled);

    res.json({ is_super_admin: false, permissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;