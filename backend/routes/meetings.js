const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    // Allow PDFs, images, and common document types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Helper to check minutes_view permission
const checkMinutesViewPermission = async (userEmail) => {
  // Check if super admin
  const superAdminCheck = await db.query(
    'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );
  
  if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].is_super_admin) {
    return true;
  }

  // Check specific minutes_view permission
  const adminResult = await db.query(
    'SELECT id FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );

  if (adminResult.rows.length === 0) {
    return false;
  }

  const permResult = await db.query(
    'SELECT enabled FROM permissions WHERE admin_id = $1 AND permission = $2',
    [adminResult.rows[0].id, 'minutes_view']
  );

  return permResult.rows.length > 0 && permResult.rows[0].enabled;
};

// Helper to check minutes_edit permission
const checkMinutesEditPermission = async (userEmail) => {
  // Check if super admin
  const superAdminCheck = await db.query(
    'SELECT is_super_admin FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );
  
  if (superAdminCheck.rows.length > 0 && superAdminCheck.rows[0].is_super_admin) {
    return true;
  }

  // Check specific minutes_edit permission
  const adminResult = await db.query(
    'SELECT id FROM admins WHERE LOWER(email) = $1',
    [userEmail?.toLowerCase()]
  );

  if (adminResult.rows.length === 0) {
    return false;
  }

  const permResult = await db.query(
    'SELECT enabled FROM permissions WHERE admin_id = $1 AND permission = $2',
    [adminResult.rows[0].id, 'minutes_edit']
  );

  return permResult.rows.length > 0 && permResult.rows[0].enabled;
};

// Get all meetings (with attachments) - requires minutes_view permission
router.get('/', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesViewPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view meetings' });
    }

    const result = await db.query(`
      SELECT 
        m.*,
        COALESCE(u.first_name || ' ' || u.last_name, a.first_name) as created_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ma.id,
              'file_name', ma.file_name,
              'file_url', ma.file_url,
              'file_type', ma.file_type
            )
          ) FILTER (WHERE ma.id IS NOT NULL),
          '[]'
        ) as attachments
      FROM meeting_minutes m
      LEFT JOIN admins a ON m.created_by = a.id
      LEFT JOIN users u ON a.email = u.email
      LEFT JOIN meeting_attachments ma ON m.id = ma.meeting_id
      GROUP BY m.id, u.first_name, u.last_name, a.first_name
      ORDER BY m.meeting_date DESC
    `);

    res.json({ meetings: result.rows });
  } catch (err) {
    console.error('Failed to fetch meetings:', err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// Get single meeting
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesViewPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view meetings' });
    }

    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        m.*,
        COALESCE(u.first_name || ' ' || u.last_name, a.first_name) as created_by_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ma.id,
              'file_name', ma.file_name,
              'file_url', ma.file_url,
              'file_type', ma.file_type
            )
          ) FILTER (WHERE ma.id IS NOT NULL),
          '[]'
        ) as attachments
      FROM meeting_minutes m
      LEFT JOIN admins a ON m.created_by = a.id
      LEFT JOIN users u ON a.email = u.email
      LEFT JOIN meeting_attachments ma ON m.id = ma.meeting_id
      WHERE m.id = $1
      GROUP BY m.id, u.first_name, u.last_name, a.first_name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to fetch meeting:', err);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

// Create meeting - requires minutes_edit permission
router.post('/', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to create meetings' });
    }

    const { title, meeting_date, attendees, notes } = req.body;
    
    // Get admin ID from email
    const adminResult = await db.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );
    const adminId = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;

    const result = await db.query(`
      INSERT INTO meeting_minutes (title, meeting_date, attendees, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [title, meeting_date, attendees, notes, adminId]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to create meeting:', err);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Update meeting - requires minutes_edit permission
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to edit meetings' });
    }

    const { id } = req.params;
    const { title, meeting_date, attendees, notes } = req.body;

    const result = await db.query(`
      UPDATE meeting_minutes 
      SET title = $1, meeting_date = $2, attendees = $3, notes = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [title, meeting_date, attendees, notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update meeting:', err);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// Delete meeting - requires minutes_edit permission
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete meetings' });
    }

    const { id } = req.params;

    // Get attachments to delete from Cloudinary
    const attachments = await db.query(
      'SELECT file_url FROM meeting_attachments WHERE meeting_id = $1',
      [id]
    );

    // Delete from Cloudinary
    for (const att of attachments.rows) {
      try {
        // Extract public_id from URL
        const urlParts = att.file_url.split('/');
        const publicIdWithExt = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudErr) {
        console.error('Failed to delete from Cloudinary:', cloudErr);
      }
    }

    // Delete meeting (cascade will delete attachments)
    const result = await db.query(
      'DELETE FROM meeting_minutes WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    console.error('Failed to delete meeting:', err);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// Upload attachment - requires minutes_edit permission
router.post('/:id/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to upload attachments' });
    }

    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check meeting exists
    const meeting = await db.query('SELECT id FROM meeting_minutes WHERE id = $1', [id]);
    if (meeting.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'meeting-attachments',
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Save to database
    const attachment = await db.query(`
      INSERT INTO meeting_attachments (meeting_id, file_name, file_url, file_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, req.file.originalname, result.secure_url, req.file.mimetype]);

    res.status(201).json(attachment.rows[0]);
  } catch (err) {
    console.error('Failed to upload attachment:', err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Delete attachment - requires minutes_edit permission
router.delete('/:meetingId/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete attachments' });
    }

    const { meetingId, attachmentId } = req.params;

    // Get attachment
    const attachment = await db.query(
      'SELECT * FROM meeting_attachments WHERE id = $1 AND meeting_id = $2',
      [attachmentId, meetingId]
    );

    if (attachment.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete from Cloudinary
    try {
      const urlParts = attachment.rows[0].file_url.split('/');
      const publicIdWithExt = urlParts.slice(-2).join('/');
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    } catch (cloudErr) {
      console.error('Failed to delete from Cloudinary:', cloudErr);
    }

    // Delete from database
    await db.query('DELETE FROM meeting_attachments WHERE id = $1', [attachmentId]);

    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error('Failed to delete attachment:', err);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

module.exports = router;