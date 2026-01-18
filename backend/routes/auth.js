const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { sendPasswordResetEmail } = require('../utils/email');

// Helper functions for text normalization
const toTitleCase = (str) => {
  if (!str) return str;
  return str.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

const toLowerEmail = (email) => {
  if (!email) return email;
  return email.trim().toLowerCase();
};

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const {
      invite_token,
      password,
      first_name,
      last_name,
      birthday,
      mobile,
      address,
      city,
      country,
      occupation,
      company,
    } = req.body;

    // Validate required fields
    if (!invite_token || !password || !first_name || !last_name || !city || !country) {
      return res.status(400).json({ 
        error: 'Required fields: invite_token, password, first_name, last_name, city, country' 
      });
    }

    // Validate invite token
    const inviteResult = await db.query(
      'SELECT id, email, used FROM invites WHERE invite_token = $1',
      [invite_token]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid invite token' });
    }

    const invite = inviteResult.rows[0];

    if (invite.used) {
      return res.status(400).json({ error: 'Invite already used' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (
        invite_id, email, password_hash, first_name, last_name, 
        birthday, mobile, address, city, country, occupation, company
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, email, first_name, last_name`,
      [
        invite.id,
        toLowerEmail(invite.email),
        password_hash,
        toTitleCase(first_name),
        toTitleCase(last_name),
        birthday || null,
        mobile || null,
        toTitleCase(address) || null,
        toTitleCase(city),
        toTitleCase(country),
        toTitleCase(occupation) || null,
        toTitleCase(company) || null,
      ]
    );

    // Mark invite as used
    await db.query('UPDATE invites SET used = TRUE WHERE id = $1', [invite.id]);

    // Update master_list status to 'Registered' and email if linked
    await db.query(
      `UPDATE master_list SET
        status = 'Registered',
        email = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id IN (
         SELECT master_list_id FROM invites WHERE id = $2 AND master_list_id IS NOT NULL
       )`,
      [toLowerEmail(invite.email), invite.id]
    );

    const user = userResult.rows[0];

    // Save RSVP if provided
    if (req.body.rsvp) {
      await db.query(
        'INSERT INTO rsvps (user_id, status) VALUES ($1, $2)',
        [user.id, req.body.rsvp]
      );
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, isAdmin: false },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Set JWT expiry based on rememberMe: 30 days if checked, 1 day otherwise
    const tokenExpiry = rememberMe ? '30d' : '1d';

    // Check users table first
    const userResult = await db.query(
      'SELECT id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const match = await bcrypt.compare(password, user.password_hash);

      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user is marked as admin in master_list
      const adminCheck = await db.query(
        'SELECT is_admin FROM master_list WHERE LOWER(email) = $1 AND is_admin = true',
        [email.toLowerCase()]
      );
      const isAdmin = adminCheck.rows.length > 0;

      const token = jwt.sign(
        { id: user.id, email: user.email, isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: tokenExpiry }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          isAdmin,
        },
      });
    }

    // Check admins table
    const adminResult = await db.query(
      'SELECT id, email, password_hash, first_name FROM admins WHERE email = $1',
      [email.toLowerCase()]
    );

    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      const match = await bcrypt.compare(password, admin.password_hash);

      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, isAdmin: true },
        process.env.JWT_SECRET,
        { expiresIn: tokenExpiry }
      );

      return res.json({
        token,
        user: {
          id: admin.id,
          email: admin.email,
          first_name: admin.first_name,
          isAdmin: true,
        },
      });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password - Request reset link
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const lowerEmail = email.toLowerCase();

    // Check if user exists
    const userResult = await db.query(
      'SELECT id, email, first_name FROM users WHERE email = $1',
      [lowerEmail]
    );

    // Also check admins table
    const adminResult = await db.query(
      'SELECT id, email, first_name FROM admins WHERE email = $1',
      [lowerEmail]
    );

    // Show error if email not found
    if (userResult.rows.length === 0 && adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found. Please check your email or contact the organizing committee.' });
    }

    const user = userResult.rows[0] || adminResult.rows[0];

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Delete any existing reset tokens for this email
    await db.query('DELETE FROM password_resets WHERE email = $1', [lowerEmail]);

    // Save reset token
    await db.query(
      'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
      [lowerEmail, token, expiresAt]
    );

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    const emailResult = await sendPasswordResetEmail(lowerEmail, user.first_name, resetUrl);

    if (!emailResult.success) {
      console.error('Failed to send reset email:', emailResult.error);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate reset token
router.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      'SELECT email, expires_at, used FROM password_resets WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ valid: false, error: 'Invalid reset link' });
    }

    const reset = result.rows[0];

    if (reset.used) {
      return res.status(400).json({ valid: false, error: 'Reset link already used' });
    }

    if (new Date() > new Date(reset.expires_at)) {
      return res.status(400).json({ valid: false, error: 'Reset link has expired' });
    }

    res.json({ valid: true, email: reset.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset Password - Set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate token
    const resetResult = await db.query(
      'SELECT email, expires_at, used FROM password_resets WHERE token = $1',
      [token]
    );

    if (resetResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid reset link' });
    }

    const reset = resetResult.rows[0];

    if (reset.used) {
      return res.status(400).json({ error: 'Reset link already used' });
    }

    if (new Date() > new Date(reset.expires_at)) {
      return res.status(400).json({ error: 'Reset link has expired' });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(password, 10);

    // Update password in users table
    const userUpdate = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id',
      [password_hash, reset.email]
    );

    // Also check admins table if not found in users
    if (userUpdate.rows.length === 0) {
      await db.query(
        'UPDATE admins SET password_hash = $1 WHERE email = $2',
        [password_hash, reset.email]
      );
    }

    // Mark token as used
    await db.query('UPDATE password_resets SET used = TRUE WHERE token = $1', [token]);

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;