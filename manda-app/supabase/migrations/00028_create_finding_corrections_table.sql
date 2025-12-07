-- Migration: 00028_create_finding_corrections_table
-- Description: Create finding_corrections table with source validation fields for audit trail
-- Story: E7.1 - Implement Finding Correction via Chat
-- AC: #3 (Original value stored), #11 (validation_status field)

-- Create finding_corrections table for append-only correction audit trail
CREATE TABLE IF NOT EXISTS finding_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID REFERENCES findings(id) ON DELETE CASCADE NOT NULL,
    original_value TEXT NOT NULL,
    corrected_value TEXT NOT NULL,
    correction_type TEXT NOT NULL CHECK (correction_type IN ('value', 'source', 'confidence', 'text')),
    reason TEXT,
    analyst_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Source validation fields (AC: #8, #9, #11)
    original_source_document TEXT,           -- Document where finding was extracted from
    original_source_location TEXT,           -- Page number, cell reference, paragraph
    user_source_reference TEXT,              -- User's basis for correction (e.g., "Management confirmed in call")
    validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        validation_status IN ('pending', 'confirmed_with_source', 'override_without_source', 'source_error')
    )
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_finding_corrections_finding ON finding_corrections(finding_id);
CREATE INDEX IF NOT EXISTS idx_finding_corrections_analyst ON finding_corrections(analyst_id);
CREATE INDEX IF NOT EXISTS idx_finding_corrections_created ON finding_corrections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finding_corrections_validation_status ON finding_corrections(validation_status);

-- Enable Row Level Security
ALTER TABLE finding_corrections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view corrections for findings in their deals
CREATE POLICY "Users can view corrections for their deals" ON finding_corrections
    FOR SELECT USING (
        finding_id IN (
            SELECT id FROM findings WHERE deal_id IN (
                SELECT id FROM deals WHERE user_id = auth.uid()
            )
        )
    );

-- RLS Policy: Users can insert corrections for findings in their deals (append-only)
CREATE POLICY "Users can insert corrections for their deals" ON finding_corrections
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
COMMENT ON TABLE finding_corrections IS 'Append-only audit trail of finding corrections with source validation';
COMMENT ON COLUMN finding_corrections.correction_type IS 'Type of correction: value (numeric), source (attribution), confidence (score), text (content)';
COMMENT ON COLUMN finding_corrections.original_source_document IS 'Document where the original finding was extracted from';
COMMENT ON COLUMN finding_corrections.original_source_location IS 'Location in source document (page, cell, paragraph)';
COMMENT ON COLUMN finding_corrections.user_source_reference IS 'User explanation for the correction basis';
COMMENT ON COLUMN finding_corrections.validation_status IS 'Source validation outcome: confirmed_with_source, override_without_source, or source_error';
