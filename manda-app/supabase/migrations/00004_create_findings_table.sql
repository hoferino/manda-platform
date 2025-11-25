-- Migration: 00004_create_findings_table
-- Description: Create findings table with pgvector embeddings for semantic search
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables), #3 (RLS Policies), #6 (pgvector Configuration)

-- Create findings table for extracted facts with embeddings
CREATE TABLE IF NOT EXISTS findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    text text NOT NULL,
    source_document text,
    page_number int,
    confidence float CHECK (confidence >= 0 AND confidence <= 1),
    embedding vector(1536),  -- OpenAI text-embedding-3-large dimensions
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_findings_deal_id ON findings(deal_id);
CREATE INDEX IF NOT EXISTS idx_findings_document_id ON findings(document_id);
CREATE INDEX IF NOT EXISTS idx_findings_user_id ON findings(user_id);

-- Create IVFFlat index for vector similarity search
-- IVFFlat is recommended for datasets > 10K vectors
-- Using cosine distance operator (most common for text embeddings)
CREATE INDEX IF NOT EXISTS idx_findings_embedding ON findings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
CREATE POLICY findings_isolation_policy ON findings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE findings IS 'Extracted facts from documents with pgvector embeddings for semantic search';
COMMENT ON COLUMN findings.embedding IS 'Vector embedding (1536 dimensions for text-embedding-3-large)';
COMMENT ON COLUMN findings.confidence IS 'Extraction confidence score between 0 and 1';
COMMENT ON COLUMN findings.metadata IS 'Additional metadata (entities, categories, etc.)';
