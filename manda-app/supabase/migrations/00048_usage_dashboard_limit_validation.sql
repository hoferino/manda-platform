-- Migration: 00048_usage_dashboard_limit_validation
-- Description: Add p_limit validation to dashboard functions
-- Story: E12.3 - Code review fix for SQL injection prevention

-- ============================================================
-- Update get_deal_cost_summary with limit validation
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
DECLARE
  v_limit INTEGER;
BEGIN
  PERFORM verify_superadmin_access();

  -- Validate and clamp p_limit to safe range (1-1000)
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 1000));

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
  LIMIT v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Update get_recent_errors with limit validation
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
DECLARE
  v_limit INTEGER;
BEGIN
  PERFORM verify_superadmin_access();

  -- Validate and clamp p_limit to safe range (1-500)
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));

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
  LIMIT v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
