-- Meeting Minutes Table
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  meeting_date DATE NOT NULL,
  attendees TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES admins(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meeting Attachments Table
CREATE TABLE IF NOT EXISTS meeting_attachments (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meeting_minutes(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_date ON meeting_minutes(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_attachments_meeting ON meeting_attachments(meeting_id);
