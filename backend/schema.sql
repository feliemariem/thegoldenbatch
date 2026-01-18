-- Alumni Homecoming Database Schema (Complete)
-- The Golden Batch - USLS-IS Batch 2003

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS action_items;
DROP TABLE IF EXISTS event_rsvps;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS announcement_reads;
DROP TABLE IF EXISTS action_items;
DROP TABLE IF EXISTS meeting_attachments;
DROP TABLE IF EXISTS meeting_minutes;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS ledger;
DROP TABLE IF EXISTS rsvps;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS master_list;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS volunteer_interests;

-- Admins table
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_super_admin BOOLEAN DEFAULT FALSE,
    role_title VARCHAR(100),                    -- Committee role (e.g., "Treasurer")
    sub_committees TEXT,                        -- Sub-committees (e.g., "Financial Controller, Fundraising")
    is_core_leader BOOLEAN DEFAULT FALSE,       -- If true, shows in top row on committee page
    display_order INT DEFAULT 99,               -- Lower number = shows first on committee page
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Master list table: all batch members for tracking
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

-- Invites table: the allow-list of emails
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

-- Users table: registered alumni
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RSVPs table (for main event)
CREATE TABLE rsvps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('going', 'not_going', 'maybe')) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledger table: financial tracking
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

-- Announcement reads table (tracks which users have read which announcements)
CREATE TABLE announcement_reads (
    id SERIAL PRIMARY KEY,
    announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(announcement_id, user_id)
);

-- Password resets table (for user password recovery)
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

-- Action Items table (for meeting tasks)
CREATE TABLE action_items (
    id SERIAL PRIMARY KEY,
    meeting_id INTEGER REFERENCES meeting_minutes(id) ON DELETE CASCADE,
    task TEXT NOT NULL,
    assignee_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'Not Started',
    priority VARCHAR(10) DEFAULT 'Medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table: pre-reunion gatherings and main event
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

-- Event RSVPs table: tracks who's going to which event
CREATE TABLE event_rsvps (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('going', 'interested', 'not_going')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
);

-- Admins table
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_super_admin BOOLEAN DEFAULT FALSE,
    role_title VARCHAR(100),                    -- Committee role (e.g., "Treasurer")
    sub_committees TEXT,                        -- Sub-committees (e.g., "Financial Controller, Fundraising")
    is_core_leader BOOLEAN DEFAULT FALSE,       -- If true, shows in top row on committee page
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volunteer interests table (tracks who wants to help with which role)
CREATE TABLE volunteer_interests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(100) NOT NULL,                 -- Role they're interested in (e.g., "Fundraising")
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)                       -- One interest per role per user
);



-- Indexes for performance
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
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_due_date ON action_items(due_date);
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
-- INITIAL DATA: Create System Super Admin
-- ============================================================
-- NOTE: After running schema, run setup-admin.js to set password:
--   node setup-admin.js uslsis.batch2003@gmail.com YOUR_PASSWORD
-- Then run this SQL to set as System super admin:
--   UPDATE admins SET first_name = 'Admin', last_name = '', is_super_admin = TRUE WHERE email = 'uslsis.batch2003@gmail.com';

-- ============================================================
-- CLEAN SLATE FOR TESTING (before public release)
-- ============================================================
-- Clear All Tables Except Master List & Super Admin:
--   DELETE FROM event_rsvps;
--   DELETE FROM events;
--   DELETE FROM announcement_reads;
--   DELETE FROM action_items;
--   DELETE FROM meeting_attachments;
--   DELETE FROM meeting_minutes;
--   DELETE FROM permissions;
--   DELETE FROM password_resets;
--   DELETE FROM announcements;
--   DELETE FROM ledger;
--   DELETE FROM rsvps;
--   DELETE FROM users;
--   DELETE FROM invites;
--   DELETE FROM admins WHERE is_super_admin = false;
-- Run this to wipe all test data while keeping master_list names, ledger, and Super Admin (id=1):
--
-- psql "YOUR_EXTERNAL_URL" -c "
-- DELETE FROM action_items;
-- DELETE FROM announcement_reads;
-- DELETE FROM meeting_attachments;
-- DELETE FROM meeting_minutes;
-- DELETE FROM permissions WHERE admin_id != 1;
-- DELETE FROM password_resets;
-- DELETE FROM announcements;
-- DELETE FROM rsvps;
-- DELETE FROM event_rsvps;
-- DELETE FROM events;
-- DELETE FROM users;
-- DELETE FROM invites;
-- DELETE FROM admins WHERE id != 1;
-- UPDATE master_list SET email = NULL, is_admin = FALSE, current_name = NULL, status = 'Not Invited';
-- UPDATE admins SET last_name = '' WHERE id = 1;
-- "

-- ============================================================
-- USEFUL COMMANDS
-- ============================================================
-- Reset Master List only (keep names, clear linked data):
--   UPDATE master_list SET
--     email = NULL,
--     current_name = NULL,
--     status = 'Not Invited',
--     is_admin = FALSE,
--     is_unreachable = FALSE
--   WHERE id > 0;

-- ============================================================
-- ADD NEW TABLES TO EXISTING DATABASE (without dropping)
-- ============================================================
-- If you already have data and just need to add the new columns/tables:
--
-- ALTER TABLE master_list RENAME COLUMN nickname TO current_name;
-- ALTER TABLE master_list ADD COLUMN status VARCHAR(50) DEFAULT 'Not Invited';
-- ALTER TABLE announcements ADD COLUMN audience VARCHAR(20) DEFAULT 'all';
--
-- CREATE TABLE action_items (
--     id SERIAL PRIMARY KEY,
--     meeting_id INTEGER REFERENCES meeting_minutes(id) ON DELETE CASCADE,
--     task TEXT NOT NULL,
--     assignee_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
--     due_date DATE,
--     status VARCHAR(20) DEFAULT 'Not Started',
--     priority VARCHAR(10) DEFAULT 'Medium',
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
--
-- CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
-- CREATE INDEX idx_action_items_assignee ON action_items(assignee_id);

-- ============================================================
-- COMMITTEE PAGE ORDERING
-- ============================================================
-- To arrange committee members on the Committee page:
-- Lower display_order = shows first
-- 
-- Example:
--   UPDATE admins SET display_order = 1 WHERE email = 'mary@example.com';      -- First
--   UPDATE admins SET display_order = 2 WHERE email = 'nikki@example.com';     -- Second
--   UPDATE admins SET display_order = 3 WHERE email = 'bianca@example.com';    -- Third
--   UPDATE admins SET display_order = 4 WHERE email = 'felie@example.com';     -- Fourth
--
-- Or view current order:
--   SELECT email, first_name, role_title, is_core_leader, display_order 
--   FROM admins 
--   WHERE role_title IS NOT NULL 
--   ORDER BY is_core_leader DESC, display_order ASC;