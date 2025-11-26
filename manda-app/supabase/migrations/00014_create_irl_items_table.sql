-- Migration: 00014_create_irl_items_table
-- Description: Create irl_items table for normalized IRL structure with document linking
-- Story: E2.8 - Implement IRL Integration with Document Tracking
-- AC: Support IRL checklist with document linking for progress tracking

-- Create irl_items table for individual IRL checklist items
CREATE TABLE IF NOT EXISTS irl_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    irl_id uuid REFERENCES irls(id) ON DELETE CASCADE NOT NULL,
    category text NOT NULL,
    name text NOT NULL,
    description text,
    required boolean DEFAULT true,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_irl_items_irl_id ON irl_items(irl_id);
CREATE INDEX IF NOT EXISTS idx_irl_items_category ON irl_items(irl_id, category);

-- Enable Row Level Security
ALTER TABLE irl_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can access items for IRLs they own
CREATE POLICY irl_items_isolation_policy ON irl_items
    FOR ALL
    USING (
        irl_id IN (SELECT id FROM irls WHERE user_id = auth.uid())
    )
    WITH CHECK (
        irl_id IN (SELECT id FROM irls WHERE user_id = auth.uid())
    );

-- Add irl_item_id to documents for linking
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS irl_item_id uuid REFERENCES irl_items(id) ON DELETE SET NULL;

-- Create index for document-IRL item queries
CREATE INDEX IF NOT EXISTS idx_documents_irl_item_id ON documents(irl_item_id);

-- Add trigger for irl_items updated_at
CREATE TRIGGER set_irl_items_updated_at
    BEFORE UPDATE ON irl_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE irl_items IS 'Individual items within an IRL checklist for document tracking';
COMMENT ON COLUMN irl_items.category IS 'Category/section grouping (e.g., Financial, Legal, Commercial)';
COMMENT ON COLUMN irl_items.name IS 'Name of the requested document/item';
COMMENT ON COLUMN irl_items.description IS 'Optional detailed description of what is needed';
COMMENT ON COLUMN irl_items.required IS 'Whether this item is required or optional';
COMMENT ON COLUMN irl_items.sort_order IS 'Display order within category';
COMMENT ON COLUMN documents.irl_item_id IS 'Link to IRL item this document fulfills';
