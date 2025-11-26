-- Migration: 00013_drop_deal_type_column
-- Description: Remove deal_type column from deals table
-- Version: v2.6 Course Correction
-- Reason: deal_type didn't drive any downstream behavior, simplified wizard

-- Drop the deal_type column from deals table
ALTER TABLE deals DROP COLUMN IF EXISTS deal_type;

-- Add comment documenting the change
COMMENT ON TABLE deals IS 'Stores M&A deal/project metadata with per-user data isolation via RLS. v2.6: deal_type removed as it did not drive behavior.';
