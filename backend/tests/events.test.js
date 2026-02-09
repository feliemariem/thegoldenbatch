/**
 * Events API Tests
 *
 * Tests for /api/events endpoints:
 * - GET / (list published events with RSVP counts)
 * - GET /my-rsvps (user's event RSVPs)
 * - GET /:id (single event details)
 * - POST /:id/rsvp (RSVP to event)
 * - DELETE /:id/rsvp (remove RSVP)
 * - GET /admin/all (admin - all events including unpublished)
 * - POST / (admin - create event)
 * - PUT /:id (admin - update event)
 * - DELETE /:id (admin - delete event)
 */

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
process.env.FRONTEND_URL = 'http://localhost:3000';

const { getTestPool, truncateTables, seedTestData } = require('./setup');
const {
  createAdminToken,
  createUserToken
} = require('./helpers');

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

// Create test app with events routes
const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/events', require('../routes/events'));
  return app;
};

describe('Events API', () => {
  let app;
  let pool;
  let adminToken;
  let userToken;
  let userId;

  beforeAll(() => {
    app = createTestApp();
    pool = getTestPool();
  });

  beforeEach(async () => {
    await truncateTables();
    await seedTestData();

    // Get admin token
    const adminResult = await pool.query(
      `SELECT id FROM admins WHERE email = 'admin@test.com' LIMIT 1`
    );
    adminToken = createAdminToken(adminResult.rows[0]?.id || 1, 'admin@test.com');

    // Get user token and ID
    const userResult = await pool.query(
      `SELECT id FROM users WHERE email = 'testuser@test.com' LIMIT 1`
    );
    userId = userResult.rows[0]?.id || 1;
    userToken = createUserToken(userId, 'testuser@test.com');
  });

  // Helper to create test events
  const createTestEvents = async () => {
    const adminResult = await pool.query(
      `SELECT id FROM admins WHERE email = 'admin@test.com' LIMIT 1`
    );
    const adminId = adminResult.rows[0]?.id || 1;

    // Future event (should show by default)
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    const futureStr = futureDate.toISOString().split('T')[0];

    // Past event
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    const pastStr = pastDate.toISOString().split('T')[0];

    await pool.query(`
      INSERT INTO events (title, description, event_date, event_time, location, type, is_published, is_main_event, created_by)
      VALUES
        ('Future Event', 'Description 1', $1, '10:00 AM', 'Venue A', 'in-person', true, false, $3),
        ('Past Event', 'Description 2', $2, '2:00 PM', 'Venue B', 'virtual', true, false, $3),
        ('Main Homecoming', 'The big event', $1, '6:00 PM', 'Hotel Grand', 'in-person', true, true, $3),
        ('Unpublished Event', 'Draft', $1, '9:00 AM', 'TBD', 'in-person', false, false, $3)
    `, [futureStr, pastStr, adminId]);

    const eventsResult = await pool.query(`SELECT id, title FROM events ORDER BY id`);
    return eventsResult.rows;
  };

  // ============================================================
  // GET / - List Published Events
  // ============================================================
  describe('GET /api/events', () => {
    it('should return published upcoming events by default', async () => {
      await createTestEvents();

      const response = await request(app)
        .get('/api/events')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Should include future events but not unpublished or past
      response.body.forEach(event => {
        expect(event.is_published).toBe(true);
      });

      // Unpublished event should not be included
      const titles = response.body.map(e => e.title);
      expect(titles).not.toContain('Unpublished Event');
    });

    it('should include past events when includePast=true', async () => {
      await createTestEvents();

      const response = await request(app)
        .get('/api/events?includePast=true')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      const titles = response.body.map(e => e.title);
      expect(titles).toContain('Past Event');
    });

    it('should include RSVP counts for each event', async () => {
      const events = await createTestEvents();
      const eventId = events[0].id;

      // Add some RSVPs
      await pool.query(`
        INSERT INTO event_rsvps (event_id, user_id, status)
        VALUES ($1, $2, 'going')
      `, [eventId, userId]);

      const response = await request(app)
        .get('/api/events')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      const targetEvent = response.body.find(e => e.id === eventId);
      if (targetEvent) {
        expect(targetEvent.going_count).toBeDefined();
        expect(targetEvent.interested_count).toBeDefined();
        expect(targetEvent.not_going_count).toBeDefined();
      }
    });

    it('should include current user RSVP status', async () => {
      const events = await createTestEvents();
      const eventId = events[0].id;

      // Add user RSVP
      await pool.query(`
        INSERT INTO event_rsvps (event_id, user_id, status)
        VALUES ($1, $2, 'going')
      `, [eventId, userId]);

      const response = await request(app)
        .get('/api/events')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      const targetEvent = response.body.find(e => e.id === eventId);
      if (targetEvent) {
        expect(targetEvent.user_rsvp).toBe('going');
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/events');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // GET /my-rsvps - User's Event RSVPs
  // ============================================================
  describe('GET /api/events/my-rsvps', () => {
    it('should return user RSVPs for upcoming events', async () => {
      const events = await createTestEvents();
      const futureEventId = events.find(e => e.title === 'Future Event')?.id;

      // Add user RSVP
      await pool.query(`
        INSERT INTO event_rsvps (event_id, user_id, status)
        VALUES ($1, $2, 'going')
      `, [futureEventId, userId]);

      const response = await request(app)
        .get('/api/events/my-rsvps')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].status).toBe('going');
    });

    it('should only include going and interested RSVPs', async () => {
      const events = await createTestEvents();
      const eventId = events[0].id;

      // Add not_going RSVP
      await pool.query(`
        INSERT INTO event_rsvps (event_id, user_id, status)
        VALUES ($1, $2, 'not_going')
      `, [eventId, userId]);

      const response = await request(app)
        .get('/api/events/my-rsvps')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      // Should not include not_going RSVPs
      response.body.forEach(rsvp => {
        expect(['going', 'interested']).toContain(rsvp.status);
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/events/my-rsvps');

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // GET /:id - Single Event
  // ============================================================
  describe('GET /api/events/:id', () => {
    it('should return event details with attendees', async () => {
      const events = await createTestEvents();
      const eventId = events[0].id;

      // Add some RSVPs
      await pool.query(`
        INSERT INTO event_rsvps (event_id, user_id, status)
        VALUES ($1, $2, 'going')
      `, [eventId, userId]);

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(eventId);
      expect(response.body.title).toBeDefined();
      expect(response.body.attendees).toBeDefined();
      expect(Array.isArray(response.body.attendees)).toBe(true);
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .get('/api/events/99999')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Event not found');
    });

    it('should return 404 for unpublished event', async () => {
      const events = await createTestEvents();
      const unpublishedEvent = events.find(e => e.title === 'Unpublished Event');

      const response = await request(app)
        .get(`/api/events/${unpublishedEvent.id}`)
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ============================================================
  // POST /:id/rsvp - RSVP to Event
  // ============================================================
  describe('POST /api/events/:id/rsvp', () => {
    let eventId;

    beforeEach(async () => {
      const events = await createTestEvents();
      eventId = events[0].id;
    });

    it('should create RSVP with going status', async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'going' });

      expect(response.status).toBe(200);
      expect(response.body.event_id).toBe(eventId);
      expect(response.body.status).toBe('going');
    });

    it('should create RSVP with interested status', async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'interested' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('interested');
    });

    it('should create RSVP with not_going status', async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'not_going' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('not_going');
    });

    it('should update existing RSVP', async () => {
      // Create initial RSVP
      await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'going' });

      // Update RSVP
      const response = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'not_going' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('not_going');

      // Verify only one RSVP exists
      const count = await pool.query(
        `SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId]
      );
      expect(parseInt(count.rows[0].count)).toBe(1);
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .set('Cookie', `token=${userToken}`)
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid status');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/events/${eventId}/rsvp`)
        .send({ status: 'going' });

      expect(response.status).toBe(401);
    });
  });

  // ============================================================
  // DELETE /:id/rsvp - Remove RSVP
  // ============================================================
  describe('DELETE /api/events/:id/rsvp', () => {
    let eventId;

    beforeEach(async () => {
      const events = await createTestEvents();
      eventId = events[0].id;

      // Create RSVP to delete
      await pool.query(`
        INSERT INTO event_rsvps (event_id, user_id, status)
        VALUES ($1, $2, 'going')
      `, [eventId, userId]);
    });

    it('should remove RSVP', async () => {
      const response = await request(app)
        .delete(`/api/events/${eventId}/rsvp`)
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('RSVP removed');

      // Verify RSVP was removed
      const check = await pool.query(
        `SELECT * FROM event_rsvps WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId]
      );
      expect(check.rows.length).toBe(0);
    });

    it('should succeed even if no RSVP exists', async () => {
      // Delete the RSVP first
      await pool.query(
        `DELETE FROM event_rsvps WHERE event_id = $1 AND user_id = $2`,
        [eventId, userId]
      );

      const response = await request(app)
        .delete(`/api/events/${eventId}/rsvp`)
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // GET /admin/all - All Events (Admin)
  // ============================================================
  describe('GET /api/events/admin/all', () => {
    it('should return all events including unpublished', async () => {
      await createTestEvents();

      const response = await request(app)
        .get('/api/events/admin/all')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      const titles = response.body.map(e => e.title);
      expect(titles).toContain('Unpublished Event');
    });

    it('should include RSVP counts', async () => {
      await createTestEvents();

      const response = await request(app)
        .get('/api/events/admin/all')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      response.body.forEach(event => {
        expect(event.going_count).toBeDefined();
        expect(event.interested_count).toBeDefined();
      });
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/events/admin/all')
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // POST / - Create Event (Admin)
  // ============================================================
  describe('POST /api/events', () => {
    it('should create a new event', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);
      const dateStr = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/events')
        .set('Cookie', `token=${adminToken}`)
        .send({
          title: 'New Event',
          description: 'A new event description',
          event_date: dateStr,
          event_time: '3:00 PM',
          location: 'New Venue',
          type: 'hybrid',
          is_main_event: false,
          is_published: true
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Event');
      expect(response.body.description).toBe('A new event description');
      expect(response.body.location).toBe('New Venue');
      expect(response.body.type).toBe('hybrid');
    });

    it('should create event with minimal fields', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);
      const dateStr = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/events')
        .set('Cookie', `token=${adminToken}`)
        .send({
          title: 'Minimal Event',
          event_date: dateStr
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Minimal Event');
      expect(response.body.is_published).toBe(true); // default
      expect(response.body.type).toBe('in-person'); // default
    });

    it('should reject missing title', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Cookie', `token=${adminToken}`)
        .send({
          event_date: '2024-12-01'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title and date are required');
    });

    it('should reject missing date', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Cookie', `token=${adminToken}`)
        .send({
          title: 'No Date Event'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title and date are required');
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Cookie', `token=${userToken}`)
        .send({
          title: 'Test Event',
          event_date: '2024-12-01'
        });

      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // PUT /:id - Update Event (Admin)
  // ============================================================
  describe('PUT /api/events/:id', () => {
    let eventId;

    beforeEach(async () => {
      const events = await createTestEvents();
      eventId = events[0].id;
    });

    it('should update event fields', async () => {
      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Cookie', `token=${adminToken}`)
        .send({
          title: 'Updated Title',
          description: 'Updated description',
          location: 'New Location'
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.description).toBe('Updated description');
      expect(response.body.location).toBe('New Location');
    });

    it('should toggle is_published', async () => {
      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Cookie', `token=${adminToken}`)
        .send({
          is_published: false
        });

      expect(response.status).toBe(200);
      expect(response.body.is_published).toBe(false);
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .put('/api/events/99999')
        .set('Cookie', `token=${adminToken}`)
        .send({ title: 'Test' });

      expect(response.status).toBe(404);
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Cookie', `token=${userToken}`)
        .send({ title: 'Test' });

      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // DELETE /:id - Delete Event (Admin)
  // ============================================================
  describe('DELETE /api/events/:id', () => {
    let eventId;

    beforeEach(async () => {
      const events = await createTestEvents();
      eventId = events[0].id;
    });

    it('should delete an event', async () => {
      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Event deleted');

      // Verify deletion
      const check = await pool.query(
        `SELECT * FROM events WHERE id = $1`,
        [eventId]
      );
      expect(check.rows.length).toBe(0);
    });

    it('should cascade delete RSVPs', async () => {
      // Add RSVP
      await pool.query(`
        INSERT INTO event_rsvps (event_id, user_id, status)
        VALUES ($1, $2, 'going')
      `, [eventId, userId]);

      // Delete event
      await request(app)
        .delete(`/api/events/${eventId}`)
        .set('Cookie', `token=${adminToken}`);

      // Verify RSVPs were also deleted
      const check = await pool.query(
        `SELECT * FROM event_rsvps WHERE event_id = $1`,
        [eventId]
      );
      expect(check.rows.length).toBe(0);
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .delete('/api/events/99999')
        .set('Cookie', `token=${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .set('Cookie', `token=${userToken}`);

      expect(response.status).toBe(403);
    });
  });
});
