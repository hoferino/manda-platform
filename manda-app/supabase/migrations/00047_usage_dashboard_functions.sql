-- Migration: 00047_usage_dashboard_functions
-- Description: Database functions for E12.3 Developer Dashboard
-- Story: E12.3 - Developer Dashboard - Usage Metrics

-- ============================================================
-- Helper: Verify caller is superadmin (used by all dashboard functions)
-- ============================================================
CREATE OR REPLACE FUNCTION verify_superadmin_access()
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Superadmin access required';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Get Daily Costs (for line chart)
-- ============================================================
CREATE OR REPLACE FUNCTION get_daily_costs(
  p_start_date DATE,
  p_end_date DATE,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE(
  date DATE,
  cost_usd DECIMAL,
  input_tokens BIGINT,
  output_tokens BIGINT,
  call_count BIGINT
) AS $$
BEGIN
  -- Verify superadmin access
  PERFORM verify_superadmin_access();

  RETURN QUERY
  SELECT
    DATE(lu.created_at) as date,
    COALESCE(SUM(lu.cost_usd), 0) as cost_usd,
    COALESCE(SUM(lu.input_tokens::BIGINT), 0) as input_tokens,
    COALESCE(SUM(lu.output_tokens::BIGINT), 0) as output_tokens,
    COUNT(*)::BIGINT as call_count
  FROM llm_usage lu
  WHERE lu.created_at >= p_start_date
    AND lu.created_at < p_end_date + INTERVAL '1 day'
    AND (p_organization_id IS NULL OR lu.organization_id = p_organization_id)
  GROUP BY DATE(lu.created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Get Costs by Feature (for pie chart)
-- ============================================================
CREATE OR REPLACE FUNCTION get_costs_by_feature(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE(
  feature VARCHAR,
  cost_usd DECIMAL,
  call_count BIGINT,
  avg_latency_ms DECIMAL
) AS $$
BEGIN
  PERFORM verify_superadmin_access();

  RETURN QUERY
  SELECT
    lu.feature::VARCHAR,
    COALESCE(SUM(lu.cost_usd), 0) as cost_usd,
    COUNT(*)::BIGINT as call_count,
    COALESCE(AVG(lu.latency_ms), 0)::DECIMAL as avg_latency_ms
  FROM llm_usage lu
  WHERE (p_start_date IS NULL OR lu.created_at >= p_start_date)
    AND (p_end_date IS NULL OR lu.created_at < p_end_date + INTERVAL '1 day')
    AND (p_organization_id IS NULL OR lu.organization_id = p_organization_id)
  GROUP BY lu.feature
  ORDER BY cost_usd DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Get Costs by Provider/Model (for bar chart)
-- ============================================================
CREATE OR REPLACE FUNCTION get_costs_by_model(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE(
  provider VARCHAR,
  model VARCHAR,
  cost_usd DECIMAL,
  call_count BIGINT,
  total_tokens BIGINT
) AS $$
BEGIN
  PERFORM verify_superadmin_access();

  RETURN QUERY
  SELECT
    lu.provider::VARCHAR,
    lu.model::VARCHAR,
    COALESCE(SUM(lu.cost_usd), 0) as cost_usd,
    COUNT(*)::BIGINT as call_count,
    COALESCE(SUM(lu.input_tokens::BIGINT + lu.output_tokens::BIGINT), 0) as total_tokens
  FROM llm_usage lu
  WHERE (p_start_date IS NULL OR lu.created_at >= p_start_date)
    AND (p_end_date IS NULL OR lu.created_at < p_end_date + INTERVAL '1 day')
    AND (p_organization_id IS NULL OR lu.organization_id = p_organization_id)
  GROUP BY lu.provider, lu.model
  ORDER BY cost_usd DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Get Per-Deal Cost Summary (for table)
-- ============================================================
CREATE OR REPLACE FUNCTION get_deal_cost_summary(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  deal_id UUID,
  deal_name VARCHAR,
  organization_name VARCHAR,
  total_cost_usd DECIMAL,
  conversation_count BIGINT,
  document_count BIGINT,
  last_activity TIMESTAMPTZ
) AS $$
BEGIN
  PERFORM verify_superadmin_access();

  RETURN QUERY
  SELECT
    d.id as deal_id,
    d.name::VARCHAR as deal_name,
    COALESCE(o.name, 'No Org')::VARCHAR as organization_name,
    COALESCE(SUM(lu.cost_usd), 0) as total_cost_usd,
    COUNT(DISTINCT c.id)::BIGINT as conversation_count,
    COUNT(DISTINCT doc.id)::BIGINT as document_count,
    MAX(lu.created_at) as last_activity
  FROM deals d
  LEFT JOIN organizations o ON d.organization_id = o.id
  LEFT JOIN llm_usage lu ON lu.deal_id = d.id
    AND (p_start_date IS NULL OR lu.created_at >= p_start_date)
    AND (p_end_date IS NULL OR lu.created_at < p_end_date + INTERVAL '1 day')
  LEFT JOIN conversations c ON c.deal_id = d.id
  LEFT JOIN documents doc ON doc.deal_id = d.id
  WHERE (p_organization_id IS NULL OR d.organization_id = p_organization_id)
  GROUP BY d.id, d.name, o.name
  HAVING COALESCE(SUM(lu.cost_usd), 0) > 0
  ORDER BY total_cost_usd DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Get Recent Errors (for error table)
-- ============================================================
CREATE OR REPLACE FUNCTION get_recent_errors(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  feature_name VARCHAR,
  deal_id UUID,
  deal_name VARCHAR,
  error_message TEXT,
  duration_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  PERFORM verify_superadmin_access();

  RETURN QUERY
  SELECT
    fu.id,
    fu.feature_name::VARCHAR,
    fu.deal_id,
    COALESCE(d.name, 'Unknown')::VARCHAR as deal_name,
    fu.error_message,
    fu.duration_ms,
    fu.metadata,
    fu.created_at
  FROM feature_usage fu
  LEFT JOIN deals d ON fu.deal_id = d.id
  WHERE fu.status = 'error'
    AND (p_start_date IS NULL OR fu.created_at >= p_start_date)
    AND (p_end_date IS NULL OR fu.created_at < p_end_date + INTERVAL '1 day')
    AND (p_organization_id IS NULL OR fu.organization_id = p_organization_id)
  ORDER BY fu.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Get Dashboard Summary Stats
-- ============================================================
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE(
  total_cost_usd DECIMAL,
  total_calls BIGINT,
  total_tokens BIGINT,
  avg_latency_ms DECIMAL,
  error_count BIGINT,
  error_rate DECIMAL
) AS $$
BEGIN
  PERFORM verify_superadmin_access();

  RETURN QUERY
  WITH llm_stats AS (
    SELECT
      COALESCE(SUM(cost_usd), 0) as total_cost,
      COUNT(*) as total_calls,
      COALESCE(SUM(input_tokens::BIGINT + output_tokens::BIGINT), 0) as total_tokens,
      COALESCE(AVG(latency_ms), 0) as avg_latency
    FROM llm_usage
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at < p_end_date + INTERVAL '1 day')
      AND (p_organization_id IS NULL OR organization_id = p_organization_id)
  ),
  error_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'error') as err_count,
      COUNT(*) as total_feature_calls
    FROM feature_usage
    WHERE (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at < p_end_date + INTERVAL '1 day')
      AND (p_organization_id IS NULL OR organization_id = p_organization_id)
  )
  SELECT
    ls.total_cost::DECIMAL as total_cost_usd,
    ls.total_calls::BIGINT,
    ls.total_tokens::BIGINT,
    ls.avg_latency::DECIMAL as avg_latency_ms,
    es.err_count::BIGINT as error_count,
    CASE WHEN es.total_feature_calls > 0
      THEN (es.err_count::DECIMAL / es.total_feature_calls * 100)
      ELSE 0
    END as error_rate
  FROM llm_stats ls, error_stats es;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
