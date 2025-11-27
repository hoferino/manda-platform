"""
Semantic search API endpoints.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #4)

This module provides API endpoints for vector similarity search:
- GET /api/search/similar - Search for similar document chunks
"""

from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

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


@router.get("/similar", response_model=SimilarSearchResponse)
async def search_similar(
    query: str = Query(..., min_length=1, max_length=10000, description="Search query text"),
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    limit: int = Query(10, ge=1, le=100, description="Maximum results to return"),
    db: SupabaseClient = Depends(get_supabase_client),
    settings: Settings = Depends(get_settings),
) -> SimilarSearchResponse:
    """
    Search for similar document chunks using semantic similarity.

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
        HTTPException: On embedding generation or search errors
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


__all__ = ["router"]
