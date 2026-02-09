const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load test environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.test') });

// Override DATABASE_URL for test environment
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/test_alumni_homecoming';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';

let testPool;
let schemaInitialized = false;

// Create test database connection
const getTestPool = () => {
  if (!testPool) {
    testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false
    });
  }
  return testPool;
};

// Run schema.sql to set up database tables
const setupDatabase = async () => {
  // Only run schema setup once across all test files
  if (schemaInitialized) {
    return;
  }

  const pool = getTestPool();
  const schemaPath = path.join(__dirname, '../schema.sql');
  let schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    // First, drop all tables with CASCADE to handle foreign key dependencies
    // This ensures clean slate even if schema.sql DROP statements fail
    const dropStatements = `
      DROP TABLE IF EXISTS action_items CASCADE;
      DROP TABLE IF EXISTS event_rsvps CASCADE;
      DROP TABLE IF EXISTS events CASCADE;
      DROP TABLE IF EXISTS announcement_reads CASCADE;
      DROP TABLE IF EXISTS meeting_attachments CASCADE;
      DROP TABLE IF EXISTS meeting_minutes CASCADE;
      DROP TABLE IF EXISTS permissions CASCADE;
      DROP TABLE IF EXISTS password_resets CASCADE;
      DROP TABLE IF EXISTS announcements CASCADE;
      DROP TABLE IF EXISTS ledger CASCADE;
      DROP TABLE IF EXISTS rsvps CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS invites CASCADE;
      DROP TABLE IF EXISTS master_list CASCADE;
      DROP TABLE IF EXISTS admins CASCADE;
      DROP TABLE IF EXISTS volunteer_interests CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
    `;

    await pool.query(dropStatements);

    // Remove the DROP statements from schema.sql since we already dropped
    schema = schema.replace(/DROP TABLE IF EXISTS [^;]+;/gi, '');

    // Convert CREATE INDEX to CREATE INDEX IF NOT EXISTS to handle parallel test runs
    schema = schema.replace(/CREATE INDEX /gi, 'CREATE INDEX IF NOT EXISTS ');

    await pool.query(schema);
    schemaInitialized = true;
    console.log('Test database schema initialized');
  } catch (err) {
    // If error is about relation already existing, schema was set up by another test file
    if (err.message.includes('already exists')) {
      schemaInitialized = true;
      console.log('Test database schema already initialized by another test');
      return;
    }
    console.error('Error initializing test database schema:', err.message);
    throw err;
  }
};

// Insert minimal seed data for tests
const seedTestData = async () => {
  const pool = getTestPool();
  const bcrypt = require('bcrypt');

  // Create test admin password hash
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const userPasswordHash = await bcrypt.hash('user123', 10);

  try {
    // Insert test admin (super admin)
    await pool.query(`
      INSERT INTO admins (email, password_hash, first_name, last_name, is_super_admin)
      VALUES ('admin@test.com', $1, 'Test', 'Admin', true)
      ON CONFLICT (email) DO NOTHING
    `, [adminPasswordHash]);

    // Insert regular admin (not super admin)
    await pool.query(`
      INSERT INTO admins (email, password_hash, first_name, last_name, is_super_admin)
      VALUES ('regularadmin@test.com', $1, 'Regular', 'Admin', false)
      ON CONFLICT (email) DO NOTHING
    `, [adminPasswordHash]);

    // Insert master_list entry
    await pool.query(`
      INSERT INTO master_list (section, last_name, first_name, current_name, email, status)
      VALUES ('A', 'User', 'Test', 'Test User', 'testuser@test.com', 'Invited')
      ON CONFLICT DO NOTHING
    `);

    // Insert test invites (using valid UUID format for invite_token)
    // Valid unused invite token: 550e8400-e29b-41d4-a716-446655440001
    // Used invite token: 550e8400-e29b-41d4-a716-446655440002
    await pool.query(`
      INSERT INTO invites (email, first_name, last_name, invite_token, used)
      VALUES
        ('newuser@test.com', 'New', 'User', '550e8400-e29b-41d4-a716-446655440001', false),
        ('useduser@test.com', 'Used', 'User', '550e8400-e29b-41d4-a716-446655440002', true)
      ON CONFLICT (email) DO NOTHING
    `);

    // Insert a registered test user
    const inviteResult = await pool.query(
      `SELECT id FROM invites WHERE email = 'useduser@test.com' LIMIT 1`
    );

    if (inviteResult.rows.length > 0) {
      await pool.query(`
        INSERT INTO users (invite_id, email, password_hash, first_name, last_name, city, country)
        VALUES ($1, 'testuser@test.com', $2, 'Test', 'User', 'Manila', 'Philippines')
        ON CONFLICT (email) DO NOTHING
      `, [inviteResult.rows[0].id, userPasswordHash]);
    }

    console.log('Test seed data inserted');
  } catch (err) {
    console.error('Error seeding test data:', err.message);
    throw err;
  }
};

// Truncate all tables (preserve structure, remove data)
const truncateTables = async () => {
  const pool = getTestPool();

  const tables = [
    'action_items',
    'event_rsvps',
    'events',
    'announcement_reads',
    'meeting_attachments',
    'meeting_minutes',
    'permissions',
    'password_resets',
    'announcements',
    'ledger',
    'rsvps',
    'users',
    'invites',
    'master_list',
    'admins',
    'volunteer_interests',
    'messages'
  ];

  try {
    // Disable foreign key checks temporarily
    await pool.query('SET session_replication_role = replica');

    for (const table of tables) {
      await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    }

    // Re-enable foreign key checks
    await pool.query('SET session_replication_role = DEFAULT');

    console.log('Test tables truncated');
  } catch (err) {
    console.error('Error truncating tables:', err.message);
    throw err;
  }
};

// Close all connections
const closeConnections = async () => {
  if (testPool) {
    await testPool.end();
    testPool = null;
    console.log('Test database connections closed');
  }
};

// Export helpers for use in tests
module.exports = {
  getTestPool,
  setupDatabase,
  seedTestData,
  truncateTables,
  closeConnections
};

// Global setup - runs once before all tests
beforeAll(async () => {
  await setupDatabase();
  await seedTestData();
});

// Global teardown - runs once after all tests
afterAll(async () => {
  await closeConnections();
});
