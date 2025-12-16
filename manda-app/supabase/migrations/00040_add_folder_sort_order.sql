-- Migration: 00040_add_folder_sort_order
-- Description: Add sort_order column to folders table for user-defined folder ordering
-- TD-011.2: Implement folder drag-and-drop reordering

-- Add sort_order column
ALTER TABLE folders ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Update existing folders with sequential sort_order based on creation order
-- Folders within the same parent get sequential numbers
WITH ordered_folders AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY deal_id, COALESCE(parent_path, '')
            ORDER BY created_at ASC
        ) - 1 as new_order
    FROM folders
)
UPDATE folders f
SET sort_order = of.new_order
FROM ordered_folders of
WHERE f.id = of.id;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_folders_sort_order ON folders(deal_id, parent_path, sort_order);

-- Add comment
COMMENT ON COLUMN folders.sort_order IS 'User-defined display order within parent folder (lower = higher in list)';
