-- Migration: 00003_create_documents_table
-- Description: Create documents table with RLS policies and cascade delete
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables), #3 (RLS Policies), #4 (Foreign Key Constraints)

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
CREATE POLICY documents_isolation_policy ON documents
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE documents IS 'Tracks uploaded documents with processing status';
COMMENT ON COLUMN documents.deal_id IS 'Parent deal - cascade deletes when deal is deleted';
COMMENT ON COLUMN documents.file_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN documents.processing_status IS 'Document parsing/analysis status';
