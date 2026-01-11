"""
Semantic search API endpoints.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #4)
Story: E10.7 - Hybrid Retrieval with Reranking (AC: #1, #5, #7)

This module provides API endpoints for vector similarity search:
- GET /api/search/similar - Search for similar document chunks
- POST /api/search/hybrid - Hybrid search using Graphiti + Voyage reranking
"""

from typing import Literal, Optional
from uuid import UUID

import asyncpg
import structlog
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from src.api.dependencies import ApiKeyDep
from src.config import Settings, get_settings
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/search", tags=["Search"])


# Response models
class SimilarChunkResult(BaseModel):
    """A single search result."""

    chunk_id: UUID
    document_id: UUID
    document_name: str
    project_id: Optional[UUID] = None
    content: str
    content_preview: str = Field(description="First 500 chars of content")
    chunk_type: str
    page_number: Optional[int] = None
    chunk_index: int
    similarity: float = Field(ge=0, le=1, description="Similarity score (0-1)")


class SimilarSearchResponse(BaseModel):
    """Response from similarity search endpoint."""

    query: str
    results: list[SimilarChunkResult]
    total_results: int


# Dependency to get embedding client (lazy load)
def get_embedding_client():
    """Get embedding client for query embedding generation."""
    from src.embeddings.openai_client import get_embedding_client as _get_client
    return _get_client()


@router.get("/similar", response_model=SimilarSearchResponse, deprecated=True)
async def search_similar(
    query: str = Query(..., min_length=1, max_length=10000, description="Search query text"),
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    limit: int = Query(10, ge=1, le=100, description="Maximum results to return"),
    db: SupabaseClient = Depends(get_supabase_client),
    settings: Settings = Depends(get_settings),
) -> SimilarSearchResponse:
    """
    DEPRECATED: Use POST /api/search/hybrid instead.

    E10.8: This endpoint is deprecated. The pgvector embeddings have been removed.
    Use the new Graphiti hybrid search endpoint (POST /api/search/hybrid) which provides:
    - Vector + BM25 + graph search
    - Voyage AI reranking (20-35% accuracy improvement)
    - Temporal awareness via invalid_at filtering
    - Deal isolation via namespace

    This endpoint will be removed in a future release.

    ---

    [LEGACY] Search for similar document chunks using semantic similarity.

    The query text is converted to an embedding vector using OpenAI's
    text-embedding-3-large model, then compared against stored chunk
    embeddings using cosine similarity.

    Args:
        query: The search query text
        project_id: Optional filter to search within a specific project
        document_id: Optional filter to search within a specific document
        limit: Maximum number of results to return (1-100)

    Returns:
        SimilarSearchResponse with ranked results and similarity scores

    Raises:
        HTTPException: On embedding generation or search errors (503 expected after E10.8)
    """
    logger.info(
        "Similarity search request",
        query_length=len(query),
        project_id=str(project_id) if project_id else None,
        document_id=str(document_id) if document_id else None,
        limit=limit,
    )

    try:
        # Get embedding client and generate query embedding
        embedding_client = get_embedding_client()
        query_embedding = await embedding_client.generate_single(query)

        # Search for similar chunks
        results = await db.search_similar_chunks(
            query_embedding=query_embedding,
            project_id=project_id,
            document_id=document_id,
            limit=limit,
        )

        # Transform results to response model
        search_results = []
        for row in results:
            content = row["content"]
            search_results.append(
                SimilarChunkResult(
                    chunk_id=row["chunk_id"],
                    document_id=row["document_id"],
                    document_name=row["document_name"] or "Unknown",
                    project_id=row.get("project_id"),
                    content=content,
                    content_preview=content[:500] + "..." if len(content) > 500 else content,
                    chunk_type=row["chunk_type"],
                    page_number=row.get("page_number"),
                    chunk_index=row["chunk_index"],
                    similarity=float(row["similarity"]),
                )
            )

        response = SimilarSearchResponse(
            query=query,
            results=search_results,
            total_results=len(search_results),
        )

        logger.info(
            "Similarity search completed",
            result_count=len(search_results),
            top_similarity=search_results[0].similarity if search_results else None,
        )

        return response

    except DatabaseError as e:
        logger.error(
            "Database error in similarity search",
            error=str(e),
        )
        raise HTTPException(
            status_code=503,
            detail="Search service temporarily unavailable",
        )

    except Exception as e:
        # Check for embedding errors
        error_type = type(e).__name__

        # Import here to avoid circular imports
        try:
            from src.embeddings.openai_client import EmbeddingError
            if isinstance(e, EmbeddingError):
                logger.error(
                    "Embedding error in similarity search",
                    error=str(e),
                )
                raise HTTPException(
                    status_code=503,
                    detail="Search service temporarily unavailable (embedding error)",
                )
        except ImportError:
            pass

        logger.error(
            "Unexpected error in similarity search",
            error=str(e),
            error_type=error_type,
        )
        raise HTTPException(
            status_code=500,
            detail="Internal server error",
        )


