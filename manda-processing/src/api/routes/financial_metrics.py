"""
API endpoints for financial metrics.
Story: E3.9 - Financial Model Integration (AC: #5)

Provides REST endpoints for:
- Querying financial metrics by project, document, or criteria
- Getting financial metrics for a specific document
"""

from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Query

from src.storage.supabase_client import get_supabase_client, DatabaseError
from src.models.financial_metrics import (
    MetricCategory,
    FinancialMetricsListResponse,
    FinancialMetricResponse,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/v1/financial-metrics", tags=["Financial Metrics"])


def _to_response_model(metric: dict) -> FinancialMetricResponse:
    """
    Convert a database metric record to API response model.

    Args:
        metric: Database record dict

    Returns:
        FinancialMetricResponse instance
    """
    return FinancialMetricResponse(
        id=metric["id"],
        document_id=metric["document_id"],
        finding_id=metric.get("finding_id"),
        metric_name=metric["metric_name"],
        metric_category=metric["metric_category"],
        value=metric.get("value"),
        unit=metric.get("unit"),
        period_type=metric.get("period_type"),
        fiscal_year=metric.get("fiscal_year"),
        fiscal_quarter=metric.get("fiscal_quarter"),
        source_cell=metric.get("source_cell"),
        source_sheet=metric.get("source_sheet"),
        source_page=metric.get("source_page"),
        source_formula=metric.get("source_formula"),
        is_actual=metric.get("is_actual", True),
        confidence_score=metric.get("confidence_score"),
        notes=metric.get("notes"),
        created_at=metric["created_at"],
    )


@router.get(
    "",
    response_model=FinancialMetricsListResponse,
    summary="Query financial metrics",
    description="Query financial metrics with optional filters for project, document, metric name, category, fiscal year, and actual/projection status.",
)
async def query_financial_metrics(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    metric_name: Optional[str] = Query(None, description="Filter by metric name (partial match)"),
    metric_category: Optional[MetricCategory] = Query(None, description="Filter by category"),
    fiscal_year: Optional[int] = Query(None, ge=1900, le=2100, description="Filter by fiscal year"),
    is_actual: Optional[bool] = Query(None, description="Filter by actual (true) or projection (false)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> FinancialMetricsListResponse:
    """
    Query financial metrics with filtering and pagination.

    Returns metrics matching the specified criteria, with source attribution.
    """
    logger.info(
        "Querying financial metrics",
        project_id=str(project_id) if project_id else None,
        document_id=str(document_id) if document_id else None,
        metric_name=metric_name,
        metric_category=metric_category.value if metric_category else None,
        fiscal_year=fiscal_year,
        is_actual=is_actual,
        limit=limit,
        offset=offset,
    )

    try:
        db = get_supabase_client()
        metrics, total = await db.query_financial_metrics(
            project_id=project_id,
            document_id=document_id,
            metric_name=metric_name,
            metric_category=metric_category.value if metric_category else None,
            fiscal_year=fiscal_year,
            is_actual=is_actual,
            limit=limit,
            offset=offset,
        )

        # Convert to response models
        response_metrics = [_to_response_model(m) for m in metrics]

        return FinancialMetricsListResponse(
            metrics=response_metrics,
            total=total,
            limit=limit,
            offset=offset,
        )

    except DatabaseError as e:
        logger.error("Database error querying financial metrics", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to query financial metrics")


@router.get(
    "/documents/{document_id}",
    response_model=FinancialMetricsListResponse,
    summary="Get financial metrics for a document",
    description="Get all financial metrics extracted from a specific document.",
)
async def get_document_financial_metrics(
    document_id: UUID,
) -> FinancialMetricsListResponse:
    """
    Get all financial metrics for a specific document.

    Returns all metrics extracted from the document with full source attribution.
    """
    logger.info(
        "Getting financial metrics for document",
        document_id=str(document_id),
    )

    try:
        db = get_supabase_client()
        metrics = await db.get_financial_metrics(document_id)

        # Convert to response models
        response_metrics = [_to_response_model(m) for m in metrics]

        return FinancialMetricsListResponse(
            metrics=response_metrics,
            total=len(response_metrics),
            limit=len(response_metrics),
            offset=0,
        )

    except DatabaseError as e:
        logger.error(
            "Database error getting document financial metrics",
            document_id=str(document_id),
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to get financial metrics")


@router.get(
    "/summary",
    summary="Get financial metrics summary",
    description="Get a summary of financial metrics grouped by category and metric name.",
)
async def get_financial_metrics_summary(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    fiscal_year: Optional[int] = Query(None, ge=1900, le=2100, description="Filter by fiscal year"),
) -> dict:
    """
    Get a summary of financial metrics grouped by category.

    Useful for dashboards and overview displays.
    """
    logger.info(
        "Getting financial metrics summary",
        project_id=str(project_id) if project_id else None,
        fiscal_year=fiscal_year,
    )

    try:
        db = get_supabase_client()

        # Query all metrics (up to 1000) for the project
        metrics, total = await db.query_financial_metrics(
            project_id=project_id,
            fiscal_year=fiscal_year,
            limit=1000,
            offset=0,
        )

        # Build summary by category
        summary: dict = {
            "total_metrics": total,
            "by_category": {},
            "by_metric_name": {},
            "years_covered": set(),
        }

        for m in metrics:
            category = m.get("metric_category", "unknown")
            metric_name = m.get("metric_name", "unknown")
            year = m.get("fiscal_year")

            # Count by category
            if category not in summary["by_category"]:
                summary["by_category"][category] = 0
            summary["by_category"][category] += 1

            # Count by metric name
            if metric_name not in summary["by_metric_name"]:
                summary["by_metric_name"][metric_name] = 0
            summary["by_metric_name"][metric_name] += 1

            # Track years
            if year:
                summary["years_covered"].add(year)

        # Convert set to sorted list
        summary["years_covered"] = sorted(list(summary["years_covered"]))

        return summary

    except DatabaseError as e:
        logger.error(
            "Database error getting financial metrics summary",
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to get financial metrics summary")


__all__ = ["router"]
