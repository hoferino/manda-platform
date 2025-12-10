-- Migration: 00039_extend_cims_table
-- Description: Extend CIMs table with JSONB columns for CIM Builder workflow
-- Story: E9.1 - CIM Database Schema & Deal Integration
-- AC: #1 (Schema Exists), #2 (Foreign Key), #3 (RLS Policies)

-- ============================================================================
-- Step 1: Add new JSONB columns for CIM Builder state management
-- ============================================================================

-- Add slides JSONB column for storing slide content with component-level granularity
ALTER TABLE cims ADD COLUMN IF NOT EXISTS slides JSONB DEFAULT '[]';

-- Add buyer_persona JSONB column for storing buyer type, priorities, concerns
ALTER TABLE cims ADD COLUMN IF NOT EXISTS buyer_persona JSONB DEFAULT '{}';

-- Add investment_thesis TEXT column for the co-created thesis statement
ALTER TABLE cims ADD COLUMN IF NOT EXISTS investment_thesis TEXT;

-- Add outline JSONB column for CIM section structure
ALTER TABLE cims ADD COLUMN IF NOT EXISTS outline JSONB DEFAULT '[]';

-- Add dependency_graph JSONB column for tracking cross-slide dependencies
ALTER TABLE cims ADD COLUMN IF NOT EXISTS dependency_graph JSONB DEFAULT '{}';

-- Add conversation_history JSONB column for storing CIM-specific chat messages
ALTER TABLE cims ADD COLUMN IF NOT EXISTS conversation_history JSONB DEFAULT '[]';

-- ============================================================================
-- Step 2: Change workflow_state from TEXT to JSONB
-- This requires creating a new column, migrating data, then dropping old column
-- ============================================================================

-- Add new JSONB workflow_state column with temporary name
ALTER TABLE cims ADD COLUMN IF NOT EXISTS workflow_state_new JSONB;

-- Migrate existing text values to JSONB structure
-- Old values: 'draft', 'in_progress', 'review', 'completed'
-- New structure: {current_phase, current_section_index, current_slide_index, completed_phases, is_complete}
UPDATE cims
SET workflow_state_new = jsonb_build_object(
  'current_phase', CASE
    WHEN workflow_state = 'draft' THEN 'persona'
    WHEN workflow_state = 'in_progress' THEN 'content_creation'
    WHEN workflow_state = 'review' THEN 'review'
    WHEN workflow_state = 'completed' THEN 'complete'
    ELSE 'persona'
  END,
  'current_section_index', NULL,
  'current_slide_index', NULL,
  'completed_phases', CASE
    WHEN workflow_state = 'completed' THEN '["persona", "thesis", "outline", "content_creation", "visual_concepts", "review"]'::jsonb
    WHEN workflow_state = 'review' THEN '["persona", "thesis", "outline", "content_creation", "visual_concepts"]'::jsonb
    WHEN workflow_state = 'in_progress' THEN '["persona", "thesis", "outline"]'::jsonb
    ELSE '[]'::jsonb
  END,
  'is_complete', CASE
    WHEN workflow_state = 'completed' THEN true
    ELSE false
  END
)
WHERE workflow_state_new IS NULL;

-- Drop the old text column
ALTER TABLE cims DROP COLUMN IF EXISTS workflow_state;

-- Rename new column to workflow_state
ALTER TABLE cims RENAME COLUMN workflow_state_new TO workflow_state;

-- Set default for workflow_state
ALTER TABLE cims ALTER COLUMN workflow_state SET DEFAULT jsonb_build_object(
  'current_phase', 'persona',
  'current_section_index', NULL,
  'current_slide_index', NULL,
  'completed_phases', '[]'::jsonb,
  'is_complete', false
);

-- ============================================================================
-- Step 3: Create indexes for efficient queries
-- ============================================================================

-- Index on deal_id already exists from original migration
-- CREATE INDEX IF NOT EXISTS idx_cims_deal_id ON cims(deal_id);

-- GIN index on workflow_state for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_cims_workflow_state_gin ON cims USING GIN(workflow_state);

-- GIN index on slides for content searches
CREATE INDEX IF NOT EXISTS idx_cims_slides_gin ON cims USING GIN(slides);

-- ============================================================================
-- Step 4: Update RLS policies for deal-based access
-- The existing policy uses auth.uid() = user_id
-- We need to update it for deal-based access (users can access CIMs for their deals)
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS cims_isolation_policy ON cims;

-- Create new deal-based SELECT policy
CREATE POLICY cims_select_policy ON cims
    FOR SELECT
    USING (
        deal_id IN (
            SELECT id FROM deals WHERE user_id = auth.uid()
        )
    );

-- Create deal-based INSERT policy
CREATE POLICY cims_insert_policy ON cims
    FOR INSERT
    WITH CHECK (
        deal_id IN (
            SELECT id FROM deals WHERE user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- Create deal-based UPDATE policy (user must own the CIM and the deal)
CREATE POLICY cims_update_policy ON cims
    FOR UPDATE
    USING (
        deal_id IN (
            SELECT id FROM deals WHERE user_id = auth.uid()
        )
        AND user_id = auth.uid()
    )
    WITH CHECK (
        deal_id IN (
            SELECT id FROM deals WHERE user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- Create deal-based DELETE policy
CREATE POLICY cims_delete_policy ON cims
    FOR DELETE
    USING (
        deal_id IN (
            SELECT id FROM deals WHERE user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- ============================================================================
-- Step 5: Update comments for documentation
-- ============================================================================

COMMENT ON COLUMN cims.workflow_state IS 'JSONB workflow state: {current_phase, current_section_index, current_slide_index, completed_phases, is_complete}';
COMMENT ON COLUMN cims.slides IS 'JSONB array of slides with components, visual concepts, and source references';
COMMENT ON COLUMN cims.buyer_persona IS 'JSONB buyer persona: {buyer_type, buyer_description, priorities, concerns, key_metrics}';
COMMENT ON COLUMN cims.investment_thesis IS 'Text investment thesis statement co-created with agent';
COMMENT ON COLUMN cims.outline IS 'JSONB array of outline sections: [{id, title, description, order, status, slide_ids}]';
COMMENT ON COLUMN cims.dependency_graph IS 'JSONB dependency tracking: {dependencies: {slide_id: [dependent_ids]}, references: {slide_id: [ref_ids]}}';
COMMENT ON COLUMN cims.conversation_history IS 'JSONB array of CIM-specific conversation messages';
