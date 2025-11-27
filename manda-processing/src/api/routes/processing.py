"""
Processing Queue API endpoints.
Story: E3.7 - Implement Processing Queue Visibility (AC: #3, #4)

This module provides API endpoints for viewing and managing the processing queue:
- GET /api/processing/queue - List active jobs in the processing queue
- DELETE /api/processing/queue/{job_id} - Cancel a queued job
"""

import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from src.api.dependencies import verify_api_key
from src.config import Settings, get_settings
from src.jobs.queue import get_pool, get_job_queue, JobState
from src.storage.supabase_client import SupabaseClient, DatabaseError, get_supabase_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/processing", tags=["Processing"])


# Response models
class QueueJob(BaseModel):
    """Individual job in the processing queue."""

    id: str
    document_id: str = Field(alias="documentId")
    document_name: str = Field(alias="documentName")
    file_type: str = Field(alias="fileType")
    status: str  # 'queued' | 'processing' | 'failed'
    processing_stage: Optional[str] = Field(alias="processingStage")  # 'parsing' | 'embedding' | 'analyzing' | null
    created_at: str = Field(alias="createdAt")
    started_at: Optional[str] = Field(alias="startedAt")
    time_in_queue: int = Field(alias="timeInQueue")  # seconds
    estimated_completion: Optional[str] = Field(alias="estimatedCompletion")
    retry_count: int = Field(alias="retryCount")
    error: Optional[str] = None

    model_config = {"populate_by_name": True}


class QueueResponse(BaseModel):
    """Response from queue listing endpoint."""

    jobs: list[QueueJob]
    total: int
    has_more: bool = Field(alias="hasMore")

    model_config = {"populate_by_name": True}


class CancelResponse(BaseModel):
    """Response from cancel endpoint."""

    success: bool
    message: str


def _map_job_state_to_status(state: str) -> str:
    """Map pg-boss job state to user-friendly status."""
    state_mapping = {
        "created": "queued",
        "retry": "queued",  # Retry jobs are still in queue
        "active": "processing",
        "failed": "failed",
    }
    return state_mapping.get(state, "queued")


def _map_job_name_to_stage(job_name: str, state: str) -> Optional[str]:
    """Map pg-boss job name to processing stage."""
    if state != "active":
        return None

    stage_mapping = {
        "document-parse": "parsing",
        "generate-embeddings": "embedding",
        "analyze-document": "analyzing",
    }
    return stage_mapping.get(job_name)


def _calculate_time_in_queue(created_on: datetime) -> int:
    """Calculate time in queue in seconds."""
    if not created_on:
        return 0
    now = datetime.now(timezone.utc)
    # Handle naive datetimes
    if created_on.tzinfo is None:
        created_on = created_on.replace(tzinfo=timezone.utc)
    diff = now - created_on
    return int(diff.total_seconds())


def _estimate_completion(file_type: str, job_name: str, started_at: Optional[datetime]) -> Optional[str]:
    """Estimate completion time based on file type and job."""
    if not started_at:
        return None

    # Rough estimates in seconds based on job type
    estimates = {
        "document-parse": 30,  # 30 seconds for parsing
        "generate-embeddings": 20,  # 20 seconds for embeddings
        "analyze-document": 60,  # 60 seconds for analysis
    }

    # Adjust for file type
    multipliers = {
        "application/pdf": 1.5,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 2.0,  # Excel
        "application/vnd.ms-excel": 2.0,
    }

    base_time = estimates.get(job_name, 30)
    multiplier = multipliers.get(file_type, 1.0)
    estimated_seconds = int(base_time * multiplier)

    # Handle naive datetimes
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    estimated_completion = started_at.replace(tzinfo=timezone.utc) + __import__("datetime").timedelta(seconds=estimated_seconds)
    return estimated_completion.isoformat()


