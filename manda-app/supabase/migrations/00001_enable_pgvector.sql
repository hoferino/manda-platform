-- Migration: 00001_enable_pgvector
-- Description: Enable pgvector extension for semantic search capabilities
-- Story: E1.3 - Create PostgreSQL Schema with RLS Policies
-- AC: #6 (pgvector Configuration)

-- Enable pgvector extension for vector similarity search
-- pgvector 0.8+ supports text-embedding-3-large (1536 dimensions)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is enabled
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension failed to enable';
    END IF;
END $$;