# =============================================================================
# Hybrid Search (E10.7 - Graphiti + Voyage Reranking)
# =============================================================================


class HybridSearchRequest(BaseModel):
    """Request for hybrid search using Graphiti + Voyage reranking."""

    query: str = Field(..., min_length=1, max_length=10000, description="Search query text")
    deal_id: str = Field(..., description="Deal UUID for namespace isolation")
    num_results: int = Field(default=10, ge=1, le=50, description="Number of results to return")
    search_method: Optional[Literal["hybrid", "vector", "auto"]] = Field(
        default="auto",
        description=(
            "Search method selection for performance optimization (Story 3-1 AC #2). "
            "'vector': Fast vector-only search (~100ms), best for simple factual queries. "
            "'hybrid': Full vector + BM25 + graph search (~300-500ms), best for complex relational queries. "
            "'auto': Use hybrid (default)."
        ),
    )


class HybridSourceCitation(BaseModel):
    """Citation information for a search result."""

    type: Literal["document", "qa", "chat"]
    id: str
    title: str
    excerpt: Optional[str] = None
    page: Optional[int] = None
    chunk_index: Optional[int] = None
    confidence: float = Field(ge=0, le=1)


class HybridSearchResult(BaseModel):
    """A single hybrid search result."""

    id: str
    content: str
    score: float = Field(ge=0, le=1, description="Reranker relevance score")
    source_type: Literal["episode", "entity", "fact"]
    source_channel: str
    confidence: float = Field(ge=0, le=1)
    citation: Optional[HybridSourceCitation] = None


class HybridSearchResponse(BaseModel):
    """Response from hybrid search endpoint."""

    query: str
    results: list[HybridSearchResult]
    sources: list[HybridSourceCitation]
    entities: list[str]
    latency_ms: int
    result_count: int
    rag_mode: str = Field(default="graphiti", description="RAG mode used: graphiti, semantic, or google_file_search")


async def verify_deal_exists(deal_id: str, db: SupabaseClient) -> bool:
    """
    Verify that a deal exists in the database.

    Note: User-level authorization is handled by the frontend via RLS.
    This service validates API key auth and that the deal exists.

    Args:
        deal_id: The deal UUID to verify
        db: Supabase client (provides asyncpg pool)

    Returns:
        True if deal exists, False otherwise
    """
    try:
        pool = await db._get_pool()
        async with pool.acquire() as conn:
            result = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM deals WHERE id = $1)",
                UUID(deal_id),
            )
            return bool(result)
    except (asyncpg.PostgresError, ValueError) as e:
        logger.error("Failed to verify deal exists", deal_id=deal_id, error=str(e))
        return False


