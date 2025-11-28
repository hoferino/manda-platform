-- Migration: 00021_add_findings_status_column
-- Description: Add status and validation_history columns to findings table
-- Story: E4.1 - Build Knowledge Explorer UI Main Interface
-- AC: #2 (Findings Table View), #5 (API Integration)

-- Add status column for finding validation workflow
-- Values: 'pending', 'validated', 'rejected'
ALTER TABLE findings ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'pending';

-- Add validation_history for audit trail of validation actions
-- Structure: [{ action: 'validated'|'rejected'|'edited', previousValue?: string, newValue?: string, timestamp: string, userId: string }]
ALTER TABLE findings ADD COLUMN IF NOT EXISTS validation_history jsonb DEFAULT '[]';

-- Create index on status column for efficient filtering
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);

-- Create composite index for common query pattern (deal_id + status)
CREATE INDEX IF NOT EXISTS idx_findings_deal_status ON findings(deal_id, status);

-- Add comments for documentation
COMMENT ON COLUMN findings.status IS 'Validation status: pending (default), validated, or rejected';
COMMENT ON COLUMN findings.validation_history IS 'Audit trail of validation actions with timestamps and user IDs';
