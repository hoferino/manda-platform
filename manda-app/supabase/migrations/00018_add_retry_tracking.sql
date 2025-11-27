-- Migration: 00018_add_retry_tracking
-- Description: Add stage tracking and retry history columns for document processing retry logic
-- Story: E3.8 - Implement Retry Logic for Failed Processing
-- AC: #2 (Stage-Aware Retry), #4 (Enhanced Error Reporting)

-- Add last_completed_stage column to track processing progress
-- This enables stage-aware retry to resume from failed stage
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS last_completed_stage TEXT DEFAULT NULL;

-- Add check constraint for valid stages
ALTER TABLE documents
ADD CONSTRAINT valid_last_completed_stage
CHECK (last_completed_stage IN ('parsed', 'embedded', 'analyzed', 'complete') OR last_completed_stage IS NULL);

-- Add retry_history JSONB column to store retry attempt history
-- Structure: Array of {attempt, stage, error_type, message, timestamp}
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS retry_history JSONB DEFAULT '[]'::jsonb;

-- Update processing_status check constraint to include additional statuses
-- Need to drop and recreate since we're adding new allowed values
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_processing_status_check;
ALTER TABLE documents
ADD CONSTRAINT documents_processing_status_check
CHECK (processing_status IN (
    'pending', 'processing', 'parsed', 'embedding', 'embedded',
    'analyzing', 'analyzed', 'complete', 'completed', 'failed',
    'embedding_failed', 'analysis_failed', 'parsing'
));

-- Add processing_error column to store structured error information
-- Structure: {error_type, category, message, stage, timestamp, retry_count, stack_trace, guidance}
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS processing_error JSONB DEFAULT NULL;

-- Create index for finding documents in specific stages (useful for retry queries)
CREATE INDEX IF NOT EXISTS idx_documents_last_completed_stage
ON documents(last_completed_stage)
WHERE last_completed_stage IS NOT NULL;

-- Create index for finding documents with retry history
CREATE INDEX IF NOT EXISTS idx_documents_retry_history
ON documents USING gin(retry_history)
WHERE retry_history != '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN documents.last_completed_stage IS 'Last successfully completed processing stage (parsed, embedded, analyzed, complete)';
COMMENT ON COLUMN documents.retry_history IS 'History of retry attempts: [{attempt, stage, error_type, message, timestamp}], max 10 entries';
COMMENT ON COLUMN documents.processing_error IS 'Structured error information: {error_type, category, message, stage, timestamp, retry_count, stack_trace, guidance}';
