"""
Chat fact ingestion job handler.
Story: E10.5 - Q&A and Chat Ingestion (AC: #2, #4, #5)
Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)

This handler processes ingest-chat-fact jobs from the pg-boss queue:
1. Receives extracted fact data from agent/chat context
2. Calls GraphitiIngestionService.ingest_chat_fact()
3. Logs ingestion metrics

Chat facts have high confidence (0.90) and represent analyst-provided
information during due diligence conversations.

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


class IngestChatFactHandler:
    """
    Handler for ingest-chat-fact jobs.

    Story: E10.5 - Q&A and Chat Ingestion (AC: #2, #4, #5)

    Processes facts extracted from analyst chat and ingests them
    into Graphiti as high-confidence episodes.
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
        logger.info("IngestChatFactHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an ingest-chat-fact job.

        Expected job.data:
            {
                "message_id": str,       # Chat message UUID
                "deal_id": str,          # Deal UUID (for namespace isolation)
                "organization_id": str,  # E12.9: Organization UUID (required)
                "fact_content": str,     # The extracted fact
                "message_context": str,  # Full message for context
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
        message_id = job_data["message_id"]
        deal_id = job_data["deal_id"]
        organization_id = job_data["organization_id"]  # E12.9: Required
        fact_content = job_data["fact_content"]
        message_context = job_data.get("message_context", fact_content)

        logger.info(
            "Processing ingest-chat-fact job",
            job_id=job.id,
            message_id=message_id,
            deal_id=deal_id,
            organization_id=organization_id,
        )

        try:
            result: IngestionResult = await self.ingestion.ingest_chat_fact(
                message_id=message_id,
                deal_id=deal_id,
                organization_id=organization_id,  # E12.9: Multi-tenant isolation
                fact_content=fact_content,
                message_context=message_context,
            )

            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            result_dict = {
                "success": True,
                "message_id": message_id,
                "episodes_created": result.episode_count,
                "ingestion_time_ms": result.elapsed_ms,
                "total_time_ms": elapsed_ms,
            }

            # E12.2: Log feature usage to database
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,
                deal_id=UUID(deal_id) if deal_id else None,
                feature_name="chat_fact_ingestion",
                status="success",
                duration_ms=elapsed_ms,
                metadata={
                    "message_id": message_id,
                    "episodes_created": result.episode_count,
                },
            )

            logger.info(
                "ingest-chat-fact job completed",
                job_id=job.id,
                **result_dict,
            )

            return result_dict

        except GraphitiConnectionError as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning(
                "Graphiti connection error during chat fact ingestion",
                job_id=job.id,
                message_id=message_id,
                error=str(e),
            )
            # E12.2: Log failed feature usage
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,
                deal_id=UUID(deal_id) if deal_id else None,
                feature_name="chat_fact_ingestion",
                status="error",
                duration_ms=elapsed_ms,
                error_message=str(e),
                metadata={"message_id": message_id},
            )
            raise

        except Exception as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error(
                "ingest-chat-fact job failed",
                job_id=job.id,
                message_id=message_id,
                error=str(e),
                exc_info=True,
            )
            # E12.2: Log failed feature usage
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,
                deal_id=UUID(deal_id) if deal_id else None,
                feature_name="chat_fact_ingestion",
                status="error",
                duration_ms=elapsed_ms,
                error_message=str(e),
                metadata={"message_id": message_id},
            )
            raise


# Handler instance factory
_handler: Optional[IngestChatFactHandler] = None


def get_ingest_chat_fact_handler() -> IngestChatFactHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = IngestChatFactHandler()
    return _handler


async def handle_ingest_chat_fact(job: Job) -> dict[str, Any]:
    """
    Entry point for ingest-chat-fact job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_ingest_chat_fact_handler()
    return await handler.handle(job)


__all__ = [
    "IngestChatFactHandler",
    "handle_ingest_chat_fact",
    "get_ingest_chat_fact_handler",
]
