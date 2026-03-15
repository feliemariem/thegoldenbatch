const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { cloudinary } = require('../utils/cloudinary');

// Custom multer config for photos: 8MB, jpeg/png only
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG files are allowed'), false);
    }
  }
});

// Helper: check if user can approve media (super admin OR has can_approve_media permission)
const canApproveMedia = async (email) => {
  // Check if super admin
  const adminResult = await db.query(
    'SELECT id, is_super_admin FROM admins WHERE LOWER(email) = $1',
    [email.toLowerCase()]
  );

  if (adminResult.rows.length > 0) {
    const admin = adminResult.rows[0];
    if (admin.is_super_admin) return true;

    // Check for can_approve_media permission
    const permResult = await db.query(
      'SELECT enabled FROM permissions WHERE admin_id = $1 AND permission = $2',
      [admin.id, 'can_approve_media']
    );
    if (permResult.rows.length > 0 && permResult.rows[0].enabled) return true;
  }

  return false;
};

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: `usls-batch-2003/${folder}`,
        resource_type: 'image',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
};

// =============================================================================
// POST /api/media/photos - Upload a new photo
// =============================================================================
router.post('/', authenticateToken, photoUpload.single('photo'), async (req, res) => {
  let uploadResult = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to Cloudinary
    uploadResult = await uploadToCloudinary(req.file.buffer, 'media/memory_lane');

    // Get uploader's name: prefer master_list.current_name, else users first_name + last_name
    const userResult = await db.query(
      `SELECT
        COALESCE(NULLIF(TRIM(m.current_name), ''), u.first_name || ' ' || u.last_name) AS credit_name
       FROM users u
       LEFT JOIN invites i ON u.invite_id = i.id
       LEFT JOIN master_list m ON i.master_list_id = m.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      // Cleanup Cloudinary
      await cloudinary.uploader.destroy(uploadResult.public_id);
      return res.status(404).json({ error: 'User not found' });
    }

    const creditName = userResult.rows[0].credit_name;
    const album = req.body.album || 'memory_lane';

    // Insert into media_photos
    const result = await db.query(
      `INSERT INTO media_photos (album, cloudinary_url, cloudinary_public_id, credit_name, uploaded_by, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [album, uploadResult.secure_url, uploadResult.public_id, creditName, req.user.id]
    );

    res.status(201).json({
      message: 'Photo submitted successfully',
      id: result.rows[0].id
    });
  } catch (err) {
    console.error('Error uploading photo:', err);
    // Cleanup Cloudinary if upload succeeded but DB insert failed
    if (uploadResult && uploadResult.public_id) {
      try {
        await cloudinary.uploader.destroy(uploadResult.public_id);
      } catch (cleanupErr) {
        console.error('Failed to cleanup Cloudinary:', cleanupErr);
      }
    }
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// =============================================================================
// GET /api/media/photos - List photos (published for users, any status for admins)
// =============================================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const album = req.query.album || 'memory_lane';
    const status = req.query.status || 'published';

    // Non-published statuses require super admin
    if (status !== 'published') {
      const hasMediaAccess = await canApproveMedia(req.user.email);
      if (!hasMediaAccess) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    const result = await db.query(
      `SELECT * FROM media_photos
       WHERE album = $1 AND status = $2
       ORDER BY created_at DESC`,
      [album, status]
    );

    res.json({ photos: result.rows });
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// =============================================================================
// GET /api/media/photos/mine - Get current user's uploaded photos
// =============================================================================
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM media_photos
       WHERE uploaded_by = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ photos: result.rows });
  } catch (err) {
    console.error('Error fetching user photos:', err);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// =============================================================================
// PATCH /api/media/photos/:id/status - Update photo status (admin only)
// =============================================================================
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const hasMediaAccess = await canApproveMedia(req.user.email);
    if (!hasMediaAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    if (!['published', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "published" or "rejected"' });
    }

    const result = await db.query(
      `UPDATE media_photos SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating photo status:', err);
    res.status(500).json({ error: 'Failed to update photo status' });
  }
});

// =============================================================================
// DELETE /api/media/photos/:id - Delete a photo
// =============================================================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the photo
    const photoResult = await db.query(
      'SELECT * FROM media_photos WHERE id = $1',
      [id]
    );

    if (photoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = photoResult.rows[0];
    const hasMediaAccess = await canApproveMedia(req.user.email);

    // Check permissions:
    // 1. Super admin can delete any photo
    // 2. Uploader can delete their own pending photo
    const isOwnerPending = photo.uploaded_by === req.user.id && photo.status === 'pending';

    if (!hasMediaAccess && !isOwnerPending) {
      return res.status(403).json({ error: 'Not authorized to delete this photo' });
    }

    // Delete from Cloudinary
    if (photo.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(photo.cloudinary_public_id);
      } catch (cloudinaryErr) {
        console.error('Failed to delete from Cloudinary:', cloudinaryErr);
        // Continue with DB deletion
      }
    }

    // Delete from database
    await db.query('DELETE FROM media_photos WHERE id = $1', [id]);

    res.json({ message: 'Photo deleted' });
  } catch (err) {
    console.error('Error deleting photo:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
