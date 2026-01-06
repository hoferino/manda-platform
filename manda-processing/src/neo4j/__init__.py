"""
Neo4j schema definitions for Manda platform.
Story: E12.10 - Fast Path Document Retrieval
"""

from .chunk_schema import (
    ChunkNode,
    CHUNK_INDEX_CYPHER,
    CHUNK_CONSTRAINTS_CYPHER,
    CHUNK_FULLTEXT_INDEX_CYPHER,
)

__all__ = [
    "ChunkNode",
    "CHUNK_INDEX_CYPHER",
    "CHUNK_CONSTRAINTS_CYPHER",
    "CHUNK_FULLTEXT_INDEX_CYPHER",
]
