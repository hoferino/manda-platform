-- Migration: 00037_create_prompt_improvements_table.sql
-- Story: E7.4 - Build Feedback Incorporation System
-- Purpose: Store prompt improvement suggestions based on correction patterns

-- Create prompt_improvements table
CREATE TABLE IF NOT EXISTS prompt_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE, -- NULL means global improvement

  -- What domain this applies to (NULL means all domains)
  domain TEXT,

  -- The pattern that triggered this improvement
  correction_pattern TEXT NOT NULL,

  -- Original prompt snippet that led to errors (if identifiable)
  original_prompt_snippet TEXT,

  -- Suggested improvement to the prompt
  suggested_improvement TEXT NOT NULL,

  -- Evidence
  based_on_corrections INTEGER NOT NULL DEFAULT 1,
  example_corrections JSONB, -- Array of example correction IDs

  -- Confidence in this suggestion
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'applied')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- If applied, when and by whom
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id),

  -- Analysis that generated this suggestion
  analysis_id UUID REFERENCES feedback_analytics(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by deal
CREATE INDEX IF NOT EXISTS idx_prompt_improvements_deal_id
  ON prompt_improvements(deal_id);

-- Index for querying by domain
CREATE INDEX IF NOT EXISTS idx_prompt_improvements_domain
  ON prompt_improvements(domain);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_prompt_improvements_status
  ON prompt_improvements(status);

-- Index for finding high-confidence pending improvements
CREATE INDEX IF NOT EXISTS idx_prompt_improvements_pending_confidence
  ON prompt_improvements(confidence DESC)
  WHERE status = 'pending';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_prompt_improvements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prompt_improvements_updated_at
  BEFORE UPDATE ON prompt_improvements
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_improvements_updated_at();

-- RLS Policies
ALTER TABLE prompt_improvements ENABLE ROW LEVEL SECURITY;

-- Users can view global improvements or improvements for their deals
CREATE POLICY "Users can view relevant prompt improvements"
  ON prompt_improvements FOR SELECT
  USING (
    deal_id IS NULL -- Global improvements visible to all
    OR EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = prompt_improvements.deal_id
      AND deals.user_id = auth.uid()
    )
  );

-- Only deal owners can manage deal-specific improvements
CREATE POLICY "Users can manage improvements for their deals"
  ON prompt_improvements FOR ALL
  USING (
    deal_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = prompt_improvements.deal_id
      AND deals.user_id = auth.uid()
    )
  );

-- Service role can manage all improvements
CREATE POLICY "Service role can manage all prompt improvements"
  ON prompt_improvements
  USING (auth.jwt() ->> 'role' = 'service_role');

-- View for aggregating common correction patterns across all deals
-- Useful for identifying global prompt improvements
CREATE OR REPLACE VIEW common_correction_patterns AS
SELECT
  correction_type,
  COUNT(*) as occurrence_count,
  COUNT(DISTINCT finding_id) as unique_findings,
  COUNT(DISTINCT fc.analyst_id) as unique_analysts,
  array_agg(DISTINCT f.domain) as affected_domains
FROM finding_corrections fc
JOIN findings f ON fc.finding_id = f.id
GROUP BY correction_type
HAVING COUNT(*) >= 5  -- Minimum occurrences to be considered a pattern
ORDER BY occurrence_count DESC;

-- View for domain-specific rejection rates (useful for threshold adjustment)
CREATE OR REPLACE VIEW domain_rejection_rates AS
SELECT
  f.deal_id,
  f.domain,
  COUNT(DISTINCT f.id) as total_findings,
  COUNT(DISTINCT CASE WHEN vf.action = 'validate' THEN vf.id END) as validation_count,
  COUNT(DISTINCT CASE WHEN vf.action = 'reject' THEN vf.id END) as rejection_count,
  CASE
    WHEN COUNT(DISTINCT vf.id) > 0
    THEN ROUND(COUNT(DISTINCT CASE WHEN vf.action = 'reject' THEN vf.id END)::DECIMAL / COUNT(DISTINCT vf.id), 2)
    ELSE 0
  END as rejection_rate,
  AVG(f.confidence) as avg_confidence
FROM findings f
LEFT JOIN validation_feedback vf ON f.id = vf.finding_id
GROUP BY f.deal_id, f.domain;

COMMENT ON TABLE prompt_improvements IS 'Stores prompt improvement suggestions generated from feedback analysis';
COMMENT ON VIEW common_correction_patterns IS 'Aggregates correction patterns across all deals to identify systemic extraction issues';
COMMENT ON VIEW domain_rejection_rates IS 'Per-domain rejection rates for threshold adjustment decisions';