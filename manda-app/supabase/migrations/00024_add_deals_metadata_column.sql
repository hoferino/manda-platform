-- Migration: 00024_add_deals_metadata_column
-- Description: Add metadata column to deals table for storing gap resolutions and other deal-specific data
-- Story: E4.8 - Build Gap Analysis View

-- Add metadata column to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN deals.metadata IS 'Flexible JSON storage for deal-specific data including gap resolutions';
