-- Migration: 00041_remove_pgvector.sql
-- Purpose: Remove pgvector embeddings now that Graphiti + Neo4j is the single knowledge store
-- Epic: E10.8 PostgreSQL Cleanup
-- Prerequisite: E10.1-E10.7 must be complete and hybrid retrieval working
-- Previous migration: 00040_add_folder_sort_order.sql
--
-- NOTE: This is cleanup, not data migration. No production data to preserve.
-- All knowledge now lives in Graphiti + Neo4j with Voyage embeddings (1024d).
-- Old pgvector embeddings were OpenAI 3072d - completely replaced.

BEGIN;

-- ========================================
-- 1. Drop indexes on embedding columns
-- ========================================
-- Must drop indexes before dropping columns

-- document_chunks embedding index (HNSW with halfvec cast)
DROP INDEX IF EXISTS idx_chunks_embedding;
DROP INDEX IF EXISTS idx_document_chunks_embedding;
DROP INDEX IF EXISTS idx_document_chunks_embedding_hnsw;

-- findings embedding indexes (IVFFlat from 00004, HNSW from 00022)
DROP INDEX IF EXISTS idx_findings_embedding;
DROP INDEX IF EXISTS idx_findings_embedding_hnsw;
DROP INDEX IF EXISTS idx_findings_embedding_ivfflat;

-- ========================================
-- 2. Drop match_findings RPC function
-- ========================================
-- Replaced by Graphiti hybrid search: POST /api/search/hybrid
-- See: manda-processing/src/api/routes/search.py

DROP FUNCTION IF EXISTS match_findings(
    query_embedding vector(3072),
    match_threshold float,
    match_count int,
    p_deal_id uuid,
    p_document_id uuid,
    p_domains text[],
    p_statuses text[],
    p_confidence_min float,
    p_confidence_max float
);

-- Also drop any variant signatures that may exist
DROP FUNCTION IF EXISTS match_findings(vector, float, int, uuid, uuid, text[], text[], float, float);
DROP FUNCTION IF EXISTS match_findings(vector);

-- ========================================
-- 3. Remove embedding column from document_chunks
-- ========================================
-- Keeping table for document metadata reference (chunk_index, page_number, etc.)
-- Content and embeddings now in Graphiti EpisodicNodes

ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;

-- ========================================
-- 4. Remove embedding column from findings
-- ========================================
-- Keeping table for finding metadata (confidence, status, validation_history)
-- Content and embeddings now in Graphiti EntityEdges (facts)

ALTER TABLE findings DROP COLUMN IF EXISTS embedding;

-- ========================================
-- 5. Update table comments
-- ========================================
COMMENT ON TABLE document_chunks IS 'Document chunk metadata (index, page, type). Embeddings moved to Graphiti + Neo4j EpisodicNodes (E10 architecture).';
COMMENT ON TABLE findings IS 'Finding metadata (status, confidence, validation). Content and embeddings in Graphiti + Neo4j EntityEdges (E10 architecture).';

-- ========================================
-- 6. pgvector extension - KEEP for now
-- ========================================
-- The extension is harmless to keep and may be used for future features.
-- Uncomment below ONLY if you want to fully remove pgvector:
--
-- DROP EXTENSION IF EXISTS vector CASCADE;
--
-- Note: CASCADE would drop any remaining vector columns or functions.

COMMIT;

-- ========================================
-- Migration Summary (E10.8)
-- ========================================
-- REMOVED:
--   - document_chunks.embedding vector(3072)
--   - findings.embedding vector(3072)
--   - match_findings() RPC function
--   - All HNSW/IVFFlat indexes on embedding columns
--
-- KEPT:
--   - pgvector extension (harmless, may be useful later)
--   - document_chunks table (metadata for chunk navigation)
--   - findings table (metadata for finding management)
--
-- REPLACEMENT (E10.7):
--   - POST /api/search/hybrid (manda-processing)
--   - HybridRetrievalService + VoyageReranker
--   - Graphiti + Neo4j for all knowledge storage
