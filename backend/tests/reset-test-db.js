#!/usr/bin/env node

/**
 * Reset Test Database Script
 *
 * Truncates all tables and reseeds with minimal test data.
 * Run between test suites or when test data becomes corrupted.
 *
 * Usage: node tests/reset-test-db.js
 */

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.test') });

const DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/test_alumni_homecoming';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false
});

const TABLES = [
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

async function truncateAllTables() {
  console.log('Truncating all tables...');

  await pool.query('SET session_replication_role = replica');

  for (const table of TABLES) {
    await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    console.log(`  ✓ Truncated ${table}`);
  }

  await pool.query('SET session_replication_role = DEFAULT');
  console.log('All tables truncated.\n');
}

async function seedTestData() {
  console.log('Seeding test data...');

  // Generate password hashes
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Super Admin
  await pool.query(`
    INSERT INTO admins (email, password_hash, first_name, last_name, is_super_admin)
    VALUES ('superadmin@test.com', $1, 'Super', 'Admin', true)
  `, [passwordHash]);
  console.log('  ✓ Created super admin');

  // 2. Regular Admin
  await pool.query(`
    INSERT INTO admins (email, password_hash, first_name, last_name, is_super_admin)
    VALUES ('admin@test.com', $1, 'Regular', 'Admin', false)
  `, [passwordHash]);
  console.log('  ✓ Created regular admin');

  // 3. Master list entries
  await pool.query(`
    INSERT INTO master_list (section, last_name, first_name, current_name, email, status, is_admin)
    VALUES
      ('A', 'User', 'Test', 'Test User', 'testuser@test.com', 'Registered', false),
      ('A', 'Admin', 'Test', 'Test Admin', 'admin@test.com', 'Registered', true),
      ('B', 'Invitee', 'New', 'New Invitee', 'newinvitee@test.com', 'Invited', false)
  `);
  console.log('  ✓ Created master list entries');

  // 4. Test invites
  await pool.query(`
    INSERT INTO invites (email, first_name, last_name, invite_token, used, master_list_id)
    VALUES
      ('newuser@test.com', 'New', 'User', '550e8400-e29b-41d4-a716-446655440001', false, NULL),
      ('useduser@test.com', 'Used', 'User', '550e8400-e29b-41d4-a716-446655440002', true, 1)
  `);
  console.log('  ✓ Created test invites');

  // 5. Test user
  await pool.query(`
    INSERT INTO users (invite_id, email, password_hash, first_name, last_name, city, country)
    VALUES (2, 'testuser@test.com', $1, 'Test', 'User', 'Manila', 'Philippines')
  `, [passwordHash]);
  console.log('  ✓ Created test user');

  // 6. Set up permissions for regular admin
  const permissions = [
    'invites_add', 'invites_link', 'invites_upload', 'invites_export',
    'registered_export', 'masterlist_edit', 'masterlist_upload', 'masterlist_export',
    'announcements_view', 'announcements_send', 'accounting_view', 'accounting_edit',
    'accounting_export', 'minutes_view', 'minutes_edit', 'messages_view'
  ];

  for (const permission of permissions) {
    const enabled = ['invites_add', 'announcements_view', 'messages_view'].includes(permission);
    await pool.query(`
      INSERT INTO permissions (admin_id, permission, enabled)
      VALUES (2, $1, $2)
    `, [permission, enabled]);
  }
  console.log('  ✓ Set up admin permissions');

  console.log('\nTest data seeded successfully!');
}

async function main() {
  console.log('='.repeat(50));
  console.log('RESET TEST DATABASE');
  console.log('='.repeat(50));
  console.log(`Database: ${DATABASE_URL}\n`);

  try {
    await truncateAllTables();
    await seedTestData();

    console.log('\n' + '='.repeat(50));
    console.log('Database reset complete!');
    console.log('='.repeat(50));

    // Verify counts
    const adminCount = await pool.query('SELECT COUNT(*) FROM admins');
    const inviteCount = await pool.query('SELECT COUNT(*) FROM invites');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');

    console.log('\nVerification:');
    console.log(`  Admins: ${adminCount.rows[0].count}`);
    console.log(`  Invites: ${inviteCount.rows[0].count}`);
    console.log(`  Users: ${userCount.rows[0].count}`);

  } catch (err) {
    console.error('Error resetting database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
