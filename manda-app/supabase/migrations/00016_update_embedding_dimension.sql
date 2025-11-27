-- Migration: Update embedding column dimension from 1536 to 3072
-- Story: E3.4 - Generate Embeddings for Semantic Search (AC: #3)
--
-- OpenAI text-embedding-3-large uses 3072 dimensions instead of 1536.
-- This migration updates the column dimension and recreates the index.

-- Drop existing index (required before altering column)
DROP INDEX IF EXISTS idx_chunks_embedding;

-- Alter the embedding column to use 3072 dimensions
-- Note: This will clear any existing embeddings (which is expected since E3.4 is first to populate them)
ALTER TABLE document_chunks
ALTER COLUMN embedding TYPE vector(3072);

-- Recreate the index with proper dimension
-- Using ivfflat index for cosine similarity search (efficient for ~100k+ vectors)
-- lists parameter: sqrt(num_vectors) is recommended, starting with 100 for initial deployment
CREATE INDEX idx_chunks_embedding ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Add comment
COMMENT ON COLUMN document_chunks.embedding IS 'Vector embedding (3072 dimensions) for semantic search using OpenAI text-embedding-3-large (E3.4)';
