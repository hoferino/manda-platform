"""
Graphiti ingestion job handler.
Story: E10.4 - Document Ingestion Pipeline (AC: #1, #6, #7)
Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)

This handler processes ingest-graphiti jobs from the pg-boss queue:
1. Loads document chunks from database
2. Ingests chunks into Graphiti as episodes (entity extraction via LLM)
3. Updates document status to 'graphiti_ingested'
4. Enqueues next job (analyze-document)

Enhanced with E3.8:
- Stage tracking via last_completed_stage
- Error classification and retry decisions
- Structured error reporting

E12.9: organization_id is extracted from the deal and passed to Graphiti
for namespace isolation via composite group_id format.
"""

import time
from typing import Any, Optional
from uuid import UUID

import structlog

from src.graphiti.client import GraphitiConnectionError
from src.graphiti.ingestion import GraphitiIngestionService, IngestionResult
from src.jobs.queue import Job, get_job_queue
from src.jobs.retry_manager import RetryManager, get_retry_manager
from src.storage.supabase_client import DatabaseError, SupabaseClient, get_supabase_client
from src.observability.usage import log_feature_usage_to_db

logger = structlog.get_logger(__name__)


# Errors that should NOT trigger retry (permanent failures)
NON_RETRYABLE_ERRORS = (ValueError,)


