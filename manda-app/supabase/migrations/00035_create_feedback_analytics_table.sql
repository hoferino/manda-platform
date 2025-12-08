-- Migration: 00035_create_feedback_analytics_table.sql
-- Story: E7.4 - Build Feedback Incorporation System
-- Purpose: Store feedback analysis results for weekly analytics

-- Create feedback_analytics table for storing analysis summaries
CREATE TABLE IF NOT EXISTS feedback_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Analysis period
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Analysis type
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('full', 'incremental')) DEFAULT 'full',

  -- Full summary as JSONB (FeedbackAnalysisSummary type)
  summary_json JSONB NOT NULL,

  -- Quick access aggregate stats
  total_findings INTEGER NOT NULL DEFAULT 0,
  total_corrections INTEGER NOT NULL DEFAULT 0,
  total_validations INTEGER NOT NULL DEFAULT 0,
  total_rejections INTEGER NOT NULL DEFAULT 0,
  pattern_count INTEGER NOT NULL DEFAULT 0,
  recommendation_count INTEGER NOT NULL DEFAULT 0,

  -- Processing metadata
  processing_time_ms INTEGER,
  triggered_by UUID REFERENCES auth.users(id),
  trigger_type TEXT CHECK (trigger_type IN ('scheduled', 'manual', 'threshold_exceeded')) DEFAULT 'scheduled',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate analyses for same deal/date
  CONSTRAINT unique_deal_analysis_date UNIQUE (deal_id, analysis_date)
);

-- Index for querying by deal
CREATE INDEX IF NOT EXISTS idx_feedback_analytics_deal_id
  ON feedback_analytics(deal_id);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_feedback_analytics_analysis_date
  ON feedback_analytics(analysis_date DESC);

-- Index for finding recent analyses
CREATE INDEX IF NOT EXISTS idx_feedback_analytics_created_at
  ON feedback_analytics(created_at DESC);

-- RLS Policies
ALTER TABLE feedback_analytics ENABLE ROW LEVEL SECURITY;

-- Users can view analytics for deals they have access to
CREATE POLICY "Users can view analytics for their deals"
  ON feedback_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = feedback_analytics.deal_id
      AND deals.user_id = auth.uid()
    )
  );

-- Users can insert analytics for their deals
CREATE POLICY "Users can insert analytics for their deals"
  ON feedback_analytics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deals
      WHERE deals.id = feedback_analytics.deal_id
      AND deals.user_id = auth.uid()
    )
  );

-- Service role bypass for background jobs
CREATE POLICY "Service role can manage all analytics"
  ON feedback_analytics
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE feedback_analytics IS 'Stores weekly feedback analysis summaries for each deal';
COMMENT ON COLUMN feedback_analytics.summary_json IS 'Full FeedbackAnalysisSummary JSON including patterns, domain stats, recommendations';
COMMENT ON COLUMN feedback_analytics.trigger_type IS 'How the analysis was triggered: scheduled (weekly job), manual (user request), or threshold_exceeded (auto-trigger)';