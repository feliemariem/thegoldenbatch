const express = require('express');
const router = express.Router();
const multer = require('multer');
const archiver = require('archiver');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { cloudinary } = require('../utils/cloudinary');

// Helper: slugify a string for filenames
const slugify = (str) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

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

// Helper: check if user is super admin
const isSuperAdmin = async (email) => {
  const result = await db.query(
    'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
    [email.toLowerCase()]
  );
  return result.rows.length > 0 && result.rows[0].is_super_admin === true;
};

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
    uploadResult = await uploadToCloudinary(req.file.buffer, 'media/throwback_vault');

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
    const album = 'unassigned';

    // Insert into media_photos
    let result;
    try {
      result = await db.query(
        `INSERT INTO media_photos (album, cloudinary_url, cloudinary_public_id, credit_name, uploaded_by, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id`,
        [album, uploadResult.secure_url, uploadResult.public_id, creditName, req.user.id]
      );
    } catch (dbErr) {
      console.error('DB insert failed:', dbErr.message);
      console.error('DB insert params:', { album, url: uploadResult.secure_url, public_id: uploadResult.public_id, creditName, userId: req.user.id });
      throw dbErr;
    }

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
    const album = req.query.album;
    const status = req.query.status || 'published';

    // Non-published statuses require super admin
    if (status !== 'published') {
      const hasMediaAccess = await canApproveMedia(req.user.email);
      if (!hasMediaAccess) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    let result;
    if (album) {
      // Filter by specific album
      result = await db.query(
        `SELECT * FROM media_photos
         WHERE album = $1 AND status = $2
         ORDER BY created_at DESC`,
        [album, status]
      );
    } else {
      // No album filter - return all photos with the given status
      result = await db.query(
        `SELECT * FROM media_photos
         WHERE status = $1
         ORDER BY created_at DESC`,
        [status]
      );
    }

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
// GET /api/media/photos/download/album/:album - Download all photos in album as ZIP
// =============================================================================
router.get('/download/album/:album', authenticateToken, async (req, res) => {
  try {
    const isAdmin = await isSuperAdmin(req.user.email);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const { album } = req.params;
    const status = req.query.status || 'published';

    // Fetch all photos matching album and status
    const result = await db.query(
      `SELECT * FROM media_photos
       WHERE album = $1 AND status = $2
       ORDER BY created_at ASC`,
      [album, status]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No photos found' });
    }

    const photos = result.rows;

    // Set response headers for ZIP download
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `memorylane-${status}-${dateStr}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Create archive
    const archive = archiver('zip', { zlib: { level: 5 } });

    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create ZIP archive' });
      }
    });

    archive.pipe(res);

    // Fetch images with concurrency limit of 5
    const concurrencyLimit = 5;
    for (let i = 0; i < photos.length; i += concurrencyLimit) {
      const batch = photos.slice(i, i + concurrencyLimit);

      const fetchPromises = batch.map(async (photo, batchIndex) => {
        const index = i + batchIndex + 1;
        const sluggedName = slugify(photo.credit_name);
        const ext = photo.cloudinary_url.toLowerCase().includes('.png') ? 'png' : 'jpg';
        const entryName = `${index}-${sluggedName}-${photo.id}.${ext}`;

        try {
          const response = await fetch(photo.cloudinary_url);
          if (!response.ok) {
            console.error(`Failed to fetch photo ${photo.id}: ${response.status}`);
            return null;
          }
          const buffer = Buffer.from(await response.arrayBuffer());
          return { entryName, buffer };
        } catch (err) {
          console.error(`Failed to fetch photo ${photo.id}:`, err);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);

      for (const result of results) {
        if (result) {
          archive.append(result.buffer, { name: result.entryName });
        }
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('Error creating ZIP download:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create download' });
    }
  }
});

// =============================================================================
// GET /api/media/photos/:id/download - Download single photo
// =============================================================================
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const isAdmin = await isSuperAdmin(req.user.email);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    const { id } = req.params;

    // Fetch the photo
    const result = await db.query(
      'SELECT * FROM media_photos WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = result.rows[0];
    const sluggedName = slugify(photo.credit_name);
    const ext = photo.cloudinary_url.toLowerCase().includes('.png') ? 'png' : 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const filename = `memorylane-${sluggedName}-${photo.id}.${ext}`;

    // Fetch the image from Cloudinary
    const response = await fetch(photo.cloudinary_url);
    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch image from storage' });
    }

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the response body to the client
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading photo:', err);
    res.status(500).json({ error: 'Failed to download photo' });
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

    const { status, album } = req.body;
    if (!['published', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "published" or "rejected"' });
    }

    // Require album assignment when publishing
    if (status === 'published' && !album) {
      return res.status(400).json({ error: 'Please assign a photo to an album before publishing' });
    }

    let result;
    if (status === 'published' && album) {
      result = await db.query(
        `UPDATE media_photos SET status = $1, album = $2 WHERE id = $3 RETURNING *`,
        [status, album, req.params.id]
      );
    } else {
      result = await db.query(
        `UPDATE media_photos SET status = $1 WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = result.rows[0];

    // Send inbox notification when photo is published
    if (status === 'published' && photo.uploaded_by) {
      try {
        // Get admin ID for the from_admin_id field
        const adminResult = await db.query(
          'SELECT id FROM admins WHERE LOWER(email) = $1',
          [req.user.email.toLowerCase()]
        );
        const adminId = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;

        // Get user's first_name for the greeting
        const userResult = await db.query(
          'SELECT first_name FROM users WHERE id = $1',
          [photo.uploaded_by]
        );
        const firstName = userResult.rows.length > 0 ? userResult.rows[0].first_name : photo.credit_name.split(' ')[0];

        const frontendUrl = process.env.FRONTEND_URL || 'https://thegoldenbatch2003.com';
        const mediaLink = `${frontendUrl}/media?tab=photos&album=${photo.album}`;

        const subject = "Your photo is now live!";
        const message = `Hi ${firstName}! Your photo is now live! Head over to the Media page and check it out -- your memory is now part of the batch collection. Thank you gid for sharing! Keep them coming -- the more photos we have, the more we can relive together.\n\n${mediaLink}`;

        await db.query(
          `INSERT INTO messages (from_admin_id, to_user_id, subject, message)
           VALUES ($1, $2, $3, $4)`,
          [adminId, photo.uploaded_by, subject, message]
        );
      } catch (msgErr) {
        // Log but don't fail the request if notification fails
        console.error('Failed to send photo published notification:', msgErr);
      }
    }

    res.json(photo);
  } catch (err) {
    console.error('Error updating photo status:', err);
    res.status(500).json({ error: 'Failed to update photo status' });
  }
});

// =============================================================================
// GET /api/media/albums - Get all active albums
// =============================================================================
router.get('/albums', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM media_albums
       WHERE is_active = true
       ORDER BY display_order ASC`
    );
    res.json({ albums: result.rows });
  } catch (err) {
    console.error('Error fetching albums:', err);
    res.status(500).json({ error: 'Failed to fetch albums' });
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
