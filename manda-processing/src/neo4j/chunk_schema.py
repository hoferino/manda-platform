"""
Chunk schema for fast path document retrieval.
Story: E12.10 - Fast Path Document Retrieval (AC: #1, #2, #7)

Provides immediate query capability while Graphiti extraction runs in parallel.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import UUID


@dataclass
class ChunkNode:
    """
    Neo4j node for fast path document retrieval.

    Stored in Neo4j with Voyage voyage-3.5 embeddings (1024d) for
    immediate vector search capability after document parsing.

    Attributes:
        id: Unique chunk identifier (UUID)
        content: Raw text content from document chunk
        embedding: 1024-dimensional Voyage voyage-3.5 embedding
        document_id: Reference to PostgreSQL document
        deal_id: Deal UUID for scoping
        organization_id: Organization UUID for namespace isolation
        group_id: Composite "{org_id}_{deal_id}" for multi-tenant isolation
        chunk_index: Position in document (0-indexed)
        page_number: Optional page number for PDF/Word docs
        chunk_type: Type from Docling (text, table, list, etc.)
        token_count: Estimated token count for cost tracking
        created_at: Timestamp of chunk creation
    """

    id: UUID
    content: str
    embedding: list[float]  # 1024 dimensions
    document_id: UUID
    deal_id: UUID
    organization_id: UUID
    group_id: str  # Format: "{org_id}_{deal_id}"
    chunk_index: int
    page_number: Optional[int] = None
    chunk_type: str = "text"
    token_count: int = 0
    created_at: Optional[datetime] = None


# Neo4j Cypher for schema initialization
CHUNK_INDEX_CYPHER = """
// Create vector index for chunk embeddings (1024d Voyage voyage-3.5)
CREATE VECTOR INDEX chunk_embeddings IF NOT EXISTS
FOR (c:Chunk)
ON (c.embedding)
OPTIONS {indexConfig: {
    `vector.dimensions`: 1024,
    `vector.similarity_function`: 'cosine'
}}
"""

CHUNK_CONSTRAINTS_CYPHER = """
// Unique constraint on chunk ID
CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS
FOR (c:Chunk)
REQUIRE c.id IS UNIQUE
"""

# BM25 full-text index for hybrid search (optional enhancement)
CHUNK_FULLTEXT_INDEX_CYPHER = """
CREATE FULLTEXT INDEX chunk_content_fulltext IF NOT EXISTS
FOR (c:Chunk)
ON EACH [c.content]
"""


__all__ = [
    "ChunkNode",
    "CHUNK_INDEX_CYPHER",
    "CHUNK_CONSTRAINTS_CYPHER",
    "CHUNK_FULLTEXT_INDEX_CYPHER",
]
