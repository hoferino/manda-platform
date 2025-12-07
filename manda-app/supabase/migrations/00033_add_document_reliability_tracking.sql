-- Migration: 00033_add_document_reliability_tracking
-- Description: Add reliability tracking columns to documents table for source error cascade
-- Story: E7.1 - Implement Finding Correction via Chat
-- AC: #12 (Document marked with reliability_status = 'contains_errors')

-- Add reliability_status column to track document trustworthiness
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reliability_status TEXT NOT NULL DEFAULT 'trusted'
    CHECK (reliability_status IN ('trusted', 'contains_errors', 'superseded'));

-- Add reliability_notes for human-readable explanation of reliability issues
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reliability_notes TEXT;

-- Add error_count to track how many errors have been found in document
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;

-- Create index for efficiently finding documents with known errors
CREATE INDEX IF NOT EXISTS idx_documents_reliability ON documents(reliability_status)
    WHERE reliability_status != 'trusted';

-- Create composite index for deal + reliability queries
CREATE INDEX IF NOT EXISTS idx_documents_deal_reliability ON documents(deal_id, reliability_status)
    WHERE reliability_status != 'trusted';

-- Create view for documents with errors and their finding impact
CREATE OR REPLACE VIEW documents_with_errors AS
SELECT
    d.id,
    d.name,
    d.deal_id,
    d.reliability_status,
    d.reliability_notes,
    d.error_count,
    d.created_at,
    d.updated_at,
    COUNT(f.id) AS total_findings,
    COUNT(f.id) FILTER (WHERE f.needs_review = true) AS findings_needing_review
FROM documents d
LEFT JOIN findings f ON f.document_id = d.id
WHERE d.reliability_status = 'contains_errors'
GROUP BY d.id;

-- Add comments for documentation
COMMENT ON COLUMN documents.reliability_status IS 'Document reliability: trusted (default), contains_errors, or superseded';
COMMENT ON COLUMN documents.reliability_notes IS 'Human-readable notes about reliability issues found';
COMMENT ON COLUMN documents.error_count IS 'Count of corrections where source_error was identified';
COMMENT ON VIEW documents_with_errors IS 'View showing documents with known errors and their finding impact';
