"""
Webhook endpoints for external triggers.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #1, #5)

This module provides webhook endpoints that trigger job processing:
- /webhooks/document-uploaded: Triggered when a document is uploaded
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


__all__ = ["router"]
