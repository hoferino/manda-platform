"""
Document parsing job handler.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #1-6)

This handler processes parse_document jobs from the pg-boss queue:
1. Downloads document from GCS
2. Parses document using Docling parser
3. Stores chunks in database
4. Updates document status
5. Enqueues next job (generate_embeddings)
"""

import time
from typing import Any, Optional
from uuid import UUID
from pathlib import Path

import structlog

from src.config import Settings, get_settings
from src.jobs.queue import Job, EnqueueOptions, get_job_queue
from src.parsers import (
    ParseResult,
    ParseError,
    UnsupportedFileTypeError,
    CorruptFileError,
    FileTooLargeError,
    get_file_category,
)
from src.storage.gcs_client import (
    GCSClient,
    GCSDownloadError,
    GCSFileNotFoundError,
    get_gcs_client,
)
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)


def _create_docling_parser():
    """Create a DoclingParser instance (lazy import to avoid import errors in tests)."""
    from src.parsers.docling_parser import create_docling_parser
    return create_docling_parser()

logger = structlog.get_logger(__name__)


# Errors that should NOT trigger retry (permanent failures)
NON_RETRYABLE_ERRORS = (
    GCSFileNotFoundError,
    UnsupportedFileTypeError,
    CorruptFileError,
    FileTooLargeError,
)


class ParseDocumentHandler:
    """
    Handler for parse_document jobs.

    Orchestrates the document parsing pipeline:
    GCS Download -> Parse -> Store Chunks -> Update Status -> Enqueue Next
    """

    def __init__(
        self,
        gcs_client: Optional[GCSClient] = None,
        db_client: Optional[SupabaseClient] = None,
        parser: Optional[Any] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            gcs_client: GCS client for file download
            db_client: Database client for storage
            parser: Document parser (DoclingParser or compatible)
            config: Application settings
        """
        self.gcs = gcs_client or get_gcs_client()
        self.db = db_client or get_supabase_client()
        self.parser = parser or _create_docling_parser()
        self.config = config or get_settings()

        logger.info("ParseDocumentHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle a parse_document job.

        Args:
            job: The job to process

        Returns:
            Result dict with success status and metrics

        Raises:
            Exception: Re-raised if error should trigger retry
        """
        start_time = time.perf_counter()
        job_data = job.data

        # Extract required fields from job payload
        document_id = UUID(job_data["document_id"])
        gcs_path = job_data["gcs_path"]
        file_type = job_data.get("file_type", "")
        deal_id = job_data.get("deal_id")
        user_id = job_data.get("user_id")
        file_name = job_data.get("file_name", "unknown")

        logger.info(
            "Processing parse_document job",
            job_id=job.id,
            document_id=str(document_id),
            gcs_path=gcs_path,
            file_type=file_type,
            retry_count=job.retry_count,
        )

        try:
            # Update status to processing
            await self.db.update_document_status(document_id, "processing")

            # Download from GCS
            async with self.gcs.download_temp_file(gcs_path) as temp_path:
                logger.info(
                    "File downloaded, starting parse",
                    document_id=str(document_id),
                    temp_path=str(temp_path),
                )

                # Determine file type from path if not provided
                if not file_type:
                    file_type = temp_path.suffix.lstrip(".")

                # Parse the document
                parse_result = await self.parser.parse(temp_path, file_type)

            # Store chunks and update status atomically
            chunks_stored = await self.db.store_chunks_and_update_status(
                document_id=document_id,
                chunks=parse_result.chunks,
                tables=parse_result.tables,
                formulas=parse_result.formulas,
                new_status="parsed",
            )

            # Enqueue the next job
            next_job_id = await self._enqueue_next_job(
                document_id=document_id,
                chunks_count=chunks_stored,
                deal_id=deal_id,
                user_id=user_id,
            )

            # Calculate metrics
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            result = {
                "success": True,
                "document_id": str(document_id),
                "chunks_created": chunks_stored,
                "tables_extracted": len(parse_result.tables),
                "formulas_extracted": len(parse_result.formulas),
                "parse_time_ms": parse_result.parse_time_ms or 0,
                "total_time_ms": elapsed_ms,
                "next_job_id": next_job_id,
            }

            logger.info(
                "parse_document job completed",
                job_id=job.id,
                **result,
            )

            return result

        except NON_RETRYABLE_ERRORS as e:
            # Permanent failures - mark document as failed
            logger.error(
                "parse_document job failed permanently",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
            )

            await self._handle_permanent_failure(document_id, str(e))

            # Re-raise to let worker mark job as failed
            raise

        except (GCSDownloadError, DatabaseError) as e:
            # Potentially retryable errors
            logger.warning(
                "parse_document job failed (may retry)",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
                retryable=getattr(e, "retryable", True),
            )

            if not getattr(e, "retryable", True):
                await self._handle_permanent_failure(document_id, str(e))

            raise

        except Exception as e:
            # Unexpected errors - log and re-raise
            logger.error(
                "parse_document job failed unexpectedly",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
                exc_info=True,
            )

            raise

    async def _enqueue_next_job(
        self,
        document_id: UUID,
        chunks_count: int,
        deal_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Enqueue the generate_embeddings job.

        Args:
            document_id: UUID of the processed document
            chunks_count: Number of chunks to embed
            deal_id: Parent deal ID
            user_id: User who uploaded

        Returns:
            The enqueued job ID
        """
        queue = await get_job_queue()

        job_data = {
            "document_id": str(document_id),
            "chunks_count": chunks_count,
        }

        if deal_id:
            job_data["deal_id"] = deal_id
        if user_id:
            job_data["user_id"] = user_id

        job_id = await queue.enqueue("generate-embeddings", job_data)

        logger.info(
            "Enqueued generate-embeddings job",
            document_id=str(document_id),
            next_job_id=job_id,
            chunks_count=chunks_count,
        )

        return job_id

    async def _handle_permanent_failure(
        self,
        document_id: UUID,
        error_message: str,
    ) -> None:
        """
        Handle permanent job failure by updating document status.

        Args:
            document_id: UUID of the failed document
            error_message: Error description
        """
        try:
            await self.db.update_document_status(
                document_id=document_id,
                processing_status="failed",
                error_message=error_message,
            )
        except Exception as e:
            # Log but don't raise - the original error is more important
            logger.error(
                "Failed to update document status after failure",
                document_id=str(document_id),
                error=str(e),
            )


# Handler instance factory
_handler: Optional[ParseDocumentHandler] = None


def get_parse_document_handler() -> ParseDocumentHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = ParseDocumentHandler()
    return _handler


async def handle_parse_document(job: Job) -> dict[str, Any]:
    """
    Entry point for parse_document job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_parse_document_handler()
    return await handler.handle(job)


__all__ = [
    "ParseDocumentHandler",
    "handle_parse_document",
    "get_parse_document_handler",
]
