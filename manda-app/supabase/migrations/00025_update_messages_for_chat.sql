-- Migration: 00025_update_messages_for_chat
-- Description: Update messages table with sources column and role values for chat interface
-- Story: E5.3 - Build Chat Interface with Conversation History
-- AC: #7 (Message Persistence)

-- Add sources column for storing source citations
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sources jsonb;

-- Add tokens_used column for token tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tokens_used integer;

-- Update role check constraint to include 'user' and 'assistant' in addition to existing values
-- This allows both old naming ('human', 'ai') and new naming ('user', 'assistant')
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_role_check
    CHECK (role IN ('human', 'ai', 'system', 'tool', 'user', 'assistant'));

-- Add composite index for efficient conversation message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages(conversation_id, created_at DESC);

-- Add comments
COMMENT ON COLUMN messages.sources IS 'Source citations from agent responses (documentName, location)';
COMMENT ON COLUMN messages.tokens_used IS 'Number of tokens used in this message';
