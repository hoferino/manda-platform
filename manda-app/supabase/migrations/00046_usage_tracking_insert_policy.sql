-- Migration: 00046_usage_tracking_insert_policy
-- Description: Add WITH CHECK constraints to usage tracking RLS policies
-- Story: E12.1 - Usage Tracking Database Schema (Code Review Fix)
-- Epic: E12 - Production Readiness & Observability

-- ============================================================
-- Drop existing policies and recreate with WITH CHECK
-- ============================================================

-- Drop the existing policies
DROP POLICY IF EXISTS "org_isolation_llm_usage" ON llm_usage;
DROP POLICY IF EXISTS "org_isolation_feature_usage" ON feature_usage;

-- Recreate with separate SELECT and INSERT policies for proper security

-- LLM Usage: SELECT policy (read your org's data or all if superadmin)
CREATE POLICY "llm_usage_select" ON llm_usage
FOR SELECT USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- LLM Usage: INSERT policy (can only insert for your org or with your user_id)
CREATE POLICY "llm_usage_insert" ON llm_usage
FOR INSERT WITH CHECK (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- LLM Usage: UPDATE/DELETE policy (same as SELECT)
CREATE POLICY "llm_usage_modify" ON llm_usage
FOR UPDATE USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "llm_usage_delete" ON llm_usage
FOR DELETE USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- Feature Usage: SELECT policy
CREATE POLICY "feature_usage_select" ON feature_usage
FOR SELECT USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- Feature Usage: INSERT policy
CREATE POLICY "feature_usage_insert" ON feature_usage
FOR INSERT WITH CHECK (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())
);

-- Feature Usage: UPDATE/DELETE policy
CREATE POLICY "feature_usage_modify" ON feature_usage
FOR UPDATE USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())
);

CREATE POLICY "feature_usage_delete" ON feature_usage
FOR DELETE USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())
);
