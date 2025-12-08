-- Migration: 00030_create_response_edits_table.sql
-- Story: E7.3 - Enable Response Editing and Learning
-- Purpose: Create response_edits table for capturing agent response edits

-- Create response_edits table (append-only for compliance audit trail)
CREATE TABLE response_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  original_text TEXT NOT NULL,
  edited_text TEXT NOT NULL,
  edit_type TEXT NOT NULL CHECK (edit_type IN ('style', 'content', 'factual', 'formatting')),
  analyst_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_response_edits_message ON response_edits(message_id);
CREATE INDEX idx_response_edits_analyst ON response_edits(analyst_id);
CREATE INDEX idx_response_edits_type ON response_edits(edit_type);
CREATE INDEX idx_response_edits_created ON response_edits(created_at DESC);

-- Enable Row Level Security
ALTER TABLE response_edits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view edits for their conversations
-- Uses nested deal ownership check via conversations -> deals -> user_id
CREATE POLICY "Users can view edits for their conversations" ON response_edits
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE deal_id IN (
          SELECT id FROM deals WHERE user_id = auth.uid()
        )
      )
    )
  );

-- RLS Policy: Users can insert edits for their conversations (append-only)
CREATE POLICY "Users can insert edits for their conversations" ON response_edits
  FOR INSERT WITH CHECK (
    message_id IN (
      SELECT id FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE deal_id IN (
          SELECT id FROM deals WHERE user_id = auth.uid()
        )
      )
    )
    AND analyst_id = auth.uid()
  );

-- No UPDATE or DELETE policies - append-only design for compliance audit trail

COMMENT ON TABLE response_edits IS 'Captures edits made to agent-generated responses for learning and audit trail. Append-only for compliance.';
COMMENT ON COLUMN response_edits.edit_type IS 'Type of edit: style (wording), content (information), factual (accuracy), formatting (structure)';