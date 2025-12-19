-- Migration: 00049_add_graphiti_processing_status
-- Description: Add graphiti ingestion status values to documents processing_status constraint
-- Story: E10.4 - Document Ingestion Pipeline
-- Fixes: Check constraint violation for graphiti_ingesting/graphiti_ingested statuses

-- Update processing_status check constraint to include graphiti stages
-- Need to drop and recreate since we're adding new allowed values
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_processing_status_check;
ALTER TABLE documents
ADD CONSTRAINT documents_processing_status_check
CHECK (processing_status IN (
    'pending', 'processing', 'parsed', 'embedding', 'embedded',
    'analyzing', 'analyzed', 'complete', 'completed', 'failed',
    'embedding_failed', 'analysis_failed', 'parsing',
    'graphiti_ingesting', 'graphiti_ingested'
));

-- Add comments for documentation
COMMENT ON COLUMN documents.processing_status IS 'Document processing status: pending -> parsing -> parsed -> embedding -> embedded -> analyzing -> analyzed -> graphiti_ingesting -> graphiti_ingested -> complete';
