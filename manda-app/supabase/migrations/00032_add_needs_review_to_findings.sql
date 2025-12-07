-- Migration: 00032_add_needs_review_to_findings
-- Description: Add needs_review column to findings for correction propagation
-- Story: E7.1 - Implement Finding Correction via Chat
-- AC: #5 (Related insights flagged for review)

-- Add needs_review column for flagging findings that need analyst attention
ALTER TABLE findings ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- Add review_reason to explain why the finding needs review
ALTER TABLE findings ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- Add last_corrected_at timestamp for tracking correction history
ALTER TABLE findings ADD COLUMN IF NOT EXISTS last_corrected_at TIMESTAMPTZ;

-- Create index for efficient filtering of findings needing review
CREATE INDEX IF NOT EXISTS idx_findings_needs_review ON findings(needs_review) WHERE needs_review = true;

-- Create composite index for deal + needs_review queries
CREATE INDEX IF NOT EXISTS idx_findings_deal_needs_review ON findings(deal_id, needs_review) WHERE needs_review = true;

-- Add comments for documentation
COMMENT ON COLUMN findings.needs_review IS 'Flag indicating finding needs analyst review due to source correction or propagation';
COMMENT ON COLUMN findings.review_reason IS 'Explanation of why the finding needs review';
COMMENT ON COLUMN findings.last_corrected_at IS 'Timestamp of the most recent correction to this finding';
