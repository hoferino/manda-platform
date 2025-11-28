-- Migration: 00022_update_findings_embedding_dimension
-- Description: Update findings embedding column from 1536 to 3072 dimensions
-- Story: E4.2 - Implement Semantic Search for Findings (AC: #2, #3)
--
-- OpenAI text-embedding-3-large uses 3072 dimensions.
-- This matches the document_chunks table (migration 00015).
-- pgvector has 2000 dimension limit for HNSW indexes, so we cast to halfvec.
-- See: https://github.com/pgvector/pgvector/issues/461

-- Drop existing index (required before altering column)
DROP INDEX IF EXISTS idx_findings_embedding;

-- Alter the embedding column to use 3072 dimensions
-- Note: This will clear any existing embeddings - regeneration may be needed
ALTER TABLE findings
ALTER COLUMN embedding TYPE vector(3072);

-- HNSW index for vector similarity search
-- pgvector has 2000 dimension limit for indexes, so we cast to halfvec for indexing
-- This allows 3072 dimensions while still enabling fast similarity search
CREATE INDEX idx_findings_embedding ON findings
    USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Add comment for documentation
COMMENT ON COLUMN findings.embedding IS 'Vector embedding (3072 dimensions) for semantic search using OpenAI text-embedding-3-large (E4.2). Uses HNSW index with halfvec cast to bypass 2000-dim limit.';

-- Create the match_findings function for semantic search
-- This function performs vector similarity search with optional filters
CREATE OR REPLACE FUNCTION match_findings(
    query_embedding vector(3072),
    match_threshold float DEFAULT 0.0,
    match_count int DEFAULT 20,
    p_deal_id uuid DEFAULT NULL,
    p_document_id uuid DEFAULT NULL,
    p_domains text[] DEFAULT NULL,
    p_statuses text[] DEFAULT NULL,
    p_confidence_min float DEFAULT NULL,
    p_confidence_max float DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    deal_id uuid,
    document_id uuid,
    chunk_id uuid,
    user_id uuid,
    text text,
    source_document text,
    page_number int,
    confidence float,
    finding_type finding_type_enum,
    domain finding_domain_enum,
    status varchar(20),
    validation_history jsonb,
    metadata jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.deal_id,
        f.document_id,
        f.chunk_id,
        f.user_id,
        f.text,
        f.source_document,
        f.page_number,
        f.confidence,
        f.finding_type,
        f.domain,
        f.status,
        f.validation_history,
        f.metadata,
        f.created_at,
        f.updated_at,
        1 - (f.embedding <=> query_embedding) AS similarity
    FROM findings f
    WHERE
        f.embedding IS NOT NULL
        AND (p_deal_id IS NULL OR f.deal_id = p_deal_id)
        AND (p_document_id IS NULL OR f.document_id = p_document_id)
        AND (p_domains IS NULL OR f.domain::text = ANY(p_domains))
        AND (p_statuses IS NULL OR f.status = ANY(p_statuses))
        AND (p_confidence_min IS NULL OR f.confidence >= p_confidence_min)
        AND (p_confidence_max IS NULL OR f.confidence <= p_confidence_max)
        AND (p_statuses IS NOT NULL OR f.status IS NULL OR f.status != 'rejected')
        AND 1 - (f.embedding <=> query_embedding) > match_threshold
    ORDER BY f.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_findings TO authenticated;

COMMENT ON FUNCTION match_findings IS 'Semantic search for findings using pgvector cosine similarity (E4.2)';
