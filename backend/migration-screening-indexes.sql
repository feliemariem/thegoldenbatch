-- Migration: Add indexes for movie screening tables
-- Run this on your production database to improve query performance
-- These indexes cover the "seats left" queries that run on every page load

-- Main index for seats_left calculation and reservation lookups
-- Covers: /active endpoint (seats left), /reserve (held seats check), /admin/stats
CREATE INDEX IF NOT EXISTS idx_reservations_event_cinema_status
  ON reservations(event_id, cinema_code, status);

-- Index for fetching cinemas by event
CREATE INDEX IF NOT EXISTS idx_event_cinemas_event
  ON event_cinemas(event_id);

-- Index for finding active screening events
CREATE INDEX IF NOT EXISTS idx_screening_events_status
  ON screening_events(status);

-- Index for reservation created_at ordering (admin tracker sorted by date)
CREATE INDEX IF NOT EXISTS idx_reservations_created_at
  ON reservations(created_at DESC);

-- Verify indexes were created:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE tablename IN ('reservations', 'event_cinemas', 'screening_events');
