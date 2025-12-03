-- Migration: 00027_add_fulfilled_to_irl_items
-- Description: Add fulfilled boolean column for simple checkbox tracking
-- Story: E6.5 - Implement IRL-Document Linking and Progress Tracking
-- AC: Support binary fulfilled/unfulfilled status for manual checkbox tracking

-- Add fulfilled column with default false
ALTER TABLE irl_items
ADD COLUMN IF NOT EXISTS fulfilled BOOLEAN DEFAULT false NOT NULL;

-- Migrate existing status data: 'complete' -> fulfilled=true, others -> fulfilled=false
UPDATE irl_items
SET fulfilled = CASE
    WHEN status = 'complete' THEN true
    ELSE false
END
WHERE fulfilled IS NULL OR fulfilled = false;

-- Create index for filtering fulfilled items
CREATE INDEX IF NOT EXISTS idx_irl_items_fulfilled ON irl_items(fulfilled);

-- Add comment for documentation
COMMENT ON COLUMN irl_items.fulfilled IS 'Whether this IRL item has been manually marked as fulfilled by the user';
