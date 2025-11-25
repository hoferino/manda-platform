-- Migration: 00006_create_conversations_messages_tables
-- Description: Create conversations and messages tables for chat history
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables), #3 (RLS Policies)

-- Create conversations table for chat sessions
CREATE TABLE IF NOT EXISTS conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_deal_id ON conversations(deal_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- Enable Row Level Security on conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for conversations
CREATE POLICY conversations_isolation_policy ON conversations
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create messages table for chat messages
CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL CHECK (role IN ('human', 'ai', 'system', 'tool')),
    content text NOT NULL,
    tool_calls jsonb,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Enable Row Level Security on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for messages (access via conversation ownership)
-- Users can access messages if they own the parent conversation
CREATE POLICY messages_isolation_policy ON messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Add comments for documentation
COMMENT ON TABLE conversations IS 'Chat conversation sessions within a deal';
COMMENT ON TABLE messages IS 'Individual chat messages within a conversation';
COMMENT ON COLUMN messages.role IS 'Message role: human (user), ai (assistant), system, or tool';
COMMENT ON COLUMN messages.tool_calls IS 'LangGraph tool call data if applicable';
