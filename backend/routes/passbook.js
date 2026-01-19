const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// Get all passbook uploads (sorted by most recent first)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, a.first_name as uploader_name
       FROM passbook_uploads p
       LEFT JOIN admins a ON p.uploaded_by = a.id
       ORDER BY p.uploaded_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload a passbook screenshot (restricted to admins with accounting edit permission)
router.post('/', authenticateAdmin, upload.single('image'), async (req, res) => {
  try {
    // Check if user has accounting_edit permission
    const permResult = await db.query(
      `SELECT p.permissions, a.is_super_admin
       FROM admins a
       LEFT JOIN permissions p ON a.id = p.admin_id
       WHERE LOWER(a.email) = $1`,
      [req.user.email.toLowerCase()]
    );

    if (permResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin not found' });
    }

    const { permissions, is_super_admin } = permResult.rows[0];
    const hasPermission = is_super_admin || (permissions && permissions.accounting_edit);

    if (!hasPermission) {
      return res.status(403).json({ error: 'Accounting edit permission required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get admin ID for recording
    const adminResult = await db.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );
    const adminId = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;

    // Upload to Cloudinary in passbook folder
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'passbook');

    const { notes } = req.body;

    // Insert into database
    const result = await db.query(
      `INSERT INTO passbook_uploads (image_url, uploaded_by, notes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [uploadResult.secure_url, adminId, notes || null]
    );

    // Fetch with uploader name
    const fullResult = await db.query(
      `SELECT p.*, a.first_name as uploader_name
       FROM passbook_uploads p
       LEFT JOIN admins a ON p.uploaded_by = a.id
       WHERE p.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(fullResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload passbook screenshot' });
  }
});

// Delete a passbook screenshot
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    // Check if user has accounting_edit permission
    const permResult = await db.query(
      `SELECT p.permissions, a.is_super_admin
       FROM admins a
       LEFT JOIN permissions p ON a.id = p.admin_id
       WHERE LOWER(a.email) = $1`,
      [req.user.email.toLowerCase()]
    );

    if (permResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin not found' });
    }

    const { permissions, is_super_admin } = permResult.rows[0];
    const hasPermission = is_super_admin || (permissions && permissions.accounting_edit);

    if (!hasPermission) {
      return res.status(403).json({ error: 'Accounting edit permission required' });
    }

    const { id } = req.params;

    // Get the image URL to extract public_id for Cloudinary deletion
    const existing = await db.query('SELECT image_url FROM passbook_uploads WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Passbook screenshot not found' });
    }

    // Extract public_id from Cloudinary URL and delete
    const imageUrl = existing.rows[0].image_url;
    if (imageUrl) {
      // Extract public_id: format is .../usls-batch-2003/passbook/filename.ext
      const matches = imageUrl.match(/usls-batch-2003\/passbook\/[^.]+/);
      if (matches) {
        try {
          await deleteFromCloudinary(matches[0]);
        } catch (e) {
          console.error('Failed to delete from Cloudinary:', e);
        }
      }
    }

    // Delete from database
    await db.query('DELETE FROM passbook_uploads WHERE id = $1', [id]);

    res.json({ message: 'Passbook screenshot deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete passbook screenshot' });
  }
});

module.exports = router;
