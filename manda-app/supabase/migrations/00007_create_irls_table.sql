-- Migration: 00007_create_irls_table
-- Description: Create IRLs (Information Request Lists) table
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables), #3 (RLS Policies)

-- Create IRLs table for Information Request Lists
CREATE TABLE IF NOT EXISTS irls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    template_type text,
    sections jsonb NOT NULL DEFAULT '[]',
    progress_percent int DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_irls_deal_id ON irls(deal_id);
CREATE INDEX IF NOT EXISTS idx_irls_user_id ON irls(user_id);

-- Enable Row Level Security
ALTER TABLE irls ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
CREATE POLICY irls_isolation_policy ON irls
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE irls IS 'Information Request Lists for M&A due diligence';
COMMENT ON COLUMN irls.sections IS 'JSON array of IRL sections with items and document links';
COMMENT ON COLUMN irls.template_type IS 'Template used to create this IRL (e.g., standard, tech, financial)';
COMMENT ON COLUMN irls.progress_percent IS 'Completion percentage based on linked documents';
