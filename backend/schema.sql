-- Alumni Homecoming Database Schema (Complete)
-- The Golden Batch - USLS IS Batch 2003

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS batch_rep_submissions;
DROP TABLE IF EXISTS site_config;
DROP TABLE IF EXISTS action_items;
DROP TABLE IF EXISTS event_rsvps;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS announcement_reads;
DROP TABLE IF EXISTS meeting_attachments;
DROP TABLE IF EXISTS meeting_minutes;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS receipt_uploads;
DROP TABLE IF EXISTS ledger;
DROP TABLE IF EXISTS rsvps;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS master_list;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS volunteer_interests;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS summary_snapshots;

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
    builder_tier VARCHAR(20),
    pledge_amount DECIMAL(12,2),
    builder_tier_set_at TIMESTAMP,
    recognition_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_builder_tier CHECK (builder_tier IS NULL OR builder_tier IN ('cornerstone', 'pillar', 'anchor', 'root'))
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
    email_status VARCHAR(20) DEFAULT 'sent',
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
    shirt_size VARCHAR(10),
    jacket_size VARCHAR(10),
    has_alumni_card BOOLEAN DEFAULT false,
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

-- Receipt uploads table
CREATE TABLE receipt_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    master_list_id INTEGER REFERENCES master_list(id),
    image_url VARCHAR(500) NOT NULL,
    image_public_id VARCHAR(255),
    note TEXT,
    status VARCHAR(20) DEFAULT 'submitted',
    source VARCHAR(10) DEFAULT 'user',
    is_duplicate BOOLEAN DEFAULT FALSE,
    ledger_id INTEGER REFERENCES ledger(id) ON DELETE SET NULL,
    processed_by INTEGER REFERENCES admins(id),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Summary snapshots table
CREATE TABLE summary_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    snapshot_type VARCHAR(10) NOT NULL,
    registered_count INTEGER DEFAULT 0,
    invited_count INTEGER DEFAULT 0,
    total_raised DECIMAL(12,2) DEFAULT 0,
    cornerstone_count INTEGER DEFAULT 0,
    pillar_count INTEGER DEFAULT 0,
    anchor_count INTEGER DEFAULT 0,
    root_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- NEW: Site Config table (global key-value settings)
-- ============================================================
CREATE TABLE site_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Batch rep page state: 'active', 'closed', 'published'
-- Only system admin (id=1) can update these values
INSERT INTO site_config (key, value) VALUES ('batch_rep_status', 'active');
INSERT INTO site_config (key, value) VALUES ('batch_rep_enabled_emails', 'felie@fnrcore.com');

