"""
Webhook endpoints for external triggers.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #1, #5)
Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #5)

This module provides webhook endpoints that trigger job processing:
- /webhooks/document-uploaded: Triggered when a document is uploaded
- /api/processing/retry/*: Stage-aware retry endpoints (E3.8)
"""

import hmac
import hashlib
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks
from pydantic import BaseModel, Field

from src.api.dependencies import verify_api_key, verify_webhook_signature
from src.config import get_settings
from src.jobs.queue import get_job_queue
from src.jobs.retry_manager import get_retry_manager

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/webhooks")


class DocumentUploadedPayload(BaseModel):
    """Payload for document-uploaded webhook."""

    document_id: UUID = Field(..., description="UUID of the uploaded document")
    deal_id: UUID = Field(..., description="UUID of the parent deal")
    user_id: UUID = Field(..., description="UUID of the user who uploaded")
    gcs_path: str = Field(..., description="Full GCS path (gs://bucket/path)")
    file_type: str = Field(..., description="File MIME type or extension")
    file_name: Optional[str] = Field(None, description="Original filename")
    is_retry: bool = Field(False, description="Whether this is a retry request (E3.8)")
    last_completed_stage: Optional[str] = Field(None, description="Last completed processing stage (E3.8)")


class WebhookResponse(BaseModel):
    """Response from webhook endpoints."""

    success: bool
    message: str
    job_id: Optional[str] = None


@router.post(
    "/document-uploaded",
    response_model=WebhookResponse,
    summary="Trigger document parsing",
    description="Webhook endpoint called when a document is uploaded to trigger parsing.",
)
async def document_uploaded(
    payload: DocumentUploadedPayload,
    background_tasks: BackgroundTasks,
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature"),
    api_key: str = Depends(verify_api_key),
) -> WebhookResponse:
    """
    Handle document-uploaded webhook.

    This endpoint is called by the Next.js frontend after a document
    is successfully uploaded to GCS. It enqueues a parse_document job.

    Args:
        payload: Document upload details
        background_tasks: FastAPI background tasks
        x_webhook_signature: Optional HMAC signature for verification
        api_key: API key from Authorization header

    Returns:
        WebhookResponse with job_id if successful
    """
    logger.info(
        "Received document-uploaded webhook",
        document_id=str(payload.document_id),
        deal_id=str(payload.deal_id),
        file_type=payload.file_type,
    )

    try:
        # Get job queue and enqueue parsing job
        queue = await get_job_queue()

        job_data = {
            "document_id": str(payload.document_id),
            "deal_id": str(payload.deal_id),
            "user_id": str(payload.user_id),
            "gcs_path": payload.gcs_path,
            "file_type": payload.file_type,
            "file_name": payload.file_name,
            "is_retry": payload.is_retry,  # E3.8: Pass retry flag
        }

        job_id = await queue.enqueue("document-parse", job_data)

        logger.info(
            "Document parse job enqueued",
            document_id=str(payload.document_id),
            job_id=job_id,
        )

        return WebhookResponse(
            success=True,
            message="Document parsing job enqueued",
            job_id=job_id,
        )

    except Exception as e:
        logger.error(
            "Failed to enqueue document parse job",
            document_id=str(payload.document_id),
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to enqueue parsing job: {str(e)}",
        )


@router.post(
    "/document-uploaded/batch",
    response_model=list[WebhookResponse],
    summary="Trigger document parsing for multiple documents",
    description="Batch webhook for multiple document uploads.",
)
async def document_uploaded_batch(
    payloads: list[DocumentUploadedPayload],
    api_key: str = Depends(verify_api_key),
) -> list[WebhookResponse]:
    """
    Handle batch document-uploaded webhook.

    Enqueues parsing jobs for multiple documents at once.

    Args:
        payloads: List of document upload details
        api_key: API key from Authorization header

    Returns:
        List of WebhookResponse for each document
    """
    logger.info(
        "Received batch document-uploaded webhook",
        document_count=len(payloads),
    )

    results = []
    queue = await get_job_queue()

    for payload in payloads:
        try:
            job_data = {
                "document_id": str(payload.document_id),
                "deal_id": str(payload.deal_id),
                "user_id": str(payload.user_id),
                "gcs_path": payload.gcs_path,
                "file_type": payload.file_type,
                "file_name": payload.file_name,
            }

            job_id = await queue.enqueue("document-parse", job_data)

            results.append(
                WebhookResponse(
                    success=True,
                    message="Document parsing job enqueued",
                    job_id=job_id,
                )
            )

        except Exception as e:
            logger.error(
                "Failed to enqueue job for document",
                document_id=str(payload.document_id),
                error=str(e),
            )
            results.append(
                WebhookResponse(
                    success=False,
                    message=f"Failed: {str(e)}",
                    job_id=None,
                )
            )

    logger.info(
        "Batch webhook processed",
        total=len(payloads),
        success=sum(1 for r in results if r.success),
        failed=sum(1 for r in results if not r.success),
    )

    return results


