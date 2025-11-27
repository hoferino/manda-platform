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
