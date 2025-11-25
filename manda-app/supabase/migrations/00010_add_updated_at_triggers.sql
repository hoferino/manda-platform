-- Migration: 00010_add_updated_at_triggers
-- Description: Add automatic updated_at timestamp triggers to all tables
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #2 (Core Tables)

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

-- Add comment for documentation
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically sets updated_at to current timestamp on row update';
