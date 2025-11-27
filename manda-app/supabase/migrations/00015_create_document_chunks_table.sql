-- Migration: Create document_chunks table
-- Story: E3.3 - Implement Document Parsing Job Handler (AC: #4)
--
-- This table stores parsed document chunks for semantic search and analysis.
-- Each chunk represents a portion of a document with metadata for source attribution.

-- Create document_chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    chunk_type TEXT NOT NULL DEFAULT 'text',
    page_number INTEGER,
    sheet_name TEXT,
    cell_reference TEXT,
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    embedding vector(3072),  -- OpenAI text-embedding-3-large dimension (3072), populated by E3.4
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique chunks per document
    CONSTRAINT unique_chunk_per_document UNIQUE (document_id, chunk_index),

    -- Validate chunk_type
    CONSTRAINT valid_chunk_type CHECK (chunk_type IN ('text', 'table', 'formula', 'image'))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
    ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_type
    ON document_chunks(chunk_type);

CREATE INDEX IF NOT EXISTS idx_document_chunks_page_number
    ON document_chunks(page_number)
    WHERE page_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_chunks_sheet_name
    ON document_chunks(sheet_name)
    WHERE sheet_name IS NOT NULL;

-- GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata
    ON document_chunks USING GIN (metadata);

-- Enable RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Chunks inherit access from parent document
-- Users can only access chunks for documents they can access

-- Policy: Users can view chunks for documents in their deals
CREATE POLICY "Users can view chunks for their documents"
    ON document_chunks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN deals dl ON d.deal_id = dl.id
            WHERE d.id = document_chunks.document_id
            AND dl.user_id = auth.uid()
        )
    );

-- Policy: Service role can do everything (for backend processing)
CREATE POLICY "Service role has full access to chunks"
    ON document_chunks
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- HNSW index for vector similarity search
-- pgvector has 2000 dimension limit for indexes, so we cast to halfvec for indexing
-- This allows 3072 dimensions while still enabling fast similarity search
-- See: https://github.com/pgvector/pgvector/issues/461
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks
    USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Add comment
COMMENT ON TABLE document_chunks IS 'Stores parsed document chunks for semantic search and analysis (E3.3)';
COMMENT ON COLUMN document_chunks.chunk_type IS 'Type of content: text, table, formula, or image';
COMMENT ON COLUMN document_chunks.embedding IS 'Vector embedding (3072 dimensions) for semantic search using OpenAI text-embedding-3-large. Uses HNSW index with halfvec cast to bypass 2000-dim limit.';
COMMENT ON COLUMN document_chunks.metadata IS 'Additional metadata as JSONB (source_file, is_table, ocr_processed, etc.)';
