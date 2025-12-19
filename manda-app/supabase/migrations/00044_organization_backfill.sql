-- Migration: 00044_organization_backfill
-- Description: Create default organization, backfill existing data, enforce NOT NULL
-- Story: E12.9 - Multi-Tenant Data Isolation
-- AC: #3 (deals.organization_id foreign key with migration)

-- ============================================================
-- BACKFILL: Create default organization and assign existing data
-- ============================================================

-- Create default organization with deterministic UUID
-- This ensures idempotency - running multiple times won't create duplicates
INSERT INTO organizations (id, name, slug, created_by)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'Manda Platform',
  'manda-platform',
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE slug = 'manda-platform'
);

-- Add first user as superadmin of default organization
-- This ensures there's always at least one superadmin
INSERT INTO organization_members (organization_id, user_id, role)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  id,
  'superadmin'
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Add ALL existing users to default organization as members
-- This ensures no one loses access during migration
INSERT INTO organization_members (organization_id, user_id, role)
SELECT
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  id,
  'member'
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM organization_members
  WHERE organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Backfill all existing deals to default organization
UPDATE deals
SET organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
WHERE organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
-- This ensures all future deals must have an organization
ALTER TABLE deals ALTER COLUMN organization_id SET NOT NULL;

-- Log the migration for audit purposes
DO $$
DECLARE
  deal_count INTEGER;
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deal_count FROM deals WHERE organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  SELECT COUNT(*) INTO user_count FROM organization_members WHERE organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  RAISE NOTICE 'Migration complete: % deals and % users assigned to default organization', deal_count, user_count;
END $$;

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON COLUMN deals.organization_id IS 'Organization this deal belongs to (required) - enforced by RLS policy';
