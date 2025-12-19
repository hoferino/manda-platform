"""
Graphiti knowledge graph API endpoints.
Story: E11.3 - Agent-Autonomous Knowledge Write-Back (AC: #4, #6)

This module provides API endpoints for Graphiti knowledge graph operations:
- POST /api/graphiti/ingest - Ingest chat facts into knowledge base
"""

import time
from collections import defaultdict
from dataclasses import asdict
from datetime import datetime, timezone
from threading import Lock
from typing import Annotated, Literal
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator

from src.api.dependencies import ApiKeyDep
from src.storage.supabase_client import SupabaseClient, get_supabase_client

logger = structlog.get_logger(__name__)


# =============================================================================
# Rate Limiting (Issue #4: Prevent abuse/cost overruns)
# =============================================================================

# Simple in-memory rate limiter: 10 requests per minute per deal_id
RATE_LIMIT_REQUESTS = 10
RATE_LIMIT_WINDOW_SECONDS = 60

_rate_limit_data: dict[str, list[float]] = defaultdict(list)
_rate_limit_lock = Lock()


def check_rate_limit(deal_id: str) -> bool:
    """
    Check if request is within rate limit for the given deal_id.

    Returns True if allowed, raises HTTPException if rate limited.
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS

    with _rate_limit_lock:
        # Clean up old timestamps
        _rate_limit_data[deal_id] = [
            ts for ts in _rate_limit_data[deal_id] if ts > window_start
        ]

        # Check if over limit
        if len(_rate_limit_data[deal_id]) >= RATE_LIMIT_REQUESTS:
            logger.warning(
                "Rate limit exceeded for knowledge ingest",
                deal_id=deal_id,
                requests_in_window=len(_rate_limit_data[deal_id]),
            )
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: max {RATE_LIMIT_REQUESTS} ingests per minute per deal",
            )

        # Record this request
        _rate_limit_data[deal_id].append(now)

    return True

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

    @field_validator("deal_id")
    @classmethod
    def validate_deal_id_is_uuid(cls, v: str) -> str:
        """Validate that deal_id is a valid UUID string."""
        try:
            UUID(v)
        except ValueError:
            raise ValueError("deal_id must be a valid UUID")
        return v


class IngestResponse(BaseModel):
    """Response from knowledge ingestion."""

    success: bool
    episode_count: int
    elapsed_ms: int
    estimated_cost_usd: float


# =============================================================================
# Helper Functions
# =============================================================================


class DealVerificationResult:
    """Result of deal verification - distinguishes not-found from DB errors."""

    def __init__(self, exists: bool, db_error: bool = False):
        self.exists = exists
        self.db_error = db_error


async def verify_deal_exists(deal_id: str, db: SupabaseClient) -> DealVerificationResult:
    """
    Verify that a deal exists in the database.

    Note: User-level authorization is handled by the frontend via RLS.
    This service validates API key auth and that the deal exists.

    Args:
        deal_id: The deal UUID to verify
        db: Supabase client

    Returns:
        DealVerificationResult with exists flag and db_error flag
    """
    try:
        result = await db.client.table("deals").select("id").eq("id", deal_id).execute()
        return DealVerificationResult(exists=len(result.data) > 0)
    except Exception as e:
        logger.error(
            "Database error verifying deal",
            deal_id=deal_id,
            error_type=type(e).__name__,
            # Don't log full error message to avoid leaking details
        )
        return DealVerificationResult(exists=False, db_error=True)


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

    # Check rate limit before processing (Issue #4)
    check_rate_limit(request.deal_id)

    # Verify deal exists (API key validates service-to-service auth)
    deal_check = await verify_deal_exists(request.deal_id, db)

    # Issue #7: Return 503 on DB error instead of 404
    if deal_check.db_error:
        raise HTTPException(
            status_code=503,
            detail="Database temporarily unavailable",
        )

    if not deal_check.exists:
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

        # Generate unique message ID for this fact with source_type prefix
        message_id = f"chat-{request.source_type}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"

        # Build enriched context with source attribution (AC#7)
        enriched_context = (
            f"[Source: {request.source_type}] "
            f"{request.message_context or request.content}"
        )

        # Ingest the fact using existing service
        result = await service.ingest_chat_fact(
            message_id=message_id,
            deal_id=request.deal_id,
            fact_content=request.content,
            message_context=enriched_context,
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
