"""
Unit tests for chunk schema.
Story: E12.10 - Fast Path Document Retrieval (AC: #1, #2)
"""

from datetime import datetime
from uuid import uuid4

import pytest

from src.neo4j.chunk_schema import (
    ChunkNode,
    CHUNK_INDEX_CYPHER,
    CHUNK_CONSTRAINTS_CYPHER,
    CHUNK_FULLTEXT_INDEX_CYPHER,
)


class TestChunkNode:
    """Tests for ChunkNode dataclass."""

    def test_chunk_node_creation(self):
        """Test creating a ChunkNode with required fields."""
        chunk_id = uuid4()
        doc_id = uuid4()
        deal_id = uuid4()
        org_id = uuid4()

        node = ChunkNode(
            id=chunk_id,
            content="Revenue increased 15% year-over-year.",
            embedding=[0.1] * 1024,
            document_id=doc_id,
            deal_id=deal_id,
            organization_id=org_id,
            group_id=f"{org_id}_{deal_id}",
            chunk_index=0,
        )

        assert node.id == chunk_id
        assert node.content == "Revenue increased 15% year-over-year."
        assert len(node.embedding) == 1024
        assert node.document_id == doc_id
        assert node.deal_id == deal_id
        assert node.organization_id == org_id
        assert node.chunk_index == 0
        assert node.chunk_type == "text"  # Default
        assert node.token_count == 0  # Default

    def test_chunk_node_optional_fields(self):
        """Test ChunkNode with optional fields."""
        node = ChunkNode(
            id=uuid4(),
            content="Table content",
            embedding=[0.5] * 1024,
            document_id=uuid4(),
            deal_id=uuid4(),
            organization_id=uuid4(),
            group_id="org_deal",
            chunk_index=5,
            page_number=10,
            chunk_type="table",
            token_count=150,
            created_at=datetime.now(),
        )

        assert node.page_number == 10
        assert node.chunk_type == "table"
        assert node.token_count == 150
        assert node.created_at is not None

    def test_embedding_dimensions(self):
        """Test that embedding has correct dimensions (1024 for Voyage)."""
        node = ChunkNode(
            id=uuid4(),
            content="Test",
            embedding=[0.1] * 1024,
            document_id=uuid4(),
            deal_id=uuid4(),
            organization_id=uuid4(),
            group_id="test",
            chunk_index=0,
        )

        assert len(node.embedding) == 1024


class TestChunkCypherQueries:
    """Tests for Cypher query constants."""

    def test_chunk_index_cypher_format(self):
        """Test that CHUNK_INDEX_CYPHER has correct format."""
        assert "CREATE VECTOR INDEX" in CHUNK_INDEX_CYPHER
        assert "chunk_embeddings" in CHUNK_INDEX_CYPHER
        assert "IF NOT EXISTS" in CHUNK_INDEX_CYPHER
        assert "1024" in CHUNK_INDEX_CYPHER  # Dimensions
        assert "cosine" in CHUNK_INDEX_CYPHER  # Similarity function

    def test_chunk_constraints_cypher_format(self):
        """Test that CHUNK_CONSTRAINTS_CYPHER has correct format."""
        assert "CREATE CONSTRAINT" in CHUNK_CONSTRAINTS_CYPHER
        assert "chunk_id_unique" in CHUNK_CONSTRAINTS_CYPHER
        assert "IF NOT EXISTS" in CHUNK_CONSTRAINTS_CYPHER
        assert "IS UNIQUE" in CHUNK_CONSTRAINTS_CYPHER

    def test_chunk_fulltext_index_cypher_format(self):
        """Test that CHUNK_FULLTEXT_INDEX_CYPHER has correct format."""
        assert "CREATE FULLTEXT INDEX" in CHUNK_FULLTEXT_INDEX_CYPHER
        assert "chunk_content_fulltext" in CHUNK_FULLTEXT_INDEX_CYPHER
        assert "IF NOT EXISTS" in CHUNK_FULLTEXT_INDEX_CYPHER
        assert "content" in CHUNK_FULLTEXT_INDEX_CYPHER