class IngestGraphitiHandler:
    """
    Handler for ingest-graphiti jobs.

    Story: E10.4 - Document Ingestion Pipeline (AC: #1, #6, #7)

    Orchestrates the Graphiti ingestion pipeline:
    Load Chunks -> Ingest to Graphiti -> Update Status -> Enqueue Next

    E3.8: Includes stage tracking and retry management.
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        ingestion_service: Optional[GraphitiIngestionService] = None,
        retry_manager: Optional[RetryManager] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            db_client: Database client for storage operations
            ingestion_service: Graphiti ingestion service
            retry_manager: Retry manager for stage tracking and error handling
        """
        self.db = db_client or get_supabase_client()
        self.ingestion = ingestion_service or GraphitiIngestionService()
        self.retry_mgr = retry_manager or get_retry_manager()

        logger.info("IngestGraphitiHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an ingest-graphiti job.

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

        # deal_id is REQUIRED for Graphiti namespace isolation (AC#1)
        deal_id = job_data.get("deal_id")
        if not deal_id:
            raise ValueError(
                f"deal_id is required for Graphiti ingestion (document_id={document_id}). "
                "Ensure the upstream job includes deal_id in the payload."
            )

        # E12.9: organization_id is REQUIRED for multi-tenant isolation
        # If not in job payload, we fetch it from the deal
        organization_id = job_data.get("organization_id")

        user_id = job_data.get("user_id")
        is_retry = job_data.get("is_retry", False)

        logger.info(
            "Processing ingest-graphiti job",
            job_id=job.id,
            document_id=str(document_id),
            deal_id=deal_id,
            organization_id=organization_id,
            retry_count=job.retry_count,
            is_retry=is_retry,
        )

        try:
            # E3.8: Prepare for retry if needed
            if is_retry:
                await self.retry_mgr.prepare_stage_retry(document_id, "graphiti_ingested")
            else:
                # Update status to graphiti_ingesting
                await self.db.update_document_status(document_id, "graphiti_ingesting")

            # Clear any previous error on start
            await self.db.clear_processing_error(document_id)

            # Load chunks and document from database
            chunks = await self.db.get_chunks_by_document(document_id)
            doc = await self.db.get_document(document_id)

            if not doc:
                raise ValueError(f"Document not found: {document_id}")

            # E12.9: Fetch organization_id from deal if not in job payload
            if not organization_id:
                deal = await self.db.get_deal(deal_id)
                if not deal:
                    raise ValueError(f"Deal not found: {deal_id}")
                organization_id = deal.get("organization_id")
                if not organization_id:
                    raise ValueError(
                        f"organization_id is required for Graphiti ingestion (deal_id={deal_id}). "
                        "The deal must have an organization_id set."
                    )
                logger.debug(
                    "Fetched organization_id from deal",
                    deal_id=deal_id,
                    organization_id=organization_id,
                )

            # Idempotency check: skip if already ingested (Task 4.4)
            # This prevents duplicate episodes if job is reprocessed
            current_status = doc.get("processing_status")
            if current_status == "graphiti_ingested" and not is_retry:
                logger.info(
                    "Document already ingested to Graphiti - skipping",
                    document_id=str(document_id),
                    current_status=current_status,
                )
                # Just enqueue next job without re-ingesting
                next_job_id = await self._enqueue_next_job(document_id, deal_id, user_id)
                return {
                    "success": True,
                    "document_id": str(document_id),
                    "episodes_created": 0,
                    "skipped": True,
                    "reason": "already_ingested",
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                    "next_job_id": next_job_id,
                }

            if not chunks:
                logger.warning(
                    "No chunks found for document - skipping Graphiti ingestion",
                    document_id=str(document_id),
                )
                # Still mark as ingested (empty document case)
                await self.db.update_document_status(document_id, "graphiti_ingested")
                # E3.8: Mark stage complete
                await self.retry_mgr.mark_stage_complete(document_id, "graphiti_ingested")
                # Enqueue next job
                next_job_id = await self._enqueue_next_job(document_id, deal_id, user_id)
                return {
                    "success": True,
                    "document_id": str(document_id),
                    "episodes_created": 0,
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                    "next_job_id": next_job_id,
                }

            # Ingest chunks to Graphiti
            # E12.9: organization_id is passed for composite group_id
            # E14-S1: Build document metadata for extraction hints
            doc_metadata = {
                "filename": doc["name"],
                "file_type": doc.get("file_type"),
                "content_type": doc.get("content_type"),
            }
            result: IngestionResult = await self.ingestion.ingest_document_chunks(
                document_id=str(document_id),
                deal_id=deal_id,
                organization_id=organization_id,  # E12.9: Multi-tenant isolation
                document_name=doc["name"],
                chunks=chunks,
                doc_metadata=doc_metadata,  # E14-S1: Pass metadata for extraction hints
            )

            # Update status to graphiti_ingested
            await self.db.update_document_status(document_id, "graphiti_ingested")

            # E3.8: Mark stage complete
            await self.retry_mgr.mark_stage_complete(document_id, "graphiti_ingested")

            # Enqueue analyze-document as next job
            next_job_id = await self._enqueue_next_job(document_id, deal_id, user_id)

            # Calculate total time
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            result_dict = {
                "success": True,
                "document_id": str(document_id),
                "episodes_created": result.episode_count,
                "ingestion_time_ms": result.elapsed_ms,
                "estimated_cost_usd": result.estimated_cost_usd,
                "total_time_ms": elapsed_ms,
                "next_job_id": next_job_id,
            }

            # E12.2: Log feature usage to database
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,
                deal_id=UUID(deal_id) if deal_id else None,
                user_id=UUID(user_id) if user_id else None,
                feature_name="document_processing",
                status="success",
                duration_ms=elapsed_ms,
                metadata={
                    "document_id": str(document_id),
                    "episodes_created": result.episode_count,
                    "stage": "graphiti_ingestion",
                },
            )

            logger.info(
                "ingest-graphiti job completed",
                job_id=job.id,
                **result_dict,
            )

            return result_dict

        except GraphitiConnectionError as e:
            # Graphiti/Neo4j connection errors - potentially retryable
            logger.warning(
                "Graphiti connection error (may retry)",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
            )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="graphiti_ingesting",
                retry_count=job.retry_count,
            )
            raise

        except NON_RETRYABLE_ERRORS as e:
            # Permanent failures - use retry manager
            logger.error(
                "ingest-graphiti job failed permanently",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
            )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="graphiti_ingesting",
                retry_count=job.retry_count,
            )
            raise

        except DatabaseError as e:
            # Potentially retryable database errors
            logger.warning(
                "ingest-graphiti job failed (may retry)",
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
                current_stage="graphiti_ingesting",
                retry_count=job.retry_count,
            )
            raise

        except Exception as e:
            # Unexpected errors - log and classify
            logger.error(
                "ingest-graphiti job failed unexpectedly",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
                exc_info=True,
            )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="graphiti_ingesting",
                retry_count=job.retry_count,
            )
            raise

    async def _enqueue_next_job(
        self,
        document_id: UUID,
        deal_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Enqueue the analyze-document job.

        Args:
            document_id: UUID of the processed document
            deal_id: Parent deal ID
            user_id: User who uploaded (optional)

        Returns:
            The enqueued job ID
        """
        queue = await get_job_queue()

        job_data = {
            "document_id": str(document_id),
            "deal_id": deal_id,
        }

        if user_id:
            job_data["user_id"] = user_id

        job_id = await queue.enqueue("analyze-document", job_data)

        logger.info(
            "Enqueued analyze-document job",
            document_id=str(document_id),
            next_job_id=job_id,
        )

        return job_id


# Handler instance factory
_handler: Optional[IngestGraphitiHandler] = None


def get_ingest_graphiti_handler() -> IngestGraphitiHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = IngestGraphitiHandler()
    return _handler


async def handle_ingest_graphiti(job: Job) -> dict[str, Any]:
    """
    Entry point for ingest-graphiti job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_ingest_graphiti_handler()
    return await handler.handle(job)


__all__ = [
    "IngestGraphitiHandler",
    "handle_ingest_graphiti",
    "get_ingest_graphiti_handler",
]
