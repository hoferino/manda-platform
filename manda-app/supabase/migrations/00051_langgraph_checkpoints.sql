-- Migration: 00051_langgraph_checkpoints
-- Description: LangGraph checkpoint storage for workflow state persistence
-- Story: E13.9 - PostgreSQL Checkpointer for LangGraph
-- AC: #2 (table with RLS), #7 (cleanup function), #10 (document schema)
--
-- This migration creates the tables required by @langchain/langgraph-checkpoint-postgres
-- for durable workflow state persistence. The schema matches what PostgresSaver.setup()
-- creates, but we define it explicitly to add RLS policies and the cleanup function.
--
-- Thread ID Formats:
--   - CIM workflow: cim-{dealId}-{cimId}
--   - Supervisor graph: supervisor-{dealId}-{timestamp}
--
-- Connection: Use Transaction mode (port 6543) for connection pooling

-- ============================================================
-- Checkpoints table (matches PostgresSaver schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  type TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

COMMENT ON TABLE langgraph_checkpoints IS 'LangGraph workflow checkpoints for state persistence (E13.9)';
COMMENT ON COLUMN langgraph_checkpoints.thread_id IS 'Format: cim-{dealId}-{cimId} or supervisor-{dealId}-{timestamp}';
COMMENT ON COLUMN langgraph_checkpoints.checkpoint_ns IS 'Checkpoint namespace for graph hierarchy';
COMMENT ON COLUMN langgraph_checkpoints.checkpoint_id IS 'Unique checkpoint identifier within thread+ns';
COMMENT ON COLUMN langgraph_checkpoints.parent_checkpoint_id IS 'Parent checkpoint for history traversal';
COMMENT ON COLUMN langgraph_checkpoints.type IS 'Checkpoint type identifier';
COMMENT ON COLUMN langgraph_checkpoints.checkpoint IS 'Serialized graph state as JSONB';
COMMENT ON COLUMN langgraph_checkpoints.metadata IS 'Contains deal_id for RLS filtering and observability data';
COMMENT ON COLUMN langgraph_checkpoints.created_at IS 'Timestamp for cleanup policy (30-day retention)';

-- Index for efficient thread lookups
CREATE INDEX IF NOT EXISTS idx_checkpoints_thread ON langgraph_checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created_at ON langgraph_checkpoints(created_at);

-- ============================================================
-- Writes table for atomic updates (required by PostgresSaver)
-- ============================================================
CREATE TABLE IF NOT EXISTS langgraph_checkpoint_writes (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  channel TEXT NOT NULL,
  type TEXT,
  value JSONB,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

COMMENT ON TABLE langgraph_checkpoint_writes IS 'Atomic write buffer for LangGraph checkpoints (E13.9)';
COMMENT ON COLUMN langgraph_checkpoint_writes.thread_id IS 'Links to langgraph_checkpoints.thread_id';
COMMENT ON COLUMN langgraph_checkpoint_writes.task_id IS 'Task identifier for parallel execution';
COMMENT ON COLUMN langgraph_checkpoint_writes.channel IS 'State channel being written';
COMMENT ON COLUMN langgraph_checkpoint_writes.value IS 'Serialized channel value as JSONB';

-- Index for efficient writes lookup
CREATE INDEX IF NOT EXISTS idx_checkpoint_writes_thread ON langgraph_checkpoint_writes(thread_id, checkpoint_id);

-- ============================================================
-- Blobs table for large binary data (required by PostgresSaver)
-- ============================================================
CREATE TABLE IF NOT EXISTS langgraph_checkpoint_blobs (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL,
  version TEXT NOT NULL,
  type TEXT NOT NULL,
  blob BYTEA,
  PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

COMMENT ON TABLE langgraph_checkpoint_blobs IS 'Binary large objects for LangGraph checkpoints (E13.9)';
COMMENT ON COLUMN langgraph_checkpoint_blobs.blob IS 'Serialized binary data for large state values';

-- Index for efficient blob lookup
CREATE INDEX IF NOT EXISTS idx_checkpoint_blobs_thread ON langgraph_checkpoint_blobs(thread_id);

-- ============================================================
-- Helper function to extract deal_id from thread_id
-- ============================================================
-- Thread format: cim-{dealId}-{cimId} or supervisor-{dealId}-{timestamp}
-- The dealId is a UUID that may contain hyphens, so we need careful parsing
CREATE OR REPLACE FUNCTION extract_deal_id_from_thread(thread_id TEXT)
RETURNS UUID AS $$
DECLARE
  parts TEXT[];
  deal_id_str TEXT;
BEGIN
  -- Split by first hyphen to get prefix (cim or supervisor)
  -- Then extract the UUID part (36 chars including hyphens)
  IF thread_id LIKE 'cim-%' THEN
    -- Format: cim-{uuid}-{cimId}
    -- Extract 36 chars starting after 'cim-'
    deal_id_str := substring(thread_id FROM 5 FOR 36);
  ELSIF thread_id LIKE 'supervisor-%' THEN
    -- Format: supervisor-{uuid}-{timestamp}
    -- Extract 36 chars starting after 'supervisor-'
    deal_id_str := substring(thread_id FROM 12 FOR 36);
  ELSE
    RETURN NULL;
  END IF;

  -- Validate it looks like a UUID and convert
  IF deal_id_str ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN deal_id_str::UUID;
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION extract_deal_id_from_thread IS 'Extract deal UUID from LangGraph thread_id for RLS policies (E13.9)';

-- ============================================================
-- RLS Policies (multi-tenant isolation via thread_id)
-- ============================================================
ALTER TABLE langgraph_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE langgraph_checkpoint_writes ENABLE ROW LEVEL SECURITY;
ALTER TABLE langgraph_checkpoint_blobs ENABLE ROW LEVEL SECURITY;

-- Users can access checkpoints for deals they have access to via organization membership
CREATE POLICY "Users can access own deal checkpoints" ON langgraph_checkpoints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM deals d
      JOIN organization_members om ON d.organization_id = om.organization_id
      WHERE d.id = extract_deal_id_from_thread(thread_id)
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access own deal checkpoint writes" ON langgraph_checkpoint_writes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM deals d
      JOIN organization_members om ON d.organization_id = om.organization_id
      WHERE d.id = extract_deal_id_from_thread(thread_id)
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can access own deal checkpoint blobs" ON langgraph_checkpoint_blobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM deals d
      JOIN organization_members om ON d.organization_id = om.organization_id
      WHERE d.id = extract_deal_id_from_thread(thread_id)
        AND om.user_id = auth.uid()
    )
  );

-- Service role bypass for background jobs (cleanup, etc.)
CREATE POLICY "Service role has full access to checkpoints" ON langgraph_checkpoints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to checkpoint writes" ON langgraph_checkpoint_writes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to checkpoint blobs" ON langgraph_checkpoint_blobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Cleanup function (for scheduled deletion)
-- ============================================================
-- AC: #7 - Implement checkpoint cleanup job (delete checkpoints older than 30 days)
-- This function is called by a scheduled job to maintain the 30-day retention policy
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints(days_old INTEGER DEFAULT 30)
RETURNS TABLE (
  checkpoints_deleted INTEGER,
  writes_deleted INTEGER,
  blobs_deleted INTEGER
) AS $$
DECLARE
  cp_count INTEGER;
  writes_count INTEGER;
  blobs_count INTEGER;
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - make_interval(days => days_old);

  -- Get thread_ids to delete for cascading cleanup
  CREATE TEMP TABLE threads_to_delete AS
  SELECT DISTINCT thread_id, checkpoint_ns, checkpoint_id
  FROM langgraph_checkpoints
  WHERE created_at < cutoff_date;

  -- Delete old blobs first (references checkpoints)
  DELETE FROM langgraph_checkpoint_blobs b
  WHERE EXISTS (
    SELECT 1 FROM threads_to_delete t
    WHERE b.thread_id = t.thread_id
      AND b.checkpoint_ns = t.checkpoint_ns
  );
  GET DIAGNOSTICS blobs_count = ROW_COUNT;

  -- Delete old checkpoint writes (references checkpoints)
  DELETE FROM langgraph_checkpoint_writes w
  WHERE EXISTS (
    SELECT 1 FROM threads_to_delete t
    WHERE w.thread_id = t.thread_id
      AND w.checkpoint_ns = t.checkpoint_ns
      AND w.checkpoint_id = t.checkpoint_id
  );
  GET DIAGNOSTICS writes_count = ROW_COUNT;

  -- Delete old checkpoints
  DELETE FROM langgraph_checkpoints
  WHERE created_at < cutoff_date;
  GET DIAGNOSTICS cp_count = ROW_COUNT;

  -- Cleanup temp table
  DROP TABLE threads_to_delete;

  checkpoints_deleted := cp_count;
  writes_deleted := writes_count;
  blobs_deleted := blobs_count;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_checkpoints IS 'Delete checkpoints older than N days. Call daily via cron. Default: 30 days (E13.9)';

-- Grant execute to service_role for scheduled cleanup
GRANT EXECUTE ON FUNCTION cleanup_old_checkpoints TO service_role;

-- ============================================================
-- Metrics view for observability
-- ============================================================
-- AC: #9 - Add checkpoint metrics to LangSmith traces
CREATE OR REPLACE VIEW checkpoint_metrics AS
SELECT
  COUNT(*) as total_checkpoints,
  COUNT(DISTINCT thread_id) as unique_threads,
  pg_size_pretty(pg_total_relation_size('langgraph_checkpoints')) as checkpoints_table_size,
  pg_size_pretty(pg_total_relation_size('langgraph_checkpoint_writes')) as writes_table_size,
  pg_size_pretty(pg_total_relation_size('langgraph_checkpoint_blobs')) as blobs_table_size,
  MIN(created_at) as oldest_checkpoint,
  MAX(created_at) as newest_checkpoint
FROM langgraph_checkpoints;

COMMENT ON VIEW checkpoint_metrics IS 'Observability view for LangGraph checkpoint storage (E13.9)';

-- Grant select to authenticated users (for dashboard/debugging)
GRANT SELECT ON checkpoint_metrics TO authenticated;
