"""
Chunk-based retrieval for fast path document queries.
Story: E12.10 - Fast Path Document Retrieval (AC: #4, #5)

Provides immediate query capability via Neo4j vector search on ChunkNodes.
Used as fallback when Graphiti knowledge graph has no results.
"""

import time
from dataclasses import dataclass
from typing import Optional

import structlog

from src.embeddings.voyage_client import get_voyage_client
from src.graphiti.client import GraphitiClient

logger = structlog.get_logger(__name__)


@dataclass
class ChunkSearchResult:
    """Result from chunk-based vector search."""

    chunk_id: str
    content: str
    score: float  # Cosine similarity (0-1)
    document_id: str
    page_number: Optional[int] = None
    chunk_type: str = "text"


@dataclass
class ChunkRetrievalResult:
    """Complete result from chunk retrieval."""

    results: list[ChunkSearchResult]
    latency_ms: int
    embed_latency_ms: int
    search_latency_ms: int


async def search_chunks(
    query: str,
    deal_id: str,
    organization_id: str,
    num_results: int = 10,
    score_threshold: float = 0.3,
) -> ChunkRetrievalResult:
    """
    Search ChunkNodes via Neo4j vector similarity.

    Story: E12.10 - Fast Path Document Retrieval (AC: #4, #5)

    Args:
        query: Natural language search query
        deal_id: Deal UUID for scoping
        organization_id: Organization UUID for namespace isolation
        num_results: Maximum results to return
        score_threshold: Minimum cosine similarity score (0-1)

    Returns:
        ChunkRetrievalResult with matching chunks and timing

    Target latency: < 500ms
    """
    start_time = time.perf_counter()

    # E12.9: Composite group_id for multi-tenant isolation
    group_id = f"{organization_id}_{deal_id}"

    # Embed query with Voyage
    embed_start = time.perf_counter()
    voyage_client = get_voyage_client()
    query_embedding = await voyage_client.embed_query(query)
    embed_latency_ms = int((time.perf_counter() - embed_start) * 1000)

    # Vector search in Neo4j
    search_start = time.perf_counter()
    graphiti_client = await GraphitiClient.get_instance()
    driver = graphiti_client.driver

    results: list[ChunkSearchResult] = []

    async with driver.session() as session:
        # Use Neo4j vector index for similarity search
        # Filter by group_id for multi-tenant isolation
        query_result = await session.run(
            """
            CALL db.index.vector.queryNodes('chunk_embeddings', $num_results, $embedding)
            YIELD node, score
            WHERE node.group_id = $group_id AND score >= $score_threshold
            RETURN
                node.id AS chunk_id,
                node.content AS content,
                score,
                node.document_id AS document_id,
                node.page_number AS page_number,
                node.chunk_type AS chunk_type
            ORDER BY score DESC
            LIMIT $num_results
            """,
            embedding=query_embedding,
            group_id=group_id,
            num_results=num_results * 2,  # Fetch extra for filtering
            score_threshold=score_threshold,
        )

        async for record in query_result:
            results.append(
                ChunkSearchResult(
                    chunk_id=record["chunk_id"],
                    content=record["content"],
                    score=record["score"],
                    document_id=record["document_id"],
                    page_number=record["page_number"],
                    chunk_type=record["chunk_type"],
                )
            )

    search_latency_ms = int((time.perf_counter() - search_start) * 1000)
    total_latency_ms = int((time.perf_counter() - start_time) * 1000)

    logger.info(
        "Chunk search completed",
        query=query[:50],
        group_id=group_id,
        results_count=len(results),
        latency_ms=total_latency_ms,
        embed_ms=embed_latency_ms,
        search_ms=search_latency_ms,
    )

    # Warn if exceeds target
    if total_latency_ms > 500:
        logger.warning(
            "Chunk search exceeded target latency",
            latency_ms=total_latency_ms,
            target_ms=500,
        )

    return ChunkRetrievalResult(
        results=results[:num_results],
        latency_ms=total_latency_ms,
        embed_latency_ms=embed_latency_ms,
        search_latency_ms=search_latency_ms,
    )


__all__ = ["search_chunks", "ChunkSearchResult", "ChunkRetrievalResult"]
