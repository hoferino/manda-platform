-- Migration: 00020_create_folders_table
-- Description: Create folders table for persistent folder/bucket structure
-- This enables empty folders to exist and be managed independently of documents

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,  -- Full path like "Financial/Q1 2024"
    parent_path TEXT,    -- Parent folder path, NULL for root folders (buckets)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure unique paths per deal
    CONSTRAINT unique_folder_path_per_deal UNIQUE (deal_id, path)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_folders_deal_id ON folders(deal_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_path ON folders(deal_id, parent_path);
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view folders for deals they own
CREATE POLICY "Users can view folders for their deals"
    ON folders
    FOR SELECT
    USING (
        deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
    );

-- RLS Policy: Users can create folders for their deals
CREATE POLICY "Users can create folders for their deals"
    ON folders
    FOR INSERT
    WITH CHECK (
        deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
    );

-- RLS Policy: Users can update folders for their deals
CREATE POLICY "Users can update folders for their deals"
    ON folders
    FOR UPDATE
    USING (
        deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
    );

-- RLS Policy: Users can delete folders for their deals
CREATE POLICY "Users can delete folders for their deals"
    ON folders
    FOR DELETE
    USING (
        deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
    );

-- Add updated_at trigger
CREATE TRIGGER set_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE folders IS 'Persistent folder structure for data room (buckets are root folders)';
COMMENT ON COLUMN folders.path IS 'Full folder path like "Financial/Q1 Reports"';
COMMENT ON COLUMN folders.parent_path IS 'Parent folder path, NULL for root-level folders (buckets)';
