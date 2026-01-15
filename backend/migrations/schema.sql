-- Alumni Homecoming Database Schema (Complete)
-- The Golden Batch - USLS-IS Batch 2003

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS meeting_attachments;
DROP TABLE IF EXISTS meeting_minutes;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS ledger;
DROP TABLE IF EXISTS rsvps;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS master_list;
DROP TABLE IF EXISTS admins;

-- Admins table
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Master list table: all batch members for tracking
CREATE TABLE master_list (
    id SERIAL PRIMARY KEY,
    section VARCHAR(50) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100),
    email VARCHAR(255),
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

-- RSVPs table
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
    audience VARCHAR(50) NOT NULL,
    recipients_count INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    sent_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id),
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
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
CREATE INDEX idx_reset_tokens ON password_reset_tokens(token);