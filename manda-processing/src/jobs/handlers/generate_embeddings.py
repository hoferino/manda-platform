"""
DEPRECATED: Embedding generation job handler.

@deprecated E10.8 - This handler is deprecated. The pipeline now skips
generate_embeddings and goes directly from parse_document to ingest-graphiti.
Graphiti handles all embeddings internally via Voyage AI (1024d).

Old pipeline: parse_document -> generate_embeddings -> ingest_graphiti -> analyze_document
New pipeline: parse_document -> ingest_graphiti -> analyze_document

This file is kept for backwards compatibility with any in-flight jobs
but should not be used for new document processing.

---

Story: E3.4 - Generate Embeddings for Semantic Search (AC: #1, #5) - OBSOLETE
Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #2, #3, #4)
Story: E10.4 - Document Ingestion Pipeline (AC: #1)
Story: E10.8 - PostgreSQL Cleanup (DEPRECATED this handler)

This handler processed generate_embeddings jobs from the pg-boss queue:
1. Loads document chunks from database
2. Generates embeddings using OpenAI text-embedding-3-large (3072d)
3. Stores embeddings in pgvector column
4. Updates document status
5. Enqueues next job (ingest-graphiti)

Enhanced with E3.8:
- Stage tracking via last_completed_stage
- Error classification and retry decisions
- Structured error reporting
"""

import time
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.jobs.queue import Job, get_job_queue
from src.jobs.retry_manager import RetryManager, get_retry_manager
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)


def _create_embedding_client():
    """Create an OpenAI embedding client (lazy import to avoid import errors in tests)."""
    from src.embeddings.openai_client import OpenAIEmbeddingClient
    return OpenAIEmbeddingClient()


logger = structlog.get_logger(__name__)


# Errors that should NOT trigger retry (permanent failures)
NON_RETRYABLE_ERRORS = (
    ValueError,  # Invalid input data
)


