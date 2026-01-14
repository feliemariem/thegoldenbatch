-- Alumni Homecoming Database Schema

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS rsvps;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS invites;

-- Invites table: the allow-list of emails
CREATE TABLE invites (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    invite_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
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

-- Admin user for dashboard access (optional, can also use a flag on users table)
CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster token lookups
CREATE INDEX idx_invite_token ON invites(invite_token);

-- Master list table: all batch members for tracking
CREATE TABLE master_list (
    id SERIAL PRIMARY KEY,
    section VARCHAR(20) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_master_list_email ON master_list(email);
CREATE INDEX idx_master_list_section ON master_list(section);
