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
const messageRoutes = require('./routes/messages');

const app = express();

// Trust proxy - required for rate limiting behind reverse proxy (nginx, Heroku, etc.)
// This ensures req.ip returns the client's real IP, not the proxy's IP
app.set('trust proxy', 1);

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
app.use('/api/messages', messageRoutes);
app.use('/api/events', require('./routes/events'));
app.use('/api/committee', require('./routes/committee'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to list all registered routes
app.get('/api/debug/routes', (req, res) => {
  const routes = [];

  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the app
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      // Router-level middleware
      const basePath = middleware.regexp.source
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\^|\$/g, '');

      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: basePath + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });

  res.json({
    total: routes.length,
    routes: routes.sort((a, b) => a.path.localeCompare(b.path))
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('[SERVER] Routes mounted:');
  console.log('  /api/auth');
  console.log('  /api/invites');
  console.log('  /api/me');
  console.log('  /api/admin');
  console.log('  /api/master-list');
  console.log('  /api/donations');
  console.log('  /api/permissions');
  console.log('  /api/ledger');
  console.log('  /api/meetings');
  console.log('  /api/announcements');
  console.log('  /api/action-items');
  console.log('  /api/messages');
  console.log('  /api/events');
  console.log('  /api/committee');
  console.log('  /api/health');
  console.log('  /api/debug/routes');
});