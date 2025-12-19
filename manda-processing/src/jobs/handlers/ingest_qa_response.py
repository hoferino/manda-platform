"""
Q&A response ingestion job handler.
Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #4, #5)
Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)

This handler processes ingest-qa-response jobs from the pg-boss queue:
1. Receives Q&A item data from webhook payload
2. Calls GraphitiIngestionService.ingest_qa_response()
3. Logs ingestion metrics

Q&A responses have the highest confidence (0.95) and can supersede
document-extracted facts via Graphiti's temporal model.

E12.9: organization_id is required for multi-tenant namespace isolation.
"""

import time
from typing import Any, Optional

import structlog

from src.graphiti.client import GraphitiConnectionError
from src.graphiti.ingestion import GraphitiIngestionService, IngestionResult
from src.jobs.queue import Job
from src.observability.usage import log_feature_usage_to_db
from src.storage.supabase_client import SupabaseClient, get_supabase_client
from uuid import UUID

logger = structlog.get_logger(__name__)


class IngestQAResponseHandler:
    """
    Handler for ingest-qa-response jobs.

    Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #4, #5)

    Processes Q&A answer events and ingests them into Graphiti
    as high-confidence episodes.
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        ingestion_service: Optional[GraphitiIngestionService] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            db_client: Database client for usage logging (E12.2)
            ingestion_service: Graphiti ingestion service (optional, for DI)
        """
        self.db = db_client or get_supabase_client()
        self.ingestion = ingestion_service or GraphitiIngestionService()
        logger.info("IngestQAResponseHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an ingest-qa-response job.

        Expected job.data:
            {
                "qa_item_id": str,       # Q&A item UUID
                "deal_id": str,          # Deal UUID (for namespace isolation)
                "organization_id": str,  # E12.9: Organization UUID (required)
                "question": str,         # The question text
                "answer": str,           # The answer text
            }

        Args:
            job: The job to process

        Returns:
            Result dict with success status and metrics

        Raises:
            GraphitiConnectionError: If Graphiti/Neo4j connection fails
            KeyError: If required fields are missing from job data
        """
        start_time = time.perf_counter()
        job_data = job.data

        # Extract required fields from job payload
        qa_item_id = job_data["qa_item_id"]
        deal_id = job_data["deal_id"]
        organization_id = job_data["organization_id"]  # E12.9: Required
        question = job_data["question"]
        answer = job_data["answer"]

        logger.info(
            "Processing ingest-qa-response job",
            job_id=job.id,
            qa_item_id=qa_item_id,
            deal_id=deal_id,
            organization_id=organization_id,
        )

        try:
            result: IngestionResult = await self.ingestion.ingest_qa_response(
                qa_item_id=qa_item_id,
                deal_id=deal_id,
                organization_id=organization_id,  # E12.9: Multi-tenant isolation
                question=question,
                answer=answer,
            )

            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            result_dict = {
                "success": True,
                "qa_item_id": qa_item_id,
                "episodes_created": result.episode_count,
                "ingestion_time_ms": result.elapsed_ms,
                "total_time_ms": elapsed_ms,
            }

            # E12.2: Log feature usage to database
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,
                deal_id=UUID(deal_id) if deal_id else None,
                feature_name="qa_response_ingestion",
                status="success",
                duration_ms=elapsed_ms,
                metadata={
                    "qa_item_id": qa_item_id,
                    "episodes_created": result.episode_count,
                },
            )

            logger.info(
                "ingest-qa-response job completed",
                job_id=job.id,
                **result_dict,
            )

            return result_dict

        except GraphitiConnectionError as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning(
                "Graphiti connection error during Q&A ingestion",
                job_id=job.id,
                qa_item_id=qa_item_id,
                error=str(e),
            )
            # E12.2: Log failed feature usage
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,
                deal_id=UUID(deal_id) if deal_id else None,
                feature_name="qa_response_ingestion",
                status="error",
                duration_ms=elapsed_ms,
                error_message=str(e),
                metadata={"qa_item_id": qa_item_id},
            )
            raise

        except Exception as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error(
                "ingest-qa-response job failed",
                job_id=job.id,
                qa_item_id=qa_item_id,
                error=str(e),
                exc_info=True,
            )
            # E12.2: Log failed feature usage
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,
                deal_id=UUID(deal_id) if deal_id else None,
                feature_name="qa_response_ingestion",
                status="error",
                duration_ms=elapsed_ms,
                error_message=str(e),
                metadata={"qa_item_id": qa_item_id},
            )
            raise


# Handler instance factory
_handler: Optional[IngestQAResponseHandler] = None


def get_ingest_qa_response_handler() -> IngestQAResponseHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = IngestQAResponseHandler()
    return _handler


async def handle_ingest_qa_response(job: Job) -> dict[str, Any]:
    """
    Entry point for ingest-qa-response job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_ingest_qa_response_handler()
    return await handler.handle(job)


__all__ = [
    "IngestQAResponseHandler",
    "handle_ingest_qa_response",
    "get_ingest_qa_response_handler",
]
