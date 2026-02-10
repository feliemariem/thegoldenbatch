const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { uploadRawFileToCloudinary } = require('../utils/cloudinary');

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

    const { title, meeting_date, location, attendees, notes } = req.body;

    // Get admin ID from email
    const adminResult = await db.query(
      'SELECT id FROM admins WHERE LOWER(email) = $1',
      [req.user.email.toLowerCase()]
    );
    const adminId = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;

    const result = await db.query(`
      INSERT INTO meeting_minutes (title, meeting_date, location, attendees, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [title, meeting_date, location, attendees, notes, adminId]);

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
    const { title, meeting_date, location, attendees, notes } = req.body;

    const result = await db.query(`
      UPDATE meeting_minutes
      SET title = $1, meeting_date = $2, location = $3, attendees = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [title, meeting_date, location, attendees, notes, id]);

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

    // Upload to Cloudinary using raw resource type for PDFs/documents
    const result = await uploadRawFileToCloudinary(req.file.buffer, 'meeting-attachments');

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

// =====================
// ACTION ITEMS ROUTES
// =====================

// Get all admins (for assignee dropdown)
router.get('/admins/list', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesViewPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view admins' });
    }

    const result = await db.query(`
      SELECT a.id, a.email, a.first_name, a.last_name,
             COALESCE(u.first_name || ' ' || u.last_name, a.first_name || ' ' || COALESCE(a.last_name, '')) as display_name
      FROM admins a
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      ORDER BY display_name
    `);

    res.json({ admins: result.rows });
  } catch (err) {
    console.error('Failed to fetch admins:', err);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// Get action items for a meeting
router.get('/:meetingId/action-items', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesViewPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to view action items' });
    }

    const { meetingId } = req.params;

    const result = await db.query(`
      SELECT ai.*,
             a.email as assignee_email,
             COALESCE(u.first_name || ' ' || u.last_name, a.first_name || ' ' || COALESCE(a.last_name, '')) as assignee_name
      FROM action_items ai
      LEFT JOIN admins a ON ai.assignee_id = a.id
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE ai.meeting_id = $1
      ORDER BY
        CASE ai.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        ai.due_date ASC NULLS LAST,
        ai.created_at ASC
    `, [meetingId]);

    res.json({ actionItems: result.rows });
  } catch (err) {
    console.error('Failed to fetch action items:', err);
    res.status(500).json({ error: 'Failed to fetch action items' });
  }
});

// Create action item
router.post('/:meetingId/action-items', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to create action items' });
    }

    const { meetingId } = req.params;
    const { task, assignee_id, due_date, status, priority } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    // Check meeting exists
    const meeting = await db.query('SELECT id FROM meeting_minutes WHERE id = $1', [meetingId]);
    if (meeting.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const result = await db.query(`
      INSERT INTO action_items (meeting_id, task, assignee_id, due_date, status, priority)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [meetingId, task, assignee_id || null, due_date || null, status || 'not_started', priority || 'medium']);

    // Fetch the full action item with assignee info
    const fullResult = await db.query(`
      SELECT ai.*,
             a.email as assignee_email,
             COALESCE(u.first_name || ' ' || u.last_name, a.first_name || ' ' || COALESCE(a.last_name, '')) as assignee_name
      FROM action_items ai
      LEFT JOIN admins a ON ai.assignee_id = a.id
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE ai.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(fullResult.rows[0]);
  } catch (err) {
    console.error('Failed to create action item:', err);
    res.status(500).json({ error: 'Failed to create action item' });
  }
});

// Update action item
router.put('/:meetingId/action-items/:actionItemId', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to edit action items' });
    }

    const { meetingId, actionItemId } = req.params;
    const { task, assignee_id, due_date, status, priority } = req.body;

    const result = await db.query(`
      UPDATE action_items
      SET task = $1, assignee_id = $2, due_date = $3, status = $4, priority = $5
      WHERE id = $6 AND meeting_id = $7
      RETURNING *
    `, [task, assignee_id || null, due_date || null, status || 'not_started', priority || 'medium', actionItemId, meetingId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    // Fetch the full action item with assignee info
    const fullResult = await db.query(`
      SELECT ai.*,
             a.email as assignee_email,
             COALESCE(u.first_name || ' ' || u.last_name, a.first_name || ' ' || COALESCE(a.last_name, '')) as assignee_name
      FROM action_items ai
      LEFT JOIN admins a ON ai.assignee_id = a.id
      LEFT JOIN users u ON LOWER(a.email) = LOWER(u.email)
      WHERE ai.id = $1
    `, [actionItemId]);

    res.json(fullResult.rows[0]);
  } catch (err) {
    console.error('Failed to update action item:', err);
    res.status(500).json({ error: 'Failed to update action item' });
  }
});

// Delete action item
router.delete('/:meetingId/action-items/:actionItemId', authenticateToken, async (req, res) => {
  try {
    const hasPermission = await checkMinutesEditPermission(req.user.email);
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete action items' });
    }

    const { meetingId, actionItemId } = req.params;

    const result = await db.query(
      'DELETE FROM action_items WHERE id = $1 AND meeting_id = $2 RETURNING id',
      [actionItemId, meetingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    res.json({ message: 'Action item deleted' });
  } catch (err) {
    console.error('Failed to delete action item:', err);
    res.status(500).json({ error: 'Failed to delete action item' });
  }
});

module.exports = router;