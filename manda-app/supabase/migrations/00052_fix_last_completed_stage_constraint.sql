-- Migration: 00052_fix_last_completed_stage_constraint
-- Description: Update valid_last_completed_stage constraint to include graphiti_ingested
-- Story: E10.4 - Document Ingestion Pipeline
-- Fixes: Check constraint violation when setting last_completed_stage to graphiti_ingested

-- Drop the existing constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS valid_last_completed_stage;

-- Recreate with graphiti_ingested included
-- Stages: parsed -> graphiti_ingested -> analyzed -> complete
ALTER TABLE documents
ADD CONSTRAINT valid_last_completed_stage
CHECK (last_completed_stage IN ('parsed', 'graphiti_ingested', 'analyzed', 'complete') OR last_completed_stage IS NULL);

-- Update comment to reflect new stage
COMMENT ON COLUMN documents.last_completed_stage IS 'Last successfully completed processing stage (parsed, graphiti_ingested, analyzed, complete)';
