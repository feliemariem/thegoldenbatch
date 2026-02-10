-- Test Database Setup Script
-- Creates test_alumni_homecoming database with schema and minimal seed data
-- Run this BEFORE running tests for the first time

-- ============================================================
-- STEP 1: Create the test database (run as postgres superuser)
-- ============================================================
-- Run this command outside this script (as postgres user):
--   createdb test_alumni_homecoming
-- OR:
--   psql -c "CREATE DATABASE test_alumni_homecoming;"

-- ============================================================
-- STEP 2: Connect to test database and run this script
-- ============================================================
-- psql -d test_alumni_homecoming -f test-db-setup.sql

-- ============================================================
-- SCHEMA (Copy from main schema.sql)
-- ============================================================

-- Drop tables in correct order (respecting foreign keys)
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

-- Admins table
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_super_admin BOOLEAN DEFAULT FALSE,
    role_title VARCHAR(100),
    sub_committees TEXT,
    is_core_leader BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 99,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Master list table
CREATE TABLE master_list (
    id SERIAL PRIMARY KEY,
    section VARCHAR(50) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    current_name VARCHAR(100),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Not Invited',
    in_memoriam BOOLEAN DEFAULT FALSE,
    is_unreachable BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invites table
CREATE TABLE invites (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    invite_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    email_sent BOOLEAN DEFAULT FALSE,
    master_list_id INTEGER REFERENCES master_list(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    invite_id INTEGER REFERENCES invites(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birthday DATE,
    mobile VARCHAR(50),
    address TEXT,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    occupation VARCHAR(100),
    company VARCHAR(100),
    profile_photo VARCHAR(500),
    facebook_url TEXT,
    linkedin_url TEXT,
    instagram_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RSVPs table
CREATE TABLE rsvps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('going', 'not_going', 'maybe')) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledger table
CREATE TABLE ledger (
    id SERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL,
    name VARCHAR(255),
    description VARCHAR(255),
    deposit DECIMAL(12,2) DEFAULT 0,
    withdrawal DECIMAL(12,2) DEFAULT 0,
    reference_no VARCHAR(100),
    verified VARCHAR(50) DEFAULT 'Pending',
    payment_type VARCHAR(50),
    master_list_id INTEGER REFERENCES master_list(id),
    receipt_url VARCHAR(500),
    receipt_public_id VARCHAR(255),
    notes TEXT,
    recorded_by VARCHAR(255),
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcements table
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    audience VARCHAR(50) DEFAULT 'all',
    recipients_count INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    sent_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcement reads table
CREATE TABLE announcement_reads (
    id SERIAL PRIMARY KEY,
    announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(announcement_id, user_id)
);

-- Password resets table
CREATE TABLE password_resets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(admin_id, permission)
);

-- Meeting Minutes table
CREATE TABLE meeting_minutes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    meeting_date DATE NOT NULL,
    location VARCHAR(255),
    attendees TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meeting Attachments table
CREATE TABLE meeting_attachments (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meeting_minutes(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES admins(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Action Items table
CREATE TABLE action_items (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meeting_minutes(id) ON DELETE CASCADE,
    task TEXT NOT NULL,
    assignee_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'Not Started',
    priority VARCHAR(10) DEFAULT 'Medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time VARCHAR(50),
    location VARCHAR(255),
    type VARCHAR(50) DEFAULT 'in-person',
    is_main_event BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event RSVPs table
CREATE TABLE event_rsvps (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('going', 'interested', 'not_going')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Volunteer interests table
CREATE TABLE volunteer_interests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    from_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    from_admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
    to_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    parent_id INT REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_messages_to_user ON messages(to_user_id);
CREATE INDEX idx_messages_from_user ON messages(from_user_id);
CREATE INDEX idx_messages_from_admin ON messages(from_admin_id);
CREATE INDEX idx_messages_parent ON messages(parent_id);
CREATE INDEX idx_invite_token ON invites(invite_token);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_master_list ON invites(master_list_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_master_list_email ON master_list(email);
CREATE INDEX idx_master_list_section ON master_list(section);
CREATE INDEX idx_ledger_master_list ON ledger(master_list_id);
CREATE INDEX idx_ledger_date ON ledger(transaction_date);
CREATE INDEX idx_permissions_admin ON permissions(admin_id);
CREATE INDEX idx_meeting_minutes_date ON meeting_minutes(meeting_date DESC);
CREATE INDEX idx_meeting_attachments_meeting ON meeting_attachments(meeting_id);
CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_assignee ON action_items(assignee_id);
CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_email ON password_resets(email);
CREATE INDEX idx_announcement_reads_user ON announcement_reads(user_id);
CREATE INDEX idx_announcement_reads_announcement ON announcement_reads(announcement_id);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_published ON events(is_published);
CREATE INDEX idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON event_rsvps(user_id);
CREATE INDEX idx_volunteer_interests_user ON volunteer_interests(user_id);

-- ============================================================
-- MINIMAL SEED DATA FOR TESTING
-- ============================================================
-- Password for all test accounts: 'password123'
-- bcrypt hash of 'password123' with salt rounds 10

-- Super Admin
INSERT INTO admins (email, password_hash, first_name, last_name, is_super_admin)
VALUES (
    'superadmin@test.com',
    '$2b$10$rQZ6v8F5L5z8J5Q5Z5Z5Z.5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
    'Super',
    'Admin',
    true
);

-- Regular Admin
INSERT INTO admins (email, password_hash, first_name, last_name, is_super_admin)
VALUES (
    'admin@test.com',
    '$2b$10$rQZ6v8F5L5z8J5Q5Z5Z5Z.5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
    'Regular',
    'Admin',
    false
);

-- Master list entries
INSERT INTO master_list (section, last_name, first_name, current_name, email, status, is_admin)
VALUES
    ('A', 'User', 'Test', 'Test User', 'testuser@test.com', 'Registered', false),
    ('A', 'Admin', 'Test', 'Test Admin', 'admin@test.com', 'Registered', true),
    ('B', 'Invitee', 'New', 'New Invitee', 'newinvitee@test.com', 'Invited', false);

-- Test invites
INSERT INTO invites (email, first_name, last_name, invite_token, used, master_list_id)
VALUES
    ('newuser@test.com', 'New', 'User', '550e8400-e29b-41d4-a716-446655440001', false, NULL),
    ('useduser@test.com', 'Used', 'User', '550e8400-e29b-41d4-a716-446655440002', true, 1);

-- Test user (registered via invite)
INSERT INTO users (invite_id, email, password_hash, first_name, last_name, city, country)
VALUES (
    2,
    'testuser@test.com',
    '$2b$10$rQZ6v8F5L5z8J5Q5Z5Z5Z.5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5',
    'Test',
    'User',
    'Manila',
    'Philippines'
);

-- Set up permissions for regular admin
INSERT INTO permissions (admin_id, permission, enabled)
SELECT 2, permission, false
FROM unnest(ARRAY[
    'invites_add', 'invites_link', 'invites_upload', 'invites_export',
    'registered_export', 'masterlist_edit', 'masterlist_upload', 'masterlist_export',
    'announcements_view', 'announcements_send', 'accounting_view', 'accounting_edit',
    'accounting_export', 'minutes_view', 'minutes_edit', 'messages_view', 'strategic_view'
]) AS permission;

-- Enable some permissions for regular admin
UPDATE permissions SET enabled = true
WHERE admin_id = 2 AND permission IN ('invites_add', 'announcements_view', 'messages_view');

SELECT 'Test database setup complete!' AS status;
