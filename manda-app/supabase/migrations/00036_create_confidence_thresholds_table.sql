-- Migration: 00036_create_confidence_thresholds_table.sql
-- Story: E7.4 - Build Feedback Incorporation System
-- Purpose: Track per-domain confidence thresholds with history

-- Create confidence_thresholds table for domain-specific threshold tracking
CREATE TABLE IF NOT EXISTS confidence_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Domain this threshold applies to
  domain TEXT NOT NULL,

  -- Current threshold value (0.0 to 1.0)
  threshold DECIMAL(3,2) NOT NULL CHECK (threshold >= 0.0 AND threshold <= 1.0),

  -- Previous threshold for audit trail
  previous_threshold DECIMAL(3,2),

  -- Why this threshold was set
  reason TEXT NOT NULL,

  -- Statistical basis for recommendation
  based_on_sample_size INTEGER,
  statistical_confidence DECIMAL(3,2),

  -- Who/what applied this threshold
  applied_by UUID REFERENCES auth.users(id),
  auto_applied BOOLEAN DEFAULT FALSE,

  -- Link to analysis that recommended this
  analysis_id UUID REFERENCES feedback_analytics(id),

  -- Timestamps
  applied_at TIMESTAMPTZ DEFAULT now(),

  -- One active threshold per domain per deal
  CONSTRAINT unique_deal_domain_threshold UNIQUE (deal_id, domain)
);

-- Index for querying by deal
CREATE INDEX IF NOT EXISTS idx_confidence_thresholds_deal_id
  ON confidence_thresholds(deal_id);

-- Index for finding thresholds by domain across deals
CREATE INDEX IF NOT EXISTS idx_confidence_thresholds_domain
  ON confidence_thresholds(domain);

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_confidence_thresholds_applied_at
  ON confidence_thresholds(applied_at DESC);

-- History table for threshold changes (append-only audit)
CREATE TABLE IF NOT EXISTS confidence_threshold_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threshold_id UUID NOT NULL REFERENCES confidence_thresholds(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  old_threshold DECIMAL(3,2),
  new_threshold DECIMAL(3,2) NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  auto_changed BOOLEAN DEFAULT FALSE,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_threshold_history_threshold_id
  ON confidence_threshold_history(threshold_id);

CREATE INDEX IF NOT EXISTS idx_threshold_history_deal_id
  ON confidence_threshold_history(deal_id);

-- RLS Policies for confidence_thresholds
ALTER TABLE confidence_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view thresholds for their deals"
  ON confidence_thresholds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = confidence_thresholds.deal_id
      AND deals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage thresholds for their deals"
  ON confidence_thresholds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = confidence_thresholds.deal_id
      AND deals.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all thresholds"
  ON confidence_thresholds
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for confidence_threshold_history
ALTER TABLE confidence_threshold_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view threshold history for their deals"
  ON confidence_threshold_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = confidence_threshold_history.deal_id
      AND deals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert threshold history for their deals"
  ON confidence_threshold_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = confidence_threshold_history.deal_id
      AND deals.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all threshold history"
  ON confidence_threshold_history
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Default domain thresholds (global, used when no deal-specific threshold exists)
-- These are not stored in DB but defined in code as sensible defaults:
-- Financial: 0.70 (higher bar for financial data)
-- Legal: 0.70 (higher bar for legal matters)
-- Operational: 0.60 (moderate bar)
-- Market: 0.55 (lower bar, more exploratory)
-- Technical: 0.60 (moderate bar)
-- General: 0.50 (default)

COMMENT ON TABLE confidence_thresholds IS 'Per-domain confidence thresholds for each deal, adjusted based on feedback analysis';
COMMENT ON TABLE confidence_threshold_history IS 'Append-only audit trail of threshold changes for compliance';
COMMENT ON COLUMN confidence_thresholds.auto_applied IS 'True if threshold was automatically applied by the feedback analysis system';