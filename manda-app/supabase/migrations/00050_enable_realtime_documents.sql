-- Migration: 00050_enable_realtime_documents
-- Description: Enable Supabase Realtime on documents table for live updates
-- Story: E3.6 - Create Processing Status Tracking and WebSocket Updates
-- Fixes: Data room requires manual refresh to see document updates

-- Enable REPLICA IDENTITY FULL for the documents table
-- This is required for UPDATE and DELETE events to include the old row data
ALTER TABLE documents REPLICA IDENTITY FULL;

-- Add the documents table to the supabase_realtime publication
-- This enables real-time subscriptions to the documents table
-- Note: The publication may already exist, so we use IF NOT EXISTS pattern
DO $$
BEGIN
    -- Check if the publication exists
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Add documents table to the publication if not already added
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = 'documents'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE documents;
        END IF;
    ELSE
        -- Create the publication with the documents table
        CREATE PUBLICATION supabase_realtime FOR TABLE documents;
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE documents IS 'Tracks uploaded documents with processing status. Realtime enabled for live UI updates.';
