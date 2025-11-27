"""
Analyze document job handler for LLM-based finding extraction.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #1, #4, #5)

This handler processes analyze-document jobs from the pg-boss queue:
1. Updates document status to 'analyzing'
2. Loads chunks from database
3. Selects appropriate model tier based on document type
4. Extracts findings using Gemini LLM
5. Stores findings in database
6. Updates document status to 'analyzed'
7. Enqueues next job (extract_financials for xlsx, or marks complete)
"""

import time
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.jobs.queue import Job, get_job_queue
from src.llm.models import ModelTier, select_model_tier
from src.models.findings import FindingCreate, finding_from_dict
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)

logger = structlog.get_logger(__name__)


# Errors that should NOT trigger retry (permanent failures)
NON_RETRYABLE_ERRORS = (
    ValueError,  # Invalid input data
)

# MIME types that require financial extraction step
EXCEL_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroenabled.12",
}


def _create_gemini_client():
    """Create a Gemini client (lazy import to avoid import errors in tests)."""
    from src.llm.client import GeminiClient

    return GeminiClient()


class AnalyzeDocumentHandler:
    """
    Handler for analyze-document jobs.

    Orchestrates the LLM analysis pipeline:
    Load Chunks -> Select Model -> Extract Findings -> Store -> Update Status -> Enqueue Next
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        llm_client: Optional[Any] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            db_client: Database client for storage
            llm_client: Gemini LLM client
            config: Application settings
        """
        self.db = db_client or get_supabase_client()
        self.llm_client = llm_client or _create_gemini_client()
        self.config = config or get_settings()

        logger.info("AnalyzeDocumentHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an analyze-document job.

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
        deal_id = job_data.get("deal_id")
        user_id = job_data.get("user_id")

        logger.info(
            "Processing analyze-document job",
            job_id=job.id,
            document_id=str(document_id),
            retry_count=job.retry_count,
        )

        try:
            # Update status to analyzing
            await self.db.update_document_status(document_id, "analyzing")

            # Get document info for model selection and context
            doc = await self.db.get_document(document_id)
            if not doc:
                raise ValueError(f"Document not found: {document_id}")

            file_type = doc.get("mime_type", "")
            document_name = doc.get("name", "Unknown")
            project_id = doc.get("deal_id")  # deal_id is the project_id

            if not project_id:
                raise ValueError(f"Document has no project_id: {document_id}")

            # Select model tier based on document type
            model_tier = select_model_tier(file_type)

            logger.info(
                "Selected model tier",
                document_id=str(document_id),
                file_type=file_type,
                model_tier=model_tier.value,
            )

            # Load chunks from database
            chunks = await self.db.get_chunks_by_document(document_id)

            if not chunks:
                logger.warning(
                    "No chunks found for document",
                    document_id=str(document_id),
                )
                # Still mark as analyzed (empty document case)
                await self.db.update_document_status(document_id, "analyzed")

                # Determine next job
                if file_type in EXCEL_MIME_TYPES:
                    next_job_id = await self._enqueue_next_job(
                        "extract-financials", document_id, deal_id, user_id
                    )
                else:
                    await self.db.update_document_status(document_id, "complete")
                    next_job_id = None

                return {
                    "success": True,
                    "document_id": str(document_id),
                    "findings_count": 0,
                    "chunks_analyzed": 0,
                    "model_tier": model_tier.value,
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                    "next_job_id": next_job_id,
                }

            # Prepare context for analysis
            context = {
                "document_name": document_name,
                "project_name": "",  # Could fetch project name if needed
                "document_id": str(document_id),
                "project_id": str(project_id),
            }

            # Convert chunks to format expected by LLM client
            chunk_data = [
                {
                    "id": str(chunk["id"]),
                    "content": chunk["content"],
                    "page_number": chunk.get("page_number"),
                    "chunk_type": chunk.get("chunk_type", "text"),
                    "chunk_index": chunk.get("chunk_index", 0),
                }
                for chunk in chunks
            ]

            # Analyze chunks with LLM
            batch_size = self.config.llm_analysis_batch_size
            analysis_result = await self.llm_client.analyze_batch(
                chunks=chunk_data,
                context=context,
                model_tier=model_tier,
                batch_size=batch_size,
            )

            logger.info(
                "LLM analysis complete",
                document_id=str(document_id),
                findings_count=analysis_result.finding_count,
                input_tokens=analysis_result.total_input_tokens,
                output_tokens=analysis_result.total_output_tokens,
            )

            # Convert raw findings to FindingCreate models
            findings_to_store: list[FindingCreate] = []
            for finding_data in analysis_result.findings:
                try:
                    # Get chunk_id from finding data
                    chunk_id = None
                    if finding_data.get("chunk_id"):
                        try:
                            chunk_id = UUID(finding_data["chunk_id"])
                        except (ValueError, TypeError):
                            pass

                    finding = finding_from_dict(
                        data=finding_data,
                        project_id=UUID(str(project_id)),
                        document_id=document_id,
                        chunk_id=chunk_id,
                    )
                    findings_to_store.append(finding)
                except Exception as e:
                    logger.warning(
                        "Failed to convert finding",
                        error=str(e),
                        finding_preview=str(finding_data)[:100],
                    )

            # Store findings and update status atomically
            if findings_to_store:
                stored_count = await self.db.store_findings_and_update_status(
                    document_id=document_id,
                    project_id=UUID(str(project_id)),
                    user_id=UUID(user_id) if user_id else None,
                    findings=findings_to_store,
                    new_status="analyzed",
                )
            else:
                stored_count = 0
                await self.db.update_document_status(document_id, "analyzed")

            # Enqueue next job based on file type
            if file_type in EXCEL_MIME_TYPES:
                next_job_id = await self._enqueue_next_job(
                    "extract-financials", document_id, deal_id, user_id
                )
            else:
                # Non-Excel files are complete after analysis
                await self.db.update_document_status(document_id, "complete")
                next_job_id = None

            # Calculate metrics
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            result = {
                "success": True,
                "document_id": str(document_id),
                "findings_count": stored_count,
                "chunks_analyzed": len(chunks),
                "model_tier": model_tier.value,
                "input_tokens": analysis_result.total_input_tokens,
                "output_tokens": analysis_result.total_output_tokens,
                "estimated_cost_usd": analysis_result.estimated_cost_usd,
                "total_time_ms": elapsed_ms,
                "next_job_id": next_job_id,
            }

            logger.info(
                "analyze-document job completed",
                job_id=job.id,
                **result,
            )

            return result

        except NON_RETRYABLE_ERRORS as e:
            # Permanent failures - mark document as failed
            logger.error(
                "analyze-document job failed permanently",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
            )

            await self._handle_permanent_failure(document_id, str(e))
            raise

        except DatabaseError as e:
            # Potentially retryable database errors
            logger.warning(
                "analyze-document job failed (may retry)",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
                retryable=e.retryable,
            )

            if not e.retryable:
                await self._handle_permanent_failure(document_id, str(e))

            raise

        except Exception as e:
            # Check if it's an LLM error
            error_type = type(e).__name__

            # Import here to avoid circular imports
            from src.llm.client import GeminiError

            if isinstance(e, GeminiError):
                if not e.retryable:
                    logger.error(
                        "analyze-document job failed permanently (LLM error)",
                        job_id=job.id,
                        document_id=str(document_id),
                        error=str(e),
                    )
                    await self._handle_permanent_failure(document_id, str(e))
                else:
                    logger.warning(
                        "analyze-document job failed (LLM error, may retry)",
                        job_id=job.id,
                        document_id=str(document_id),
                        error=str(e),
                    )
                raise

            # Unexpected errors - log and re-raise
            logger.error(
                "analyze-document job failed unexpectedly",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=error_type,
                exc_info=True,
            )
            raise

    async def _enqueue_next_job(
        self,
        job_name: str,
        document_id: UUID,
        deal_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Enqueue the next job in the pipeline.

        Args:
            job_name: Name of job to enqueue
            document_id: UUID of the processed document
            deal_id: Parent deal/project ID
            user_id: User who uploaded

        Returns:
            The enqueued job ID
        """
        queue = await get_job_queue()

        job_data = {
            "document_id": str(document_id),
        }

        if deal_id:
            job_data["deal_id"] = deal_id
        if user_id:
            job_data["user_id"] = user_id

        job_id = await queue.enqueue(job_name, job_data)

        logger.info(
            f"Enqueued {job_name} job",
            document_id=str(document_id),
            next_job_id=job_id,
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
                processing_status="analysis_failed",
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
_handler: Optional[AnalyzeDocumentHandler] = None


def get_analyze_document_handler() -> AnalyzeDocumentHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = AnalyzeDocumentHandler()
    return _handler


async def handle_analyze_document(job: Job) -> dict[str, Any]:
    """
    Entry point for analyze-document job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_analyze_document_handler()
    return await handler.handle(job)


__all__ = [
    "AnalyzeDocumentHandler",
    "handle_analyze_document",
    "get_analyze_document_handler",
]