@router.get("/queue", response_model=QueueResponse)
async def get_queue_jobs(
    project_id: UUID = Query(..., description="Filter by project ID"),
    limit: int = Query(20, ge=1, le=100, description="Maximum jobs to return"),
    offset: int = Query(0, ge=0, description="Number of jobs to skip"),
    api_key: str = Depends(verify_api_key),
    settings: Settings = Depends(get_settings),
) -> QueueResponse:
    """
    Get active jobs in the processing queue for a project.

    Returns jobs that are queued (created, retry) or actively processing (active).
    Jobs are filtered by project_id for multi-tenant isolation.

    Args:
        project_id: UUID of the project to filter jobs for
        limit: Maximum number of jobs to return (1-100)
        offset: Number of jobs to skip for pagination

    Returns:
        QueueResponse with list of jobs, total count, and pagination info
    """
    logger.info(
        "Queue jobs request",
        project_id=str(project_id),
        limit=limit,
        offset=offset,
    )

    try:
        pool = await get_pool()

        async with pool.acquire() as conn:
            # Query pg-boss jobs joined with documents for metadata
            # Filter by project_id (deal_id in documents table)
            query = f"""
                SELECT
                    j.id,
                    j.name,
                    j.state,
                    j.data,
                    j.createdon,
                    j.startedon,
                    j.retrycount,
                    j.output,
                    d.id as doc_id,
                    d.name as file_name,
                    d.mime_type as file_type,
                    d.processing_status
                FROM {settings.pgboss_schema}.job j
                LEFT JOIN documents d ON (j.data->>'document_id')::uuid = d.id
                WHERE d.deal_id = $1
                AND j.state IN ('created', 'active', 'retry')
                ORDER BY j.createdon ASC
                LIMIT $2 OFFSET $3
            """

            rows = await conn.fetch(query, project_id, limit + 1, offset)

            # Count total
            count_query = f"""
                SELECT COUNT(*) as total
                FROM {settings.pgboss_schema}.job j
                LEFT JOIN documents d ON (j.data->>'document_id')::uuid = d.id
                WHERE d.deal_id = $1
                AND j.state IN ('created', 'active', 'retry')
            """
            count_row = await conn.fetchrow(count_query, project_id)
            total = count_row["total"] if count_row else 0

        # Determine if there are more results
        has_more = len(rows) > limit
        rows = rows[:limit]  # Trim to requested limit

        # Transform to response model
        jobs = []
        for row in rows:
            job_data = json.loads(row["data"]) if row["data"] else {}
            error_output = None
            if row["output"]:
                try:
                    output_data = json.loads(row["output"])
                    error_output = output_data.get("error")
                except (json.JSONDecodeError, TypeError):
                    pass

            job = QueueJob(
                id=str(row["id"]),
                documentId=str(row["doc_id"]) if row["doc_id"] else job_data.get("document_id", ""),
                documentName=row["file_name"] or job_data.get("file_name", "Unknown"),
                fileType=row["file_type"] or job_data.get("file_type", "application/octet-stream"),
                status=_map_job_state_to_status(row["state"]),
                processingStage=_map_job_name_to_stage(row["name"], row["state"]),
                createdAt=row["createdon"].isoformat() if row["createdon"] else "",
                startedAt=row["startedon"].isoformat() if row["startedon"] else None,
                timeInQueue=_calculate_time_in_queue(row["createdon"]),
                estimatedCompletion=_estimate_completion(
                    row["file_type"] or "",
                    row["name"],
                    row["startedon"]
                ),
                retryCount=row["retrycount"] or 0,
                error=error_output,
            )
            jobs.append(job)

        logger.info(
            "Queue jobs retrieved",
            project_id=str(project_id),
            job_count=len(jobs),
            total=total,
        )

        return QueueResponse(
            jobs=jobs,
            total=total,
            hasMore=has_more,
        )

    except Exception as e:
        logger.error(
            "Error fetching queue jobs",
            project_id=str(project_id),
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch processing queue",
        )


@router.delete("/queue/{job_id}", response_model=CancelResponse)
async def cancel_job(
    job_id: str,
    project_id: UUID = Query(..., description="Project ID for authorization"),
    api_key: str = Depends(verify_api_key),
    settings: Settings = Depends(get_settings),
    db: SupabaseClient = Depends(get_supabase_client),
) -> CancelResponse:
    """
    Cancel a queued job.

    Only jobs in 'created' state (not yet started) can be cancelled.
    Jobs that are already processing ('active' state) cannot be cancelled.

    Args:
        job_id: UUID of the job to cancel
        project_id: UUID of the project (for authorization)

    Returns:
        CancelResponse with success status and message
    """
    logger.info(
        "Cancel job request",
        job_id=job_id,
        project_id=str(project_id),
    )

    try:
        pool = await get_pool()

        async with pool.acquire() as conn:
            # First, verify the job exists and belongs to the project
            verify_query = f"""
                SELECT
                    j.id,
                    j.state,
                    j.data,
                    d.deal_id as project_id
                FROM {settings.pgboss_schema}.job j
                LEFT JOIN documents d ON (j.data->>'document_id')::uuid = d.id
                WHERE j.id = $1
            """
            job_row = await conn.fetchrow(verify_query, job_id)

            if not job_row:
                raise HTTPException(
                    status_code=404,
                    detail="Job not found",
                )

            # Check project authorization
            if job_row["project_id"] != project_id:
                raise HTTPException(
                    status_code=403,
                    detail="Job does not belong to this project",
                )

            # Check job state - only cancel 'created' jobs
            if job_row["state"] != "created":
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot cancel job in '{job_row['state']}' state. Only queued jobs can be cancelled.",
                )

            # Extract document_id from job data
            job_data = json.loads(job_row["data"]) if job_row["data"] else {}
            document_id = job_data.get("document_id")

            # Cancel the job by updating state to 'cancelled'
            cancel_query = f"""
                UPDATE {settings.pgboss_schema}.job
                SET state = 'cancelled',
                    completedon = NOW()
                WHERE id = $1 AND state = 'created'
                RETURNING id
            """
            result = await conn.fetchrow(cancel_query, job_id)

            if not result:
                raise HTTPException(
                    status_code=409,
                    detail="Job state changed during cancellation. Please try again.",
                )

            # Update document processing status to 'cancelled'
            if document_id:
                try:
                    await db.update_document_status(
                        UUID(document_id),
                        "cancelled",
                    )
                    logger.info(
                        "Document status updated to cancelled",
                        document_id=document_id,
                    )
                except DatabaseError as e:
                    # Log but don't fail - job is already cancelled
                    logger.warning(
                        "Failed to update document status",
                        document_id=document_id,
                        error=str(e),
                    )

        logger.info(
            "Job cancelled successfully",
            job_id=job_id,
            document_id=document_id,
        )

        return CancelResponse(
            success=True,
            message="Job cancelled successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error cancelling job",
            job_id=job_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to cancel job",
        )


__all__ = ["router"]