class GenerateEmbeddingsHandler:
    """
    Handler for generate_embeddings jobs.

    Orchestrates the embedding generation pipeline:
    Load Chunks -> Generate Embeddings -> Store in DB -> Update Status -> Enqueue Next

    E3.8: Includes stage tracking and retry management.
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        embedding_client: Optional[Any] = None,
        retry_manager: Optional[RetryManager] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            db_client: Database client for storage
            embedding_client: OpenAI embedding client
            retry_manager: Retry manager for stage tracking and error handling
            config: Application settings
        """
        self.db = db_client or get_supabase_client()
        self.embedding_client = embedding_client or _create_embedding_client()
        self.retry_mgr = retry_manager or get_retry_manager()
        self.config = config or get_settings()

        logger.info("GenerateEmbeddingsHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle a generate_embeddings job.

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
        chunks_count = job_data.get("chunks_count", 0)
        deal_id = job_data.get("deal_id")
        user_id = job_data.get("user_id")
        is_retry = job_data.get("is_retry", False)

        logger.info(
            "Processing generate_embeddings job",
            job_id=job.id,
            document_id=str(document_id),
            expected_chunks=chunks_count,
            retry_count=job.retry_count,
            is_retry=is_retry,
        )

        try:
            # E3.8: Prepare for retry if needed
            if is_retry:
                await self.retry_mgr.prepare_stage_retry(document_id, "embedded")
            else:
                # Update status to embedding
                await self.db.update_document_status(document_id, "embedding")

            # Clear any previous error on start
            await self.db.clear_processing_error(document_id)

            # Load chunks from database
            chunks = await self.db.get_chunks_by_document(document_id)

            if not chunks:
                logger.warning(
                    "No chunks found for document",
                    document_id=str(document_id),
                )
                # Still mark as embedded (empty document case)
                await self.db.update_document_status(document_id, "embedded")
                # E3.8: Mark stage complete
                await self.retry_mgr.mark_stage_complete(document_id, "embedded")
                return {
                    "success": True,
                    "document_id": str(document_id),
                    "chunks_embedded": 0,
                    "total_tokens": 0,
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                }

            # Extract chunk IDs and content
            chunk_ids = [chunk["id"] for chunk in chunks]
            texts = [chunk["content"] for chunk in chunks]

            logger.info(
                "Generating embeddings for chunks",
                document_id=str(document_id),
                chunk_count=len(texts),
            )

            # Generate embeddings
            embedding_result = await self.embedding_client.generate_batch(texts)

            if embedding_result.failed_indices:
                logger.warning(
                    "Some embeddings failed to generate",
                    document_id=str(document_id),
                    failed_count=len(embedding_result.failed_indices),
                )

            # Store embeddings and update status atomically
            chunks_updated = await self.db.update_embeddings_and_status(
                document_id=document_id,
                chunk_ids=chunk_ids,
                embeddings=embedding_result.embeddings,
                new_status="embedded",
            )

            # E3.8: Mark embedding stage as complete
            await self.retry_mgr.mark_stage_complete(document_id, "embedded")

            # Enqueue the next job
            next_job_id = await self._enqueue_next_job(
                document_id=document_id,
                deal_id=deal_id,
                user_id=user_id,
            )

            # Calculate metrics
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            result = {
                "success": True,
                "document_id": str(document_id),
                "chunks_embedded": chunks_updated,
                "total_tokens": embedding_result.total_tokens,
                "estimated_cost_usd": embedding_result.estimated_cost_usd,
                "total_time_ms": elapsed_ms,
                "next_job_id": next_job_id,
            }

            logger.info(
                "generate_embeddings job completed",
                job_id=job.id,
                **result,
            )

            return result

        except NON_RETRYABLE_ERRORS as e:
            # Permanent failures - use retry manager
            logger.error(
                "generate_embeddings job failed permanently",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
            )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="embedding",
                retry_count=job.retry_count,
            )
            raise

        except DatabaseError as e:
            # Potentially retryable database errors
            logger.warning(
                "generate_embeddings job failed (may retry)",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
                retryable=e.retryable,
            )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="embedding",
                retry_count=job.retry_count,
            )
            raise

        except Exception as e:
            # Check if it's an embedding error
            error_type = type(e).__name__

            # Import here to avoid circular imports
            from src.embeddings.openai_client import EmbeddingError

            if isinstance(e, EmbeddingError):
                if not e.retryable:
                    logger.error(
                        "generate_embeddings job failed permanently (embedding error)",
                        job_id=job.id,
                        document_id=str(document_id),
                        error=str(e),
                    )
                else:
                    logger.warning(
                        "generate_embeddings job failed (embedding error, may retry)",
                        job_id=job.id,
                        document_id=str(document_id),
                        error=str(e),
                    )

            else:
                # Unexpected errors - log
                logger.error(
                    "generate_embeddings job failed unexpectedly",
                    job_id=job.id,
                    document_id=str(document_id),
                    error=str(e),
                    error_type=error_type,
                    exc_info=True,
                )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="embedding",
                retry_count=job.retry_count,
            )
            raise

    async def _enqueue_next_job(
        self,
        document_id: UUID,
        deal_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Enqueue the ingest-graphiti job.

        Story: E10.4 - Document Ingestion Pipeline (AC: #1)

        Pipeline change: generate-embeddings now enqueues ingest-graphiti
        instead of analyze-document. The ingest-graphiti handler will
        then enqueue analyze-document after Graphiti ingestion completes.

        Args:
            document_id: UUID of the processed document
            deal_id: Parent deal ID (required for Graphiti namespace isolation)
            user_id: User who uploaded

        Returns:
            The enqueued job ID
        """
        queue = await get_job_queue()

        job_data = {
            "document_id": str(document_id),
        }

        # deal_id is required for Graphiti ingestion (namespace isolation)
        if deal_id:
            job_data["deal_id"] = deal_id
        if user_id:
            job_data["user_id"] = user_id

        job_id = await queue.enqueue("ingest-graphiti", job_data)

        logger.info(
            "Enqueued ingest-graphiti job",
            document_id=str(document_id),
            next_job_id=job_id,
        )

        return job_id


# Handler instance factory
_handler: Optional[GenerateEmbeddingsHandler] = None


def get_generate_embeddings_handler() -> GenerateEmbeddingsHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = GenerateEmbeddingsHandler()
    return _handler


async def handle_generate_embeddings(job: Job) -> dict[str, Any]:
    """
    Entry point for generate_embeddings job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_generate_embeddings_handler()
    return await handler.handle(job)


__all__ = [
    "GenerateEmbeddingsHandler",
    "handle_generate_embeddings",
    "get_generate_embeddings_handler",
]