# ============================================================================
# E3.8: Stage-Aware Retry Endpoints
# ============================================================================

class RetryPayload(BaseModel):
    """Payload for retry endpoints (E3.8)."""

    document_id: UUID = Field(..., description="UUID of the document to retry")
    deal_id: UUID = Field(..., description="UUID of the parent deal")
    user_id: UUID = Field(..., description="UUID of the user")
    gcs_path: Optional[str] = Field(None, description="GCS path (optional, will be fetched if not provided)")
    file_type: Optional[str] = Field(None, description="File MIME type")
    file_name: Optional[str] = Field(None, description="Original filename")
    is_retry: bool = Field(True, description="Flag indicating this is a retry")
    last_completed_stage: Optional[str] = Field(None, description="Last completed stage")


# Create a separate router for retry endpoints under /api/processing
retry_router = APIRouter(prefix="/api/processing/retry")


@retry_router.post(
    "/embedding",
    response_model=WebhookResponse,
    summary="Retry embedding generation",
    description="E3.8: Trigger embedding generation retry for a document.",
)
async def retry_embedding(
    payload: RetryPayload,
    api_key: str = Depends(verify_api_key),
) -> WebhookResponse:
    """
    E3.8: Retry embedding generation for a document.

    Called when a document has completed parsing but failed during embedding.
    """
    logger.info(
        "Received embedding retry request",
        document_id=str(payload.document_id),
        last_completed_stage=payload.last_completed_stage,
    )

    try:
        # Check if manual retry is allowed (rate limiting + total cap)
        retry_manager = get_retry_manager()
        can_retry, deny_reason = await retry_manager.can_manual_retry(payload.document_id)

        if not can_retry:
            logger.info(
                "Manual retry denied",
                document_id=str(payload.document_id),
                reason=deny_reason,
            )
            raise HTTPException(
                status_code=429,
                detail=deny_reason or "Retry not allowed at this time",
            )

        queue = await get_job_queue()

        job_data = {
            "document_id": str(payload.document_id),
            "deal_id": str(payload.deal_id),
            "user_id": str(payload.user_id),
            "is_retry": True,
        }

        job_id = await queue.enqueue("generate-embeddings", job_data)

        logger.info(
            "Embedding retry job enqueued",
            document_id=str(payload.document_id),
            job_id=job_id,
        )

        return WebhookResponse(
            success=True,
            message="Embedding retry job enqueued",
            job_id=job_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to enqueue embedding retry job",
            document_id=str(payload.document_id),
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to enqueue embedding retry: {str(e)}",
        )


@retry_router.post(
    "/analysis",
    response_model=WebhookResponse,
    summary="Retry LLM analysis",
    description="E3.8: Trigger LLM analysis retry for a document.",
)
async def retry_analysis(
    payload: RetryPayload,
    api_key: str = Depends(verify_api_key),
) -> WebhookResponse:
    """
    E3.8: Retry LLM analysis for a document.

    Called when a document has completed embedding but failed during analysis.
    """
    logger.info(
        "Received analysis retry request",
        document_id=str(payload.document_id),
        last_completed_stage=payload.last_completed_stage,
    )

    try:
        # Check if manual retry is allowed (rate limiting + total cap)
        retry_manager = get_retry_manager()
        can_retry, deny_reason = await retry_manager.can_manual_retry(payload.document_id)

        if not can_retry:
            logger.info(
                "Manual retry denied",
                document_id=str(payload.document_id),
                reason=deny_reason,
            )
            raise HTTPException(
                status_code=429,
                detail=deny_reason or "Retry not allowed at this time",
            )

        queue = await get_job_queue()

        job_data = {
            "document_id": str(payload.document_id),
            "deal_id": str(payload.deal_id),
            "user_id": str(payload.user_id),
            "is_retry": True,
        }

        job_id = await queue.enqueue("analyze-document", job_data)

        logger.info(
            "Analysis retry job enqueued",
            document_id=str(payload.document_id),
            job_id=job_id,
        )

        return WebhookResponse(
            success=True,
            message="Analysis retry job enqueued",
            job_id=job_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to enqueue analysis retry job",
            document_id=str(payload.document_id),
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to enqueue analysis retry: {str(e)}",
        )


__all__ = ["router", "retry_router"]
