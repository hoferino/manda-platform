-- Migration: 00008_create_qa_lists_table
-- Description: Create Q&A Lists table for questions and answers
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables), #3 (RLS Policies)

-- Create Q&A Lists table
CREATE TABLE IF NOT EXISTS qa_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    question text NOT NULL,
    answer text,
    sources jsonb DEFAULT '[]',
    category text,
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'draft', 'answered', 'verified')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_qa_lists_deal_id ON qa_lists(deal_id);
CREATE INDEX IF NOT EXISTS idx_qa_lists_user_id ON qa_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_qa_lists_status ON qa_lists(status);
CREATE INDEX IF NOT EXISTS idx_qa_lists_category ON qa_lists(category);

-- Enable Row Level Security
ALTER TABLE qa_lists ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
CREATE POLICY qa_lists_isolation_policy ON qa_lists
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE qa_lists IS 'Q&A lists for M&A due diligence process';
COMMENT ON COLUMN qa_lists.sources IS 'JSON array of source citations for the answer';
COMMENT ON COLUMN qa_lists.status IS 'Question status: pending, draft, answered, verified';
