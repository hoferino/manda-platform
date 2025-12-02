-- Migration: 00026_enhance_irl_items_table
-- Description: Add priority, status, subcategory, and notes columns to irl_items table
-- Story: E6.2 - Implement IRL Creation and Editing
-- AC: Support full IRL item CRUD with priority, status tracking, and notes

-- Add new columns to irl_items table
ALTER TABLE irl_items
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'pending', 'received', 'complete')),
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Rename 'name' column to 'item_name' for consistency with IRLItem type
-- Note: If 'name' doesn't exist or 'item_name' already exists, this may error
-- We'll handle this gracefully
DO $$
BEGIN
    -- Check if 'name' column exists and 'item_name' doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'irl_items' AND column_name = 'name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'irl_items' AND column_name = 'item_name'
    ) THEN
        ALTER TABLE irl_items RENAME COLUMN name TO item_name;
    END IF;
END $$;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_irl_items_status ON irl_items(status);

-- Create index on priority for filtering
CREATE INDEX IF NOT EXISTS idx_irl_items_priority ON irl_items(priority);

-- Add comments for documentation
COMMENT ON COLUMN irl_items.priority IS 'Priority level: high, medium, low';
COMMENT ON COLUMN irl_items.status IS 'Fulfillment status: not_started, pending, received, complete';
COMMENT ON COLUMN irl_items.subcategory IS 'Optional sub-grouping within category';
COMMENT ON COLUMN irl_items.notes IS 'Optional notes or comments for this item';