@router.post("/hybrid", response_model=HybridSearchResponse)
async def hybrid_search(
    request: HybridSearchRequest,
    api_key: ApiKeyDep,  # Require API key authentication
    db: SupabaseClient = Depends(get_supabase_client),
) -> HybridSearchResponse:
    """
    Hybrid search using Graphiti knowledge graph + Voyage reranking.

    Story: E10.7 - Hybrid Retrieval with Reranking

    Pipeline:
    1. Graphiti hybrid search (vector + BM25 + graph) → 50 candidates
    2. Voyage reranker (rerank-2.5) scores and reorders → Top N
    3. Filter superseded facts and format with citations

    Target latency: < 3 seconds

    Args:
        request: HybridSearchRequest with query, deal_id, num_results

    Returns:
        HybridSearchResponse with ranked results and citations

    Raises:
        HTTPException: On validation errors or search failures
    """
    logger.info(
        "Hybrid search request",
        query_length=len(request.query),
        deal_id=request.deal_id,
        num_results=request.num_results,
        search_method=request.search_method,
    )

    # Verify deal exists (API key validates service-to-service auth)
    if not await verify_deal_exists(request.deal_id, db):
        logger.warning(
            "Hybrid search for non-existent deal",
            deal_id=request.deal_id,
        )
        raise HTTPException(
            status_code=404,
            detail=f"Deal not found: {request.deal_id}",
        )

    try:
        # Import here to avoid circular imports and lazy load
        from src.graphiti import HybridRetrievalService, get_retrieval_service
        from src.graphiti.chunk_retrieval import search_chunks

        # Story 3-1 AC #2: Search method selection for performance optimization
        # 'vector' uses fast chunk search (~100ms), 'hybrid' uses full graph search (~300-500ms)
        search_method = request.search_method or "auto"

        if search_method == "vector":
            # Fast path: vector-only search via chunk retrieval
            # Best for simple factual queries like "What is Q3 revenue?"
            chunk_result = await search_chunks(
                query=request.query,
                deal_id=request.deal_id,
                organization_id=request.deal_id,  # Temporary: use deal_id until schema updated
                num_results=request.num_results,
            )
            # Convert chunk result to standard retrieval result format
            service = HybridRetrievalService()
            result = service._convert_chunk_result(chunk_result)
        else:
            # Full hybrid path: vector + BM25 + graph traversal
            # Best for complex relational queries like "How does X relate to Y?"
            service = get_retrieval_service()
            result = await service.retrieve(
                query=request.query,
                deal_id=request.deal_id,
                num_results=request.num_results,
            )

        # Transform results to response model
        response_results = []
        response_sources = []

        for item in result.results:
            # Convert citation
            citation = None
            if item.citation:
                citation = HybridSourceCitation(
                    type=item.citation.type,
                    id=item.citation.id,
                    title=item.citation.title,
                    excerpt=item.citation.excerpt,
                    page=item.citation.page,
                    chunk_index=item.citation.chunk_index,
                    confidence=item.citation.confidence,
                )

            response_results.append(
                HybridSearchResult(
                    id=item.id,
                    content=item.content,
                    score=item.score,
                    source_type=item.source_type,
                    source_channel=item.source_channel,
                    confidence=item.confidence,
                    citation=citation,
                )
            )

        for source in result.sources:
            response_sources.append(
                HybridSourceCitation(
                    type=source.type,
                    id=source.id,
                    title=source.title,
                    excerpt=source.excerpt,
                    page=source.page,
                    chunk_index=source.chunk_index,
                    confidence=source.confidence,
                )
            )

        # Get current RAG mode for response - reflect actual method used
        from src.config import get_settings
        if search_method == "vector":
            current_rag_mode = "vector"
        else:
            current_rag_mode = get_settings().rag_mode

        response = HybridSearchResponse(
            query=request.query,
            results=response_results,
            sources=response_sources,
            entities=result.entities,
            latency_ms=result.latency_ms,
            result_count=len(response_results),
            rag_mode=current_rag_mode,
        )

        logger.info(
            "Hybrid search completed",
            result_count=len(response_results),
            latency_ms=result.latency_ms,
            top_score=response_results[0].score if response_results else None,
            rag_mode=current_rag_mode,
        )

        return response

    except HTTPException:
        raise  # Re-raise HTTP errors
    except Exception as e:
        # E12.6: Check for Graphiti connection errors (graceful degradation)
        error_str = str(e).lower()
        is_connection_error = any(term in error_str for term in [
            'neo4j', 'graphiti', 'connection', 'unavailable', 'timeout'
        ])

        if is_connection_error:
            logger.warning(
                "Graphiti/Neo4j unavailable, returning empty results",
                error=str(e),
                deal_id=request.deal_id,
            )
            # Return empty results for graceful degradation
            from src.config import get_settings
            return HybridSearchResponse(
                query=request.query,
                results=[],
                sources=[],
                entities=[],
                latency_ms=0,
                result_count=0,
                rag_mode=get_settings().rag_mode,
            )

        logger.error(
            "Hybrid search failed",
            error=str(e),
            error_type=type(e).__name__,
            deal_id=request.deal_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Hybrid search service unavailable",
        )


__all__ = ["router"]
