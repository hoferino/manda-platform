-- FIX: Update embedding column from 1536 to 3072 dimensions
-- Run this AFTER 00015 has been applied but 00016 failed
-- This uses HNSW index which supports unlimited dimensions (unlike ivfflat's 2000 limit)

-- First, drop any existing embedding index (may or may not exist)
DROP INDEX IF EXISTS idx_chunks_embedding;

-- Now alter the column - this should work since no index is constraining it
ALTER TABLE document_chunks
ALTER COLUMN embedding TYPE vector(3072);

-- Create HNSW index (supports any dimension, faster than ivfflat)
CREATE INDEX idx_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Update comment
COMMENT ON COLUMN document_chunks.embedding IS 'Vector embedding (3072 dimensions) for semantic search using OpenAI text-embedding-3-large (E3.4). Uses HNSW index.';

-- Verify
SELECT
    column_name,
    udt_name,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'document_chunks' AND column_name = 'embedding';
