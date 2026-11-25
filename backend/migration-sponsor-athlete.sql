-- Sponsor an Athlete (Doomsday, Cinema 4). Safe to run more than once.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_sponsor BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS sponsor_type TEXT;
