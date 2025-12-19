-- Migration: 00045_usage_tracking
-- Description: Create llm_usage and feature_usage tables for observability
-- Story: E12.1 - Usage Tracking Database Schema
-- Epic: E12 - Production Readiness & Observability

-- ============================================================
-- LLM Usage Table: Track every LLM API call
-- ============================================================
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,           -- google-gla, anthropic, voyage, openai
  model VARCHAR(100) NOT NULL,             -- gemini-2.5-flash, claude-sonnet-4-0, voyage-3.5
  feature VARCHAR(100) NOT NULL,           -- chat, document_analysis, extraction, embeddings, reranking
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE llm_usage IS 'Track every LLM API call for cost visibility and analysis';
COMMENT ON COLUMN llm_usage.provider IS 'LLM provider: google-gla, anthropic, voyage, openai';
COMMENT ON COLUMN llm_usage.model IS 'Model identifier: gemini-2.5-flash, claude-sonnet-4-0, voyage-3.5';
COMMENT ON COLUMN llm_usage.feature IS 'Feature using LLM: chat, document_analysis, extraction, embeddings, reranking';
COMMENT ON COLUMN llm_usage.cost_usd IS 'Estimated cost in USD based on token pricing';

-- ============================================================
-- Feature Usage Table: Track feature-level metrics
-- ============================================================
CREATE TABLE feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  feature_name VARCHAR(100) NOT NULL,      -- upload_document, chat, search, qa_response, cim_generation
  status VARCHAR(20) NOT NULL,             -- success, error, timeout
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB,                          -- Flexible metadata for feature-specific data
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE feature_usage IS 'Track feature-level metrics for performance analysis';
COMMENT ON COLUMN feature_usage.feature_name IS 'Feature name: upload_document, chat, search, qa_response, cim_generation';
COMMENT ON COLUMN feature_usage.status IS 'Execution status: success, error, timeout';
COMMENT ON COLUMN feature_usage.metadata IS 'Feature-specific data: document_count, query_type, etc.';

-- ============================================================
-- Indexes for Dashboard Queries
-- ============================================================

-- Primary query pattern: organization costs over time
CREATE INDEX idx_llm_usage_org_time ON llm_usage(organization_id, created_at);

-- Secondary: per-deal cost breakdown
CREATE INDEX idx_llm_usage_deal_time ON llm_usage(deal_id, created_at);

-- Feature breakdown queries
CREATE INDEX idx_llm_usage_feature ON llm_usage(feature, created_at);

-- Similar indexes for feature_usage
CREATE INDEX idx_feature_usage_org_time ON feature_usage(organization_id, created_at);
CREATE INDEX idx_feature_usage_deal_time ON feature_usage(deal_id, created_at);
CREATE INDEX idx_feature_usage_name ON feature_usage(feature_name, created_at);

-- Error analysis queries
CREATE INDEX idx_feature_usage_status ON feature_usage(status) WHERE status != 'success';

-- ============================================================
-- Row-Level Security
-- ============================================================

-- Enable RLS
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users see their org's usage, superadmin sees all
-- Note: Uses helper functions created in 00043_organization_rls_policies.sql
CREATE POLICY "org_isolation_llm_usage" ON llm_usage
FOR ALL USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())  -- Legacy data before org assignment
);

CREATE POLICY "org_isolation_feature_usage" ON feature_usage
FOR ALL USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())  -- Legacy data before org assignment
);
