const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const inviteRoutes = require('./routes/invites');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const masterListRoutes = require('./routes/masterlist');
const donationRoutes = require('./routes/donations');
const permissionRoutes = require('./routes/permissions');
const ledgerRoutes = require('./routes/ledger');
const meetingRoutes = require('./routes/meetings');
const announcementRoutes = require('./routes/announcements');
const actionItemRoutes = require('./routes/action-items');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/me', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/master-list', masterListRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/action-items', actionItemRoutes);
app.use('/api/events', require('./routes/events'));
app.use('/api/committee', require('./routes/committee'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});