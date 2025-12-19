-- Migration: 00042_organizations
-- Description: Create organizations and organization_members tables for multi-tenant isolation
-- Story: E12.9 - Multi-Tenant Data Isolation
-- AC: #1 (organizations table with RLS), #2 (organization_members junction table), #3 (deals.organization_id FK)

-- ============================================================
-- Organizations table
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL
    CHECK (slug ~ '^[a-z0-9-]+$' AND length(slug) >= 3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE organizations IS 'Organizations for multi-tenant data isolation';
COMMENT ON COLUMN organizations.slug IS 'URL-safe identifier, lowercase alphanumeric with hyphens, min 3 chars';

-- ============================================================
-- Organization membership (supports multiple orgs per user)
-- ============================================================
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(50) DEFAULT 'member'
    CHECK (role IN ('superadmin', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

COMMENT ON TABLE organization_members IS 'User membership in organizations with role-based access';
COMMENT ON COLUMN organization_members.role IS 'User role: superadmin (global access), admin (org management), member (standard access)';

-- Indexes for RLS performance
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON organization_members(organization_id);

-- ============================================================
-- Add organization_id to deals (nullable initially for migration)
-- ============================================================
ALTER TABLE deals ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_deals_org ON deals(organization_id);

COMMENT ON COLUMN deals.organization_id IS 'Organization this deal belongs to - enforced by RLS policy';

-- ============================================================
-- Audit trail for membership changes
-- ============================================================
CREATE TABLE organization_member_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID,
  action TEXT CHECK (action IN ('added', 'removed', 'role_changed')),
  old_role TEXT,
  new_role TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE organization_member_audit IS 'Audit trail for organization membership changes';
