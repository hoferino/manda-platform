-- Migration: 00038_create_qa_items_table
-- Description: Create qa_items table for Q&A Co-Creation Workflow
-- Story: E8.1 - Q&A Data Model and CRUD API
-- AC: #1 (Create with generated id and timestamps), #6 (RLS policies for deal-level isolation)

-- Q&A items are questions sent to the CLIENT to answer (not AI-generated answers)
-- Used during document analysis when gaps/inconsistencies cannot be resolved from knowledge base
-- Status is derived from date_answered (NULL = pending, NOT NULL = answered)
-- Optimistic locking via updated_at timestamp comparison on updates

CREATE TABLE IF NOT EXISTS qa_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    question TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    answer TEXT,
    comment TEXT,
    source_finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    date_added TIMESTAMPTZ DEFAULT NOW(),
    date_answered TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Validation constraints for category and priority enums
    CONSTRAINT qa_items_valid_category CHECK (
        category IN ('Financials', 'Legal', 'Operations', 'Market', 'Technology', 'HR')
    ),
    CONSTRAINT qa_items_valid_priority CHECK (
        priority IN ('high', 'medium', 'low')
    )
);

-- Create indexes for common query patterns
-- AC: #2 (Filter by category, priority, status)
CREATE INDEX IF NOT EXISTS idx_qa_items_deal_id ON qa_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_qa_items_category ON qa_items(category);
CREATE INDEX IF NOT EXISTS idx_qa_items_priority ON qa_items(priority);

-- Partial index for pending items (date_answered IS NULL) - most common filter
CREATE INDEX IF NOT EXISTS idx_qa_items_pending ON qa_items(deal_id)
    WHERE date_answered IS NULL;

-- Index for source_finding_id lookups (finding-to-Q&A linking)
CREATE INDEX IF NOT EXISTS idx_qa_items_source_finding ON qa_items(source_finding_id)
    WHERE source_finding_id IS NOT NULL;

-- Enable Row Level Security
-- AC: #6 (RLS policies enforce deal-level isolation)
ALTER TABLE qa_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view Q&A items for their deals
CREATE POLICY "Users can view Q&A items for their deals"
    ON qa_items FOR SELECT
    USING (deal_id IN (
        SELECT id FROM deals WHERE user_id = auth.uid()
    ));

-- RLS Policy: Users can insert Q&A items for their deals
CREATE POLICY "Users can insert Q&A items for their deals"
    ON qa_items FOR INSERT
    WITH CHECK (deal_id IN (
        SELECT id FROM deals WHERE user_id = auth.uid()
    ));

-- RLS Policy: Users can update Q&A items for their deals
CREATE POLICY "Users can update Q&A items for their deals"
    ON qa_items FOR UPDATE
    USING (deal_id IN (
        SELECT id FROM deals WHERE user_id = auth.uid()
    ));

-- RLS Policy: Users can delete Q&A items for their deals
CREATE POLICY "Users can delete Q&A items for their deals"
    ON qa_items FOR DELETE
    USING (deal_id IN (
        SELECT id FROM deals WHERE user_id = auth.uid()
    ));

-- Create trigger function for automatic updated_at refresh
-- Reuse existing function if available, else create
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $trigger$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $trigger$ LANGUAGE plpgsql;
    END IF;
END
$$;

-- Create trigger for automatic updated_at on qa_items
DROP TRIGGER IF EXISTS qa_items_updated_at ON qa_items;
CREATE TRIGGER qa_items_updated_at
    BEFORE UPDATE ON qa_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE qa_items IS 'Q&A items for client clarification during M&A due diligence';
COMMENT ON COLUMN qa_items.question IS 'Question to be answered by the client';
COMMENT ON COLUMN qa_items.category IS 'Question category: Financials, Legal, Operations, Market, Technology, HR';
COMMENT ON COLUMN qa_items.priority IS 'Priority level: high, medium, low';
COMMENT ON COLUMN qa_items.answer IS 'Client response (NULL until answered)';
COMMENT ON COLUMN qa_items.comment IS 'Optional notes from client or team';
COMMENT ON COLUMN qa_items.source_finding_id IS 'Link to finding that triggered this Q&A item';
COMMENT ON COLUMN qa_items.date_answered IS 'NULL = pending, NOT NULL = answered (replaces status field)';
COMMENT ON COLUMN qa_items.updated_at IS 'Used for optimistic locking on concurrent edits';