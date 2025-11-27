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

-- Recreate the index with HNSW (required for dimensions > 2000, ivfflat only supports up to 2000)
-- HNSW is actually faster for queries and doesn't require training, good default choice
-- m = 16 (connections per layer), ef_construction = 64 (build quality) are reasonable defaults
CREATE INDEX idx_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Add comment
COMMENT ON COLUMN document_chunks.embedding IS 'Vector embedding (3072 dimensions) for semantic search using OpenAI text-embedding-3-large (E3.4). Uses HNSW index (ivfflat limited to 2000 dims).';
