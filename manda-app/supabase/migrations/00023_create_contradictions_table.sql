-- Migration: 00023_create_contradictions_table
-- Description: Create contradictions table for tracking conflicting findings
-- Story: E4.6 - Build Contradictions View
-- AC: #9 (API Endpoints - Database migration to create contradictions table)

-- Create contradictions table for tracking conflicting findings pairs
CREATE TABLE IF NOT EXISTS contradictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    finding_a_id uuid REFERENCES findings(id) ON DELETE CASCADE NOT NULL,
    finding_b_id uuid REFERENCES findings(id) ON DELETE CASCADE NOT NULL,
    confidence float CHECK (confidence >= 0 AND confidence <= 1),
    status varchar(20) DEFAULT 'unresolved',  -- unresolved, resolved, noted, investigating
    resolution varchar(20),  -- accept_a, accept_b, noted, investigating
    resolution_note text,
    detected_at timestamptz DEFAULT now() NOT NULL,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id),
    metadata jsonb DEFAULT '{}',

    -- Ensure finding_a_id and finding_b_id are different
    CONSTRAINT different_findings CHECK (finding_a_id != finding_b_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_contradictions_deal_id ON contradictions(deal_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_status ON contradictions(status);
CREATE INDEX IF NOT EXISTS idx_contradictions_deal_status ON contradictions(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_contradictions_finding_a ON contradictions(finding_a_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_finding_b ON contradictions(finding_b_id);

-- Enable Row Level Security
ALTER TABLE contradictions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policy for data isolation (idempotent)
-- User can only see contradictions for deals they own
DROP POLICY IF EXISTS contradictions_isolation_policy ON contradictions;
CREATE POLICY contradictions_isolation_policy ON contradictions
    FOR ALL
    USING (
        deal_id IN (
            SELECT id FROM deals WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        deal_id IN (
            SELECT id FROM deals WHERE user_id = auth.uid()
        )
    );

-- Add comments for documentation
COMMENT ON TABLE contradictions IS 'Pairs of conflicting findings detected in deal documents';
COMMENT ON COLUMN contradictions.finding_a_id IS 'First finding in the contradiction pair';
COMMENT ON COLUMN contradictions.finding_b_id IS 'Second finding in the contradiction pair';
COMMENT ON COLUMN contradictions.confidence IS 'Confidence score for the contradiction detection (0-1)';
COMMENT ON COLUMN contradictions.status IS 'Resolution status: unresolved, resolved, noted, investigating';
COMMENT ON COLUMN contradictions.resolution IS 'Resolution action taken: accept_a, accept_b, noted, investigating';
COMMENT ON COLUMN contradictions.resolution_note IS 'User-provided note explaining resolution or investigation reason';
COMMENT ON COLUMN contradictions.resolved_by IS 'User who resolved the contradiction';
COMMENT ON COLUMN contradictions.metadata IS 'Additional metadata (detection reason, neo4j relationship ID, etc.)';
