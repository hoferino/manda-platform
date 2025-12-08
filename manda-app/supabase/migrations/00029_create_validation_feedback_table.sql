-- Migration: 00029_create_validation_feedback_table
-- Description: Create validation_feedback table for tracking finding validations/rejections
-- Story: E7.2 - Track Validation/Rejection Feedback
-- AC: #2 (record validations), #3 (record rejections with reason)

-- Create validation_feedback table for append-only validation/rejection audit trail
CREATE TABLE IF NOT EXISTS validation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID REFERENCES findings(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('validate', 'reject')),
    reason TEXT,
    analyst_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_validation_feedback_finding ON validation_feedback(finding_id);
CREATE INDEX IF NOT EXISTS idx_validation_feedback_action ON validation_feedback(action);
CREATE INDEX IF NOT EXISTS idx_validation_feedback_analyst ON validation_feedback(analyst_id);
CREATE INDEX IF NOT EXISTS idx_validation_feedback_created ON validation_feedback(created_at DESC);

-- Create aggregation view for confidence adjustment calculations
-- This view provides quick access to validation/rejection counts per finding
CREATE OR REPLACE VIEW finding_validation_stats AS
SELECT
    finding_id,
    COUNT(*) FILTER (WHERE action = 'validate') AS validation_count,
    COUNT(*) FILTER (WHERE action = 'reject') AS rejection_count,
    COUNT(*) AS total_feedback
FROM validation_feedback
GROUP BY finding_id;

-- Enable Row Level Security
ALTER TABLE validation_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view feedback for findings in their deals
CREATE POLICY "Users can view feedback for their deals" ON validation_feedback
    FOR SELECT USING (
        finding_id IN (
            SELECT id FROM findings WHERE deal_id IN (
                SELECT id FROM deals WHERE user_id = auth.uid()
            )
        )
    );

-- RLS Policy: Users can insert feedback for findings in their deals (append-only)
CREATE POLICY "Users can insert feedback for their deals" ON validation_feedback
    FOR INSERT WITH CHECK (
        finding_id IN (
            SELECT id FROM findings WHERE deal_id IN (
                SELECT id FROM deals WHERE user_id = auth.uid()
            )
        )
        AND analyst_id = auth.uid()
    );

-- Note: No UPDATE or DELETE policies - this table is append-only for compliance/audit

-- Add comments for documentation
COMMENT ON TABLE validation_feedback IS 'Append-only audit trail of finding validation and rejection actions';
COMMENT ON COLUMN validation_feedback.action IS 'Feedback action: validate (confirm accuracy) or reject (mark as inaccurate)';
COMMENT ON COLUMN validation_feedback.reason IS 'Optional reason for rejection (required context for improving accuracy)';
COMMENT ON VIEW finding_validation_stats IS 'Aggregated view of validation/rejection counts per finding for confidence adjustment';
