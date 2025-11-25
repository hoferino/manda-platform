-- Combined Schema Migration for Manda Platform
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
--
-- This file combines all migrations into a single file for easy execution
-- in the Supabase Dashboard SQL Editor.
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute all migrations
--
-- Generated: 2025-11-25

-- ============================================================
-- Migration 00001: Enable pgvector Extension
-- ============================================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Migration 00002: Create Deals Table
-- ============================================================

-- Create deals table (main project entity)
CREATE TABLE IF NOT EXISTS deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    company_name text,
    industry text,
    deal_type text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    irl_template text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index on user_id for efficient RLS policy evaluation and queries
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

-- Enable Row Level Security
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
DROP POLICY IF EXISTS deals_isolation_policy ON deals;
CREATE POLICY deals_isolation_policy ON deals
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration 00003: Create Documents Table
-- ============================================================

-- Create documents table for tracking uploaded files
CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    mime_type text,
    upload_status text DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
    processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_documents_deal_id ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
DROP POLICY IF EXISTS documents_isolation_policy ON documents;
CREATE POLICY documents_isolation_policy ON documents
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration 00004: Create Findings Table with pgvector
-- ============================================================

-- Create findings table for extracted facts with embeddings
CREATE TABLE IF NOT EXISTS findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    text text NOT NULL,
    source_document text,
    page_number int,
    confidence float CHECK (confidence >= 0 AND confidence <= 1),
    embedding vector(1536),  -- OpenAI text-embedding-3-large dimensions
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_findings_deal_id ON findings(deal_id);
CREATE INDEX IF NOT EXISTS idx_findings_document_id ON findings(document_id);
CREATE INDEX IF NOT EXISTS idx_findings_user_id ON findings(user_id);

-- Create IVFFlat index for vector similarity search (commented - needs data first)
-- Note: IVFFlat index requires some data to train. Create after loading initial data.
-- CREATE INDEX IF NOT EXISTS idx_findings_embedding ON findings
--     USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
DROP POLICY IF EXISTS findings_isolation_policy ON findings;
CREATE POLICY findings_isolation_policy ON findings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration 00005: Create Insights Table
-- ============================================================

-- Create insights table for analyzed patterns and cross-document intelligence
CREATE TABLE IF NOT EXISTS insights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    insight_type text NOT NULL CHECK (insight_type IN ('pattern', 'contradiction', 'risk', 'opportunity', 'summary')),
    title text,
    text text NOT NULL,
    confidence float CHECK (confidence >= 0 AND confidence <= 1),
    source_finding_ids uuid[],
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_insights_deal_id ON insights(deal_id);
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);

-- Enable Row Level Security
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
DROP POLICY IF EXISTS insights_isolation_policy ON insights;
CREATE POLICY insights_isolation_policy ON insights
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration 00006: Create Conversations and Messages Tables
-- ============================================================

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
DROP POLICY IF EXISTS conversations_isolation_policy ON conversations;
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
DROP POLICY IF EXISTS messages_isolation_policy ON messages;
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

-- ============================================================
-- Migration 00007: Create IRLs Table
-- ============================================================

-- Create IRLs table for Information Request Lists
CREATE TABLE IF NOT EXISTS irls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    template_type text,
    sections jsonb NOT NULL DEFAULT '[]',
    progress_percent int DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_irls_deal_id ON irls(deal_id);
CREATE INDEX IF NOT EXISTS idx_irls_user_id ON irls(user_id);

-- Enable Row Level Security
ALTER TABLE irls ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
DROP POLICY IF EXISTS irls_isolation_policy ON irls;
CREATE POLICY irls_isolation_policy ON irls
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration 00008: Create Q&A Lists Table
-- ============================================================

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
DROP POLICY IF EXISTS qa_lists_isolation_policy ON qa_lists;
CREATE POLICY qa_lists_isolation_policy ON qa_lists
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration 00009: Create CIMs Table
-- ============================================================

-- Create CIMs table for Confidential Information Memorandums
CREATE TABLE IF NOT EXISTS cims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    version int NOT NULL DEFAULT 1,
    title text NOT NULL,
    content jsonb NOT NULL DEFAULT '{}',
    workflow_state text DEFAULT 'draft' CHECK (workflow_state IN ('draft', 'in_progress', 'review', 'completed')),
    export_formats text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cims_deal_id ON cims(deal_id);
CREATE INDEX IF NOT EXISTS idx_cims_user_id ON cims(user_id);

-- Create unique constraint for version per deal
CREATE UNIQUE INDEX IF NOT EXISTS idx_cims_deal_version ON cims(deal_id, version);

-- Enable Row Level Security
ALTER TABLE cims ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data isolation
DROP POLICY IF EXISTS cims_isolation_policy ON cims;
CREATE POLICY cims_isolation_policy ON cims
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Migration 00010: Add Updated_at Triggers
-- ============================================================

-- Create the trigger function for auto-updating updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to deals table
DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to documents table
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to conversations table
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to irls table
DROP TRIGGER IF EXISTS update_irls_updated_at ON irls;
CREATE TRIGGER update_irls_updated_at
    BEFORE UPDATE ON irls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to qa_lists table
DROP TRIGGER IF EXISTS update_qa_lists_updated_at ON qa_lists;
CREATE TRIGGER update_qa_lists_updated_at
    BEFORE UPDATE ON qa_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to cims table
DROP TRIGGER IF EXISTS update_cims_updated_at ON cims;
CREATE TRIGGER update_cims_updated_at
    BEFORE UPDATE ON cims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Verification Queries (Optional - Run to verify schema)
-- ============================================================

-- Verify all tables were created
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Verify RLS is enabled on all tables
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;

-- Verify pgvector extension
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- List all RLS policies
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- ============================================================
-- Migration Complete
-- ============================================================
-- All 9 tables created: deals, documents, findings, insights,
-- conversations, messages, irls, qa_lists, cims
--
-- RLS policies enabled on all tables
-- pgvector extension enabled for semantic search
-- Updated_at triggers installed
-- ============================================================
