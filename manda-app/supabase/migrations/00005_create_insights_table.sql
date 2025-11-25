-- Migration: 00005_create_insights_table
-- Description: Create insights table for analyzed patterns
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables), #3 (RLS Policies)

-- Create insights table for analyzed patterns and cross-document intelligence
CREATE TABLE IF NOT EXISTS insights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    insight_type text NOT NULL CHECK (insight_type IN ('pattern', 'contradiction', 'risk', 'opportunity', 'summary')),
    title text,
    text text NOT NULL,
    confidence float CHECK (confidence >= 0 AND confidence <= 1),
    source_finding_ids uuid[],
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_insights_deal_id ON insights(deal_id);
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);

-- Enable Row Level Security
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
CREATE POLICY insights_isolation_policy ON insights
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE insights IS 'AI-generated insights and patterns discovered across documents';
COMMENT ON COLUMN insights.insight_type IS 'Type of insight: pattern, contradiction, risk, opportunity, summary';
COMMENT ON COLUMN insights.source_finding_ids IS 'Array of finding IDs that support this insight';
