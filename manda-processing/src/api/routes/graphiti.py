"""
Graphiti knowledge graph API endpoints.
Story: E11.3 - Agent-Autonomous Knowledge Write-Back (AC: #4, #6)

This module provides API endpoints for Graphiti knowledge graph operations:
- POST /api/graphiti/ingest - Ingest chat facts into knowledge base
"""

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from src.api.dependencies import ApiKeyDep
from src.storage.supabase_client import SupabaseClient, get_supabase_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/graphiti", tags=["Graphiti"])


# =============================================================================
# Request/Response Models
# =============================================================================


class IngestRequest(BaseModel):
    """Request for ingesting a fact into the knowledge base."""

    deal_id: str = Field(..., description="Deal UUID for namespace isolation")
    content: str = Field(..., min_length=10, description="Factual content to persist")
    source_type: Literal["correction", "confirmation", "new_info"] = Field(
        ..., description="Type of knowledge being persisted"
    )
    message_context: str | None = Field(
        None, description="Optional full message context for richer extraction"
    )


class IngestResponse(BaseModel):
    """Response from knowledge ingestion."""

    success: bool
    episode_count: int
    elapsed_ms: int
    estimated_cost_usd: float


# =============================================================================
# Helper Functions
# =============================================================================


async def verify_deal_exists(deal_id: str, db: SupabaseClient) -> bool:
    """
    Verify that a deal exists in the database.

    Note: User-level authorization is handled by the frontend via RLS.
    This service validates API key auth and that the deal exists.

    Args:
        deal_id: The deal UUID to verify
        db: Supabase client

    Returns:
        True if deal exists, False otherwise
    """
    try:
        result = await db.client.table("deals").select("id").eq("id", deal_id).execute()
        return len(result.data) > 0
    except Exception as e:
        logger.error("Failed to verify deal exists", deal_id=deal_id, error=str(e))
        return False


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/ingest", response_model=IngestResponse)
async def ingest_chat_fact(
    request: IngestRequest,
    api_key: ApiKeyDep,  # Require API key authentication
    db: SupabaseClient = Depends(get_supabase_client),
) -> IngestResponse:
    """
    Ingest a chat fact into the Graphiti knowledge base.

    Story: E11.3 - Agent-Autonomous Knowledge Write-Back (AC: #4, #6)

    This endpoint receives facts from the agent's autonomous persistence
    decisions and stores them in Graphiti for future retrieval. Facts are
    immediately available via hybrid search (hot path, not background).

    The source_type determines confidence handling:
    - correction: Agent detected user correction of existing fact
    - confirmation: User confirmed an existing fact
    - new_info: New factual information from user

    Args:
        request: IngestRequest with deal_id, content, source_type

    Returns:
        IngestResponse with success status and metrics

    Raises:
        HTTPException: On validation errors or ingestion failures
    """
    logger.info(
        "Knowledge ingest request",
        deal_id=request.deal_id,
        source_type=request.source_type,
        content_length=len(request.content),
    )

    # Verify deal exists (API key validates service-to-service auth)
    if not await verify_deal_exists(request.deal_id, db):
        logger.warning(
            "Knowledge ingest for non-existent deal",
            deal_id=request.deal_id,
        )
        raise HTTPException(
            status_code=404,
            detail=f"Deal not found: {request.deal_id}",
        )

    try:
        # Import here to avoid circular imports and lazy load
        from src.graphiti.ingestion import GraphitiIngestionService

        service = GraphitiIngestionService()

        # Generate unique message ID for this fact
        message_id = f"chat-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"

        # Ingest the fact using existing service
        result = await service.ingest_chat_fact(
            message_id=message_id,
            deal_id=request.deal_id,
            fact_content=request.content,
            message_context=request.message_context or request.content,
        )

        logger.info(
            "Knowledge ingestion completed",
            deal_id=request.deal_id,
            source_type=request.source_type,
            episode_count=result.episode_count,
            elapsed_ms=result.elapsed_ms,
        )

        return IngestResponse(
            success=True,
            episode_count=result.episode_count,
            elapsed_ms=result.elapsed_ms,
            estimated_cost_usd=result.estimated_cost_usd,
        )

    except HTTPException:
        raise  # Re-raise HTTP errors
    except Exception as e:
        logger.error(
            "Knowledge ingestion failed",
            error=str(e),
            error_type=type(e).__name__,
            deal_id=request.deal_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Knowledge ingestion service unavailable",
        )


__all__ = ["router"]
