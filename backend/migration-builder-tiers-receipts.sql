-- ============================================================
-- MIGRATION: Builder Tiers + Receipt Uploads
-- The Golden Batch - USLS-IS Batch 2003
-- Run against external database via psql
-- ============================================================

-- 1. Add builder tier columns to master_list table
ALTER TABLE master_list ADD COLUMN IF NOT EXISTS builder_tier VARCHAR(20);
ALTER TABLE master_list ADD COLUMN IF NOT EXISTS pledge_amount DECIMAL(12,2);
ALTER TABLE master_list ADD COLUMN IF NOT EXISTS builder_tier_set_at TIMESTAMP;

-- Add CHECK constraint for valid tier values
ALTER TABLE master_list DROP CONSTRAINT IF EXISTS valid_builder_tier;
ALTER TABLE master_list ADD CONSTRAINT valid_builder_tier 
  CHECK (builder_tier IS NULL OR builder_tier IN ('cornerstone', 'pillar', 'anchor', 'root'));

-- 2. Create receipt_uploads table
CREATE TABLE IF NOT EXISTS receipt_uploads (
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

-- 3. Indexes for receipt_uploads
CREATE INDEX IF NOT EXISTS idx_receipt_uploads_user ON receipt_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_uploads_master_list ON receipt_uploads(master_list_id);
CREATE INDEX IF NOT EXISTS idx_receipt_uploads_status ON receipt_uploads(status);
CREATE INDEX IF NOT EXISTS idx_receipt_uploads_ledger ON receipt_uploads(ledger_id);

-- 4. Unique index on ledger.reference_no for dedup (non-null, non-empty only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_reference_no_unique 
  ON ledger(reference_no) 
  WHERE reference_no IS NOT NULL AND reference_no != '';

-- ============================================================
-- VERIFY: Run these after migration to confirm
-- ============================================================
-- \d master_list     -- should show builder_tier, pledge_amount, builder_tier_set_at
-- \d receipt_uploads -- should show full table
-- \di idx_ledger_reference_no_unique -- should exist