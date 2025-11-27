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
