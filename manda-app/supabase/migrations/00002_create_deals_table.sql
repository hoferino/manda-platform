-- Migration: 00002_create_deals_table
-- Description: Create deals (projects) table with RLS policies
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables), #3 (RLS Policies), #7 (Data Validation)

-- Create deals table (main project entity)
CREATE TABLE IF NOT EXISTS deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    company_name text,
    industry text,
    deal_type text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    irl_template text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index on user_id for efficient RLS policy evaluation and queries
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);

-- Create index on status for filtered queries
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

-- Enable Row Level Security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
-- Users can only access their own deals (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY deals_isolation_policy ON deals
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE deals IS 'Stores M&A deal/project metadata with per-user data isolation via RLS';
COMMENT ON COLUMN deals.user_id IS 'Owner of the deal - enforced by RLS policy';
COMMENT ON COLUMN deals.status IS 'Deal status: active, archived, or completed';
