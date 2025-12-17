"""
Chat fact ingestion job handler.
Story: E10.5 - Q&A and Chat Ingestion (AC: #2, #4, #5)

This handler processes ingest-chat-fact jobs from the pg-boss queue:
1. Receives extracted fact data from agent/chat context
2. Calls GraphitiIngestionService.ingest_chat_fact()
3. Logs ingestion metrics

Chat facts have high confidence (0.90) and represent analyst-provided
information during due diligence conversations.
"""

import time
from typing import Any, Optional

import structlog

from src.graphiti.client import GraphitiConnectionError
from src.graphiti.ingestion import GraphitiIngestionService, IngestionResult
from src.jobs.queue import Job

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
        ingestion_service: Optional[GraphitiIngestionService] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            ingestion_service: Graphiti ingestion service (optional, for DI)
        """
        self.ingestion = ingestion_service or GraphitiIngestionService()
        logger.info("IngestChatFactHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an ingest-chat-fact job.

        Expected job.data:
            {
                "message_id": str,      # Chat message UUID
                "deal_id": str,         # Deal UUID (for namespace isolation)
                "fact_content": str,    # The extracted fact
                "message_context": str, # Full message for context
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
        fact_content = job_data["fact_content"]
        message_context = job_data.get("message_context", fact_content)

        logger.info(
            "Processing ingest-chat-fact job",
            job_id=job.id,
            message_id=message_id,
            deal_id=deal_id,
        )

        try:
            result: IngestionResult = await self.ingestion.ingest_chat_fact(
                message_id=message_id,
                deal_id=deal_id,
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

            logger.info(
                "ingest-chat-fact job completed",
                job_id=job.id,
                **result_dict,
            )

            return result_dict

        except GraphitiConnectionError as e:
            logger.warning(
                "Graphiti connection error during chat fact ingestion",
                job_id=job.id,
                message_id=message_id,
                error=str(e),
            )
            raise

        except Exception as e:
            logger.error(
                "ingest-chat-fact job failed",
                job_id=job.id,
                message_id=message_id,
                error=str(e),
                exc_info=True,
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