-- ============================================================
-- NEW: Batch Rep Submissions table
-- ============================================================
CREATE TABLE batch_rep_submissions (
    id SERIAL PRIMARY KEY,
    voter_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    selection VARCHAR(20) CHECK (selection IN ('confirm', 'nominate')) NOT NULL,
    nominee_name VARCHAR(255),
    nominee_master_list_id INTEGER REFERENCES master_list(id),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- NEW: Batch Rep Willingness table
-- Tracks whether graduates are willing to serve if nominated
-- ============================================================
CREATE TABLE batch_rep_willingness (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    willing BOOLEAN NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_messages_to_user ON messages(to_user_id);
CREATE INDEX idx_messages_from_user ON messages(from_user_id);
CREATE INDEX idx_messages_from_admin ON messages(from_admin_id);
CREATE INDEX idx_messages_parent ON messages(parent_id);
CREATE INDEX idx_receipt_uploads_user ON receipt_uploads(user_id);
CREATE INDEX idx_receipt_uploads_master_list ON receipt_uploads(master_list_id);
CREATE INDEX idx_receipt_uploads_status ON receipt_uploads(status);
CREATE INDEX idx_receipt_uploads_ledger ON receipt_uploads(ledger_id);
CREATE INDEX idx_invite_token ON invites(invite_token);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_master_list ON invites(master_list_id);
CREATE INDEX idx_invites_email_status ON invites(email_status);
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
CREATE INDEX idx_summary_snapshots_date ON summary_snapshots(snapshot_date DESC);
CREATE INDEX idx_summary_snapshots_type ON summary_snapshots(snapshot_type);
CREATE INDEX idx_batch_rep_submissions_voter ON batch_rep_submissions(voter_id);
CREATE INDEX idx_batch_rep_willingness_user ON batch_rep_willingness(user_id);
CREATE INDEX idx_batch_rep_willingness_willing ON batch_rep_willingness(willing);

CREATE UNIQUE INDEX idx_ledger_reference_no_unique 
  ON ledger(reference_no) 
  WHERE reference_no IS NOT NULL AND reference_no != '';


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
-- Run this to wipe all test data while keeping master_list names, ledger, and Super Admin (id=1):
--
-- psql "YOUR_EXTERNAL_URL" -c "
-- DELETE FROM batch_rep_submissions;
-- DELETE FROM action_items;
-- DELETE FROM announcement_reads;
-- DELETE FROM meeting_attachments;
-- DELETE FROM meeting_minutes;
-- DELETE FROM messages;
-- DELETE FROM volunteer_interests;
-- DELETE FROM permissions WHERE admin_id != 1;
-- DELETE FROM password_resets;
-- DELETE FROM announcements;
-- DELETE FROM receipt_uploads;
-- DELETE FROM rsvps;
-- DELETE FROM event_rsvps;
-- DELETE FROM events;
-- DELETE FROM users;
-- DELETE FROM invites;
-- DELETE FROM admins WHERE id != 1;
-- UPDATE master_list SET
--   email = NULL,
--   current_name = NULL,
--   status = 'Not Invited',
--   is_admin = FALSE,
--   is_unreachable = FALSE,
--   builder_tier = NULL,
--   pledge_amount = NULL,
--   builder_tier_set_at = NULL
-- WHERE id > 0;
-- "

-- ============================================================
-- ADD NEW TABLES TO EXISTING DATABASE (without dropping)
-- ============================================================
-- If you already have data and just need to add the new tables:
--
-- CREATE TABLE IF NOT EXISTS site_config (
--     id SERIAL PRIMARY KEY,
--     key VARCHAR(100) UNIQUE NOT NULL,
--     value TEXT NOT NULL,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
--
-- INSERT INTO site_config (key, value) VALUES ('batch_rep_status', 'active') ON CONFLICT (key) DO NOTHING;
-- INSERT INTO site_config (key, value) VALUES ('batch_rep_enabled_emails', 'felie@fnrcore.com') ON CONFLICT (key) DO NOTHING;
--
-- CREATE TABLE IF NOT EXISTS batch_rep_submissions (
--     id SERIAL PRIMARY KEY,
--     voter_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
--     selection VARCHAR(20) CHECK (selection IN ('confirm', 'nominate')) NOT NULL,
--     nominee_name VARCHAR(255),
--     comments TEXT,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_batch_rep_submissions_voter ON batch_rep_submissions(voter_id);

-- ============================================================
-- MIGRATION: Builder Tiers + Receipt Uploads (for existing databases)
-- ============================================================
-- ALTER TABLE master_list ADD COLUMN IF NOT EXISTS builder_tier VARCHAR(20);
-- ALTER TABLE master_list ADD COLUMN IF NOT EXISTS pledge_amount DECIMAL(12,2);
-- ALTER TABLE master_list ADD COLUMN IF NOT EXISTS builder_tier_set_at TIMESTAMP;
-- ALTER TABLE master_list ADD CONSTRAINT valid_builder_tier
--   CHECK (builder_tier IS NULL OR builder_tier IN ('cornerstone', 'pillar', 'anchor', 'root'));

-- ============================================================
-- CLEANUP DUPLICATE PERMISSIONS
-- ============================================================
-- DELETE FROM permissions a USING permissions b
-- WHERE a.id < b.id AND a.admin_id = b.admin_id;

-- ============================================================
-- COMMITTEE PAGE ORDERING
-- ============================================================
-- UPDATE admins SET display_order = 1 WHERE email = 'mary@example.com';
-- UPDATE admins SET display_order = 2 WHERE email = 'nikki@example.com';
-- SELECT email, first_name, role_title, is_core_leader, display_order 
-- FROM admins 
-- WHERE role_title IS NOT NULL 
-- ORDER BY is_core_leader DESC, display_order ASC;

-- CREATE TABLE IF NOT EXISTS batch_rep_willingness (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
--     willing BOOLEAN NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ DEFAULT NOW()
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_batch_rep_willingness_user ON batch_rep_willingness(user_id);
-- CREATE INDEX IF NOT EXISTS idx_batch_rep_willingness_willing ON batch_rep_willingness(willing);