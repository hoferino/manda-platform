"""
Embedding generation job handler.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #1, #5)

This handler processes generate_embeddings jobs from the pg-boss queue:
1. Loads document chunks from database
2. Generates embeddings using OpenAI text-embedding-3-large
3. Stores embeddings in pgvector column
4. Updates document status
5. Enqueues next job (analyze_document)
"""

import time
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.jobs.queue import Job, get_job_queue
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
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        embedding_client: Optional[Any] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            db_client: Database client for storage
            embedding_client: OpenAI embedding client
            config: Application settings
        """
        self.db = db_client or get_supabase_client()
        self.embedding_client = embedding_client or _create_embedding_client()
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

        logger.info(
            "Processing generate_embeddings job",
            job_id=job.id,
            document_id=str(document_id),
            expected_chunks=chunks_count,
            retry_count=job.retry_count,
        )

        try:
            # Update status to processing
            await self.db.update_document_status(document_id, "embedding")

            # Load chunks from database
            chunks = await self.db.get_chunks_by_document(document_id)

            if not chunks:
                logger.warning(
                    "No chunks found for document",
                    document_id=str(document_id),
                )
                # Still mark as embedded (empty document case)
                await self.db.update_document_status(document_id, "embedded")
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
            # Permanent failures - mark document as failed
            logger.error(
                "generate_embeddings job failed permanently",
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
                "generate_embeddings job failed (may retry)",
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
                    await self._handle_permanent_failure(document_id, str(e))
                else:
                    logger.warning(
                        "generate_embeddings job failed (embedding error, may retry)",
                        job_id=job.id,
                        document_id=str(document_id),
                        error=str(e),
                    )
                raise

            # Unexpected errors - log and re-raise
            logger.error(
                "generate_embeddings job failed unexpectedly",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=error_type,
                exc_info=True,
            )
            raise

    async def _enqueue_next_job(
        self,
        document_id: UUID,
        deal_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Enqueue the analyze_document job.

        Args:
            document_id: UUID of the processed document
            deal_id: Parent deal ID
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

        job_id = await queue.enqueue("analyze-document", job_data)

        logger.info(
            "Enqueued analyze-document job",
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
                processing_status="embedding_failed",
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
