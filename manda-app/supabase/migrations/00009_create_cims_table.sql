-- Migration: 00009_create_cims_table
-- Description: Create CIMs (Confidential Information Memorandums) table
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables), #3 (RLS Policies)

-- Create CIMs table for Confidential Information Memorandums
CREATE TABLE IF NOT EXISTS cims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    version int NOT NULL DEFAULT 1,
    title text NOT NULL,
    content jsonb NOT NULL DEFAULT '{}',
    workflow_state text DEFAULT 'draft' CHECK (workflow_state IN ('draft', 'in_progress', 'review', 'completed')),
    export_formats text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cims_deal_id ON cims(deal_id);
CREATE INDEX IF NOT EXISTS idx_cims_user_id ON cims(user_id);

-- Create unique constraint for version per deal
CREATE UNIQUE INDEX IF NOT EXISTS idx_cims_deal_version ON cims(deal_id, version);

-- Enable Row Level Security
ALTER TABLE cims ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
CREATE POLICY cims_isolation_policy ON cims
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE cims IS 'Confidential Information Memorandums with versioning';
COMMENT ON COLUMN cims.version IS 'CIM version number (unique per deal)';
COMMENT ON COLUMN cims.content IS 'JSON content structure for CIM sections';
COMMENT ON COLUMN cims.workflow_state IS 'CIM creation workflow state';
COMMENT ON COLUMN cims.export_formats IS 'Array of available export formats (pdf, docx, etc.)';
