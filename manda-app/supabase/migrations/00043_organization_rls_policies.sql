-- Migration: 00043_organization_rls_policies
-- Description: Replace user-based RLS policies with organization-based RLS policies
-- Story: E12.9 - Multi-Tenant Data Isolation
-- AC: #4 (RLS policies), #7 (Superadmin bypass)

-- ============================================================
-- DROP EXISTING USER-BASED RLS POLICIES
-- ============================================================

-- Deals
DROP POLICY IF EXISTS deals_isolation_policy ON deals;

-- Documents
DROP POLICY IF EXISTS documents_isolation_policy ON documents;

-- Findings
DROP POLICY IF EXISTS findings_isolation_policy ON findings;

-- Insights
DROP POLICY IF EXISTS insights_isolation_policy ON insights;

-- Conversations
DROP POLICY IF EXISTS conversations_isolation_policy ON conversations;

-- Messages
DROP POLICY IF EXISTS messages_isolation_policy ON messages;

-- IRLs
DROP POLICY IF EXISTS irls_isolation_policy ON irls;

-- IRL Items
DROP POLICY IF EXISTS irl_items_isolation_policy ON irl_items;

-- QA Items (multiple policies)
DROP POLICY IF EXISTS "Users can view Q&A items for their deals" ON qa_items;
DROP POLICY IF EXISTS "Users can insert Q&A items for their deals" ON qa_items;
DROP POLICY IF EXISTS "Users can update Q&A items for their deals" ON qa_items;
DROP POLICY IF EXISTS "Users can delete Q&A items for their deals" ON qa_items;

-- QA Lists
DROP POLICY IF EXISTS qa_lists_isolation_policy ON qa_lists;

-- CIMs
DROP POLICY IF EXISTS cims_isolation_policy ON cims;

-- Folders (multiple policies)
DROP POLICY IF EXISTS "Users can view folders for their deals" ON folders;
DROP POLICY IF EXISTS "Users can create folders for their deals" ON folders;
DROP POLICY IF EXISTS "Users can update folders for their deals" ON folders;
DROP POLICY IF EXISTS "Users can delete folders for their deals" ON folders;

-- Financial Metrics (has document_id, not deal_id - goes through documents)
DROP POLICY IF EXISTS financial_metrics_isolation_policy ON financial_metrics;
DROP POLICY IF EXISTS "Users can view financial metrics for their project documents" ON financial_metrics;
DROP POLICY IF EXISTS "Users can insert financial metrics for their documents" ON financial_metrics;
DROP POLICY IF EXISTS "Users can update financial metrics for their documents" ON financial_metrics;
DROP POLICY IF EXISTS "Users can delete financial metrics for their documents" ON financial_metrics;

-- Contradictions
DROP POLICY IF EXISTS contradictions_isolation_policy ON contradictions;

-- Document Chunks (multiple policies)
DROP POLICY IF EXISTS "Users can view chunks for their documents" ON document_chunks;

-- ============================================================
-- HELPER FUNCTION: Check if user is superadmin
-- ============================================================
CREATE OR REPLACE FUNCTION is_superadmin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND role = 'superadmin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_superadmin() IS 'Check if current user has superadmin role in any organization';

-- ============================================================
-- HELPER FUNCTION: Get user organization IDs
-- ============================================================
CREATE OR REPLACE FUNCTION user_organization_ids() RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION user_organization_ids() IS 'Get all organization IDs the current user belongs to';

-- ============================================================
-- RLS POLICIES: New tables (organizations, organization_members)
-- ============================================================

-- Organizations: Users see orgs they belong to, superadmin sees all
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_organizations" ON organizations
FOR ALL USING (
  is_superadmin() OR id IN (SELECT user_organization_ids())
);

-- Organization Members: See members of your orgs
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_organization_members" ON organization_members
FOR ALL USING (
  is_superadmin() OR organization_id IN (SELECT user_organization_ids())
);

-- ============================================================
-- RLS POLICIES: Deals (has organization_id column)
-- ============================================================

CREATE POLICY "org_isolation_deals" ON deals
FOR ALL USING (
  is_superadmin() OR organization_id IN (SELECT user_organization_ids())
);

-- ============================================================
-- RLS POLICIES: Tables with deal_id column (join through deals)
-- ============================================================

-- Documents
CREATE POLICY "org_isolation_documents" ON documents
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- Findings
CREATE POLICY "org_isolation_findings" ON findings
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- Insights
CREATE POLICY "org_isolation_insights" ON insights
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- Conversations
CREATE POLICY "org_isolation_conversations" ON conversations
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- IRLs
CREATE POLICY "org_isolation_irls" ON irls
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- QA Items
CREATE POLICY "org_isolation_qa_items" ON qa_items
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- QA Lists
CREATE POLICY "org_isolation_qa_lists" ON qa_lists
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- CIMs
CREATE POLICY "org_isolation_cims" ON cims
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- Folders
CREATE POLICY "org_isolation_folders" ON folders
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- Financial Metrics (via documents -> deals)
CREATE POLICY "org_isolation_financial_metrics" ON financial_metrics
FOR ALL USING (
  is_superadmin() OR document_id IN (
    SELECT doc.id FROM documents doc
    JOIN deals d ON doc.deal_id = d.id
    WHERE d.organization_id IN (SELECT user_organization_ids())
  )
);

-- Contradictions
CREATE POLICY "org_isolation_contradictions" ON contradictions
FOR ALL USING (
  is_superadmin() OR deal_id IN (
    SELECT id FROM deals WHERE organization_id IN (SELECT user_organization_ids())
  )
);

-- ============================================================
-- RLS POLICIES: Nested tables (join through parent)
-- ============================================================

-- Messages (via conversations)
CREATE POLICY "org_isolation_messages" ON messages
FOR ALL USING (
  is_superadmin() OR conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN deals d ON c.deal_id = d.id
    WHERE d.organization_id IN (SELECT user_organization_ids())
  )
);

-- IRL Items (via irls)
CREATE POLICY "org_isolation_irl_items" ON irl_items
FOR ALL USING (
  is_superadmin() OR irl_id IN (
    SELECT i.id FROM irls i
    JOIN deals d ON i.deal_id = d.id
    WHERE d.organization_id IN (SELECT user_organization_ids())
  )
);

-- Document Chunks (via documents)
CREATE POLICY "org_isolation_document_chunks" ON document_chunks
FOR ALL USING (
  is_superadmin() OR document_id IN (
    SELECT doc.id FROM documents doc
    JOIN deals d ON doc.deal_id = d.id
    WHERE d.organization_id IN (SELECT user_organization_ids())
  )
);

-- ============================================================
-- Note: Audit logs retain special handling
-- The audit_logs table uses service_role and user_id-based policies
-- which remain appropriate for security logging across orgs.
-- Superadmins can still view all audit logs via is_superadmin().
-- ============================================================

-- Update audit logs for superadmin access
CREATE POLICY "Superadmin can read all audit logs"
    ON audit_logs
    FOR SELECT
    TO authenticated
    USING (is_superadmin());

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON POLICY "org_isolation_deals" ON deals IS 'Organization-based isolation for deals';
COMMENT ON POLICY "org_isolation_documents" ON documents IS 'Organization-based isolation via deal relationship';
COMMENT ON POLICY "org_isolation_findings" ON findings IS 'Organization-based isolation via deal relationship';
COMMENT ON POLICY "org_isolation_conversations" ON conversations IS 'Organization-based isolation via deal relationship';
COMMENT ON POLICY "org_isolation_messages" ON messages IS 'Organization-based isolation via conversation->deal relationship';
