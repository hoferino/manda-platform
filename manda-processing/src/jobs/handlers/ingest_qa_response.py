"""
Q&A response ingestion job handler.
Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #4, #5)

This handler processes ingest-qa-response jobs from the pg-boss queue:
1. Receives Q&A item data from webhook payload
2. Calls GraphitiIngestionService.ingest_qa_response()
3. Logs ingestion metrics

Q&A responses have the highest confidence (0.95) and can supersede
document-extracted facts via Graphiti's temporal model.
"""

import time
from typing import Any, Optional

import structlog

from src.graphiti.client import GraphitiConnectionError
from src.graphiti.ingestion import GraphitiIngestionService, IngestionResult
from src.jobs.queue import Job

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
        ingestion_service: Optional[GraphitiIngestionService] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            ingestion_service: Graphiti ingestion service (optional, for DI)
        """
        self.ingestion = ingestion_service or GraphitiIngestionService()
        logger.info("IngestQAResponseHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an ingest-qa-response job.

        Expected job.data:
            {
                "qa_item_id": str,  # Q&A item UUID
                "deal_id": str,     # Deal UUID (for namespace isolation)
                "question": str,    # The question text
                "answer": str,      # The answer text
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
        question = job_data["question"]
        answer = job_data["answer"]

        logger.info(
            "Processing ingest-qa-response job",
            job_id=job.id,
            qa_item_id=qa_item_id,
            deal_id=deal_id,
        )

        try:
            result: IngestionResult = await self.ingestion.ingest_qa_response(
                qa_item_id=qa_item_id,
                deal_id=deal_id,
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

            logger.info(
                "ingest-qa-response job completed",
                job_id=job.id,
                **result_dict,
            )

            return result_dict

        except GraphitiConnectionError as e:
            logger.warning(
                "Graphiti connection error during Q&A ingestion",
                job_id=job.id,
                qa_item_id=qa_item_id,
                error=str(e),
            )
            raise

        except Exception as e:
            logger.error(
                "ingest-qa-response job failed",
                job_id=job.id,
                qa_item_id=qa_item_id,
                error=str(e),
                exc_info=True,
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
