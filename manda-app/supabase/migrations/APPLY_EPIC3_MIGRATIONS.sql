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
-- Migration: 00017_update_findings_for_llm_analysis
-- Description: Add finding_type, domain, and chunk_id columns for LLM analysis
-- Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach)
-- AC: #4 (Store Findings in Database)

-- Add chunk_id column to link findings to source chunks
ALTER TABLE findings ADD COLUMN IF NOT EXISTS chunk_id uuid REFERENCES document_chunks(id) ON DELETE SET NULL;

-- Add finding_type enum column
-- Values: metric, fact, risk, opportunity, contradiction
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finding_type_enum') THEN
        CREATE TYPE finding_type_enum AS ENUM ('metric', 'fact', 'risk', 'opportunity', 'contradiction');
    END IF;
END $$;

ALTER TABLE findings ADD COLUMN IF NOT EXISTS finding_type finding_type_enum DEFAULT 'fact';

-- Add domain enum column
-- Values: financial, operational, market, legal, technical
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finding_domain_enum') THEN
        CREATE TYPE finding_domain_enum AS ENUM ('financial', 'operational', 'market', 'legal', 'technical');
    END IF;
END $$;

ALTER TABLE findings ADD COLUMN IF NOT EXISTS domain finding_domain_enum DEFAULT 'operational';

-- Create index on chunk_id for joining with document_chunks
CREATE INDEX IF NOT EXISTS idx_findings_chunk_id ON findings(chunk_id);

-- Create index on finding_type for filtering
CREATE INDEX IF NOT EXISTS idx_findings_finding_type ON findings(finding_type);

-- Create index on domain for filtering
CREATE INDEX IF NOT EXISTS idx_findings_domain ON findings(domain);

-- Create composite index for common query pattern (project + type)
CREATE INDEX IF NOT EXISTS idx_findings_deal_type ON findings(deal_id, finding_type);

-- Add updated_at column with trigger
ALTER TABLE findings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create or update the updated_at trigger
CREATE OR REPLACE FUNCTION update_findings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_findings_updated_at ON findings;
CREATE TRIGGER set_findings_updated_at
    BEFORE UPDATE ON findings
    FOR EACH ROW
    EXECUTE FUNCTION update_findings_updated_at();

-- Add comments for new columns
COMMENT ON COLUMN findings.chunk_id IS 'Reference to source document chunk (optional)';
COMMENT ON COLUMN findings.finding_type IS 'Type of finding: metric, fact, risk, opportunity, or contradiction';
COMMENT ON COLUMN findings.domain IS 'Business domain: financial, operational, market, legal, or technical';
COMMENT ON COLUMN findings.updated_at IS 'Timestamp of last update';
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
-- Migration: Create financial_metrics table
-- Story: E3.9 - Financial Model Integration (AC: #1, #3)
--
-- Stores extracted financial metrics from Excel models and PDF tables
-- with full source attribution and provenance tracking.

-- Create enum for metric categories
DO $$ BEGIN
    CREATE TYPE metric_category AS ENUM (
        'income_statement',
        'balance_sheet',
        'cash_flow',
        'ratio'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for period types
DO $$ BEGIN
    CREATE TYPE period_type AS ENUM (
        'annual',
        'quarterly',
        'monthly',
        'ytd'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create financial_metrics table
CREATE TABLE IF NOT EXISTS financial_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,

    -- Metric identification
    metric_name TEXT NOT NULL,
    metric_category metric_category NOT NULL,

    -- Value and unit
    value DECIMAL(20, 4),
    unit TEXT,

    -- Period information
    period_type period_type,
    period_start DATE,
    period_end DATE,
    fiscal_year INTEGER,
    fiscal_quarter INTEGER CHECK (fiscal_quarter IS NULL OR fiscal_quarter BETWEEN 1 AND 4),

    -- Source attribution
    source_cell TEXT,          -- Excel cell reference (e.g., "B15")
    source_sheet TEXT,         -- Excel sheet name
    source_page INTEGER,       -- PDF page number
    source_table_index INTEGER, -- PDF table index on page
    source_formula TEXT,       -- Original Excel formula (e.g., "=SUM(A1:A10)")

    -- Classification
    is_actual BOOLEAN DEFAULT true,  -- false for projections/forecasts
    confidence_score DECIMAL(5, 2) CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100),

    -- Additional metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE financial_metrics IS 'Financial metrics extracted from documents with full source attribution';
COMMENT ON COLUMN financial_metrics.metric_name IS 'Normalized metric name (e.g., revenue, ebitda, gross_margin)';
COMMENT ON COLUMN financial_metrics.metric_category IS 'Category: income_statement, balance_sheet, cash_flow, or ratio';
COMMENT ON COLUMN financial_metrics.source_cell IS 'Excel cell reference where value was found';
COMMENT ON COLUMN financial_metrics.source_formula IS 'Original Excel formula if applicable';
COMMENT ON COLUMN financial_metrics.is_actual IS 'True for historical/actual values, false for projections';
COMMENT ON COLUMN financial_metrics.confidence_score IS 'Extraction confidence (0-100)';

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_financial_metrics_document_id
    ON financial_metrics(document_id);

CREATE INDEX IF NOT EXISTS idx_financial_metrics_metric_name
    ON financial_metrics(metric_name);

CREATE INDEX IF NOT EXISTS idx_financial_metrics_metric_category
    ON financial_metrics(metric_category);

CREATE INDEX IF NOT EXISTS idx_financial_metrics_fiscal_year
    ON financial_metrics(fiscal_year);

CREATE INDEX IF NOT EXISTS idx_financial_metrics_is_actual
    ON financial_metrics(is_actual);

-- Composite index for period-based queries
CREATE INDEX IF NOT EXISTS idx_financial_metrics_period
    ON financial_metrics(fiscal_year, fiscal_quarter, period_type);

-- Index for finding lookup
CREATE INDEX IF NOT EXISTS idx_financial_metrics_finding_id
    ON financial_metrics(finding_id) WHERE finding_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE financial_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view financial metrics for documents they have access to
-- (inherits access from documents table via deal_id)
CREATE POLICY "Users can view financial metrics for their project documents"
    ON financial_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN deals p ON d.deal_id = p.id
            WHERE d.id = financial_metrics.document_id
            AND p.user_id = auth.uid()
        )
    );

-- RLS Policy: Users can insert financial metrics for documents they own
CREATE POLICY "Users can insert financial metrics for their documents"
    ON financial_metrics
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN deals p ON d.deal_id = p.id
            WHERE d.id = financial_metrics.document_id
            AND p.user_id = auth.uid()
        )
    );

-- RLS Policy: Users can update financial metrics for their documents
CREATE POLICY "Users can update financial metrics for their documents"
    ON financial_metrics
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN deals p ON d.deal_id = p.id
            WHERE d.id = financial_metrics.document_id
            AND p.user_id = auth.uid()
        )
    );

-- RLS Policy: Users can delete financial metrics for their documents
CREATE POLICY "Users can delete financial metrics for their documents"
    ON financial_metrics
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN deals p ON d.deal_id = p.id
            WHERE d.id = financial_metrics.document_id
            AND p.user_id = auth.uid()
        )
    );

-- Service role bypass for backend operations
CREATE POLICY "Service role has full access to financial_metrics"
    ON financial_metrics
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_financial_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_financial_metrics_updated_at ON financial_metrics;
CREATE TRIGGER set_financial_metrics_updated_at
    BEFORE UPDATE ON financial_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_metrics_updated_at();
