"""
Agent API endpoints for specialist agents.
Story: E13.5 - Financial Analyst Specialist Agent (AC: #4)

This module provides REST API endpoints for invoking specialist agents:
- POST /api/agents/financial-analyst/invoke - Invoke financial analyst specialist

All endpoints require organization context for multi-tenant isolation (E12.9).
"""

import asyncio
import time
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from src.agents import (
    FinancialAnalysisResult,
    FinancialDependencies,
    get_financial_analyst_agent,
)
from src.agents.financial_analyst import log_financial_usage
from src.config import get_agent_model_config, get_settings
from src.storage.supabase_client import get_supabase_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/agents")


# =============================================================================
# Request/Response Models
# =============================================================================


class FinancialAnalystRequest(BaseModel):
    """Request body for financial analyst invocation."""

    query: str = Field(
        description="The financial analysis query to answer",
        min_length=1,
        max_length=10000,
    )
    deal_id: str = Field(
        description="UUID of the deal to analyze",
    )
    organization_id: Optional[str] = Field(
        default=None,
        description="Organization UUID (can also be provided via x-organization-id header)",
    )
    document_ids: Optional[list[str]] = Field(
        default=None,
        description="Optional list of document UUIDs to filter analysis to",
    )
    context: Optional[str] = Field(
        default=None,
        description="Additional context from supervisor or previous conversation",
    )


class FinancialAnalystResponse(BaseModel):
    """Response from financial analyst invocation."""

    success: bool = Field(description="Whether the invocation succeeded")
    result: Optional[FinancialAnalysisResult] = Field(
        default=None,
        description="The analysis result if successful",
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if invocation failed",
    )
    model_used: Optional[str] = Field(
        default=None,
        description="Which model was used (primary or fallback)",
    )
    latency_ms: Optional[int] = Field(
        default=None,
        description="Total latency in milliseconds",
    )


# =============================================================================
# Endpoints
# =============================================================================


@router.post(
    "/financial-analyst/invoke",
    response_model=FinancialAnalystResponse,
    summary="Invoke Financial Analyst Specialist",
    description="""
    Invoke the Financial Analyst specialist agent to analyze financial data.

    This specialist is optimized for M&A financial analysis including:
    - EBITDA normalization and add-back identification
    - Working capital analysis and adjustments
    - Quality of Earnings (QoE) analysis
    - Financial ratio calculations
    - Period-over-period comparisons

    **Multi-tenant Isolation (E12.9):**
    Organization context is required via either:
    - `organization_id` in request body, OR
    - `x-organization-id` header

    **Usage Example:**
    ```json
    {
        "query": "What is the normalized EBITDA after adjustments?",
        "deal_id": "550e8400-e29b-41d4-a716-446655440000",
        "organization_id": "123e4567-e89b-12d3-a456-426614174000"
    }
    ```
    """,
    responses={
        200: {"description": "Analysis completed successfully"},
        400: {"description": "Invalid request parameters"},
        401: {"description": "Missing organization context"},
        500: {"description": "Internal server error during analysis"},
    },
)
async def invoke_financial_analyst(
    request: FinancialAnalystRequest,
    x_organization_id: Optional[str] = Header(default=None, alias="x-organization-id"),
) -> FinancialAnalystResponse:
    """
    Invoke the Financial Analyst specialist agent.

    Args:
        request: The analysis request with query and context
        x_organization_id: Organization ID from header (alternative to body)

    Returns:
        FinancialAnalystResponse with analysis result or error
    """
    start_time = time.time()

    # Resolve organization_id (body takes precedence over header)
    org_id = request.organization_id or x_organization_id
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Organization context required. Provide organization_id in body or x-organization-id header.",
        )

    logger.info(
        "financial_analyst_invoke_started",
        deal_id=request.deal_id,
        organization_id=org_id,
        query_length=len(request.query),
        document_count=len(request.document_ids) if request.document_ids else 0,
    )

    try:
        # Validate UUIDs
        try:
            UUID(request.deal_id)
            UUID(org_id)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid UUID format: {str(e)}",
            )

        # Get agent configuration (needed for timeout and model info)
        config = get_agent_model_config("financial_analyst")

        # Get clients
        db = get_supabase_client()

        # Get Graphiti client if available
        graphiti = None
        settings = get_settings()
        if settings.neo4j_password:
            try:
                from src.graphiti.client import GraphitiClient

                graphiti = await GraphitiClient.get_instance()
            except Exception as e:
                logger.warning(
                    "graphiti_unavailable",
                    error=str(e),
                    deal_id=request.deal_id,
                )

        # Create dependencies
        deps = FinancialDependencies(
            db=db,
            graphiti=graphiti,
            deal_id=request.deal_id,
            organization_id=org_id,
            document_ids=request.document_ids or [],
            context_window=request.context or "",
        )

        # Get the agent
        agent = get_financial_analyst_agent()

        # Get timeout from config (default 60s for complex financial analysis)
        agent_timeout = config.get("settings", {}).get("timeout", 60)

        # Run the agent with timeout protection
        try:
            result = await asyncio.wait_for(
                agent.run(request.query, deps=deps),
                timeout=agent_timeout,
            )
        except asyncio.TimeoutError:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(
                "financial_analyst_timeout",
                deal_id=request.deal_id,
                organization_id=org_id,
                timeout_seconds=agent_timeout,
                latency_ms=latency_ms,
            )
            return FinancialAnalystResponse(
                success=False,
                error=f"Agent timed out after {agent_timeout} seconds",
                latency_ms=latency_ms,
            )

        # Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)

        # Log usage
        model_str = config.get("primary", "anthropic:claude-sonnet-4-0")

        try:
            await log_financial_usage(
                result=result,
                model_str=model_str,
                db=db,
                organization_id=org_id,
                deal_id=request.deal_id,
                latency_ms=latency_ms,
            )
        except Exception as e:
            logger.warning("failed_to_log_usage", error=str(e))

        logger.info(
            "financial_analyst_invoke_completed",
            deal_id=request.deal_id,
            organization_id=org_id,
            latency_ms=latency_ms,
            findings_count=len(result.data.findings) if result.data else 0,
        )

        return FinancialAnalystResponse(
            success=True,
            result=result.data,
            model_used=model_str,
            latency_ms=latency_ms,
        )

    except HTTPException:
        raise
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        logger.error(
            "financial_analyst_invoke_error",
            error=str(e),
            error_type=type(e).__name__,
            deal_id=request.deal_id,
            organization_id=org_id,
            latency_ms=latency_ms,
        )
        return FinancialAnalystResponse(
            success=False,
            error=str(e),
            latency_ms=latency_ms,
        )


@router.get(
    "/financial-analyst/health",
    summary="Financial Analyst Health Check",
    description="Check if the Financial Analyst agent is configured and ready.",
)
async def financial_analyst_health() -> dict:
    """Health check for the Financial Analyst agent."""
    try:
        config = get_agent_model_config("financial_analyst")
        return {
            "status": "ready",
            "primary_model": config.get("primary"),
            "fallback_model": config.get("fallback"),
            "settings": config.get("settings", {}),
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }
