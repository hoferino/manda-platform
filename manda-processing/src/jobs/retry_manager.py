"""
Retry Manager for document processing pipeline.
Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #2, #3, #4)

This module provides:
- RetryManager class for coordinating stage-aware retries
- Integration with ErrorClassifier for retry decisions
- Retry history tracking
- Stage-aware job enqueueing
"""

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.jobs.errors import (
    ClassifiedError,
    ErrorClassifier,
    ProcessingStage,
    get_error_classifier,
    get_next_stage,
)
from src.jobs.queue import get_job_queue
from src.storage.supabase_client import SupabaseClient, get_supabase_client

logger = structlog.get_logger(__name__)


# Maximum retry attempts per stage
MAX_RETRY_ATTEMPTS = 3

# Maximum total retry attempts across all stages (prevents runaway costs)
MAX_TOTAL_RETRY_ATTEMPTS = 5

# Minimum seconds between manual retry requests (rate limiting)
MANUAL_RETRY_COOLDOWN_SECONDS = 60


class RetryManager:
    """
    Manages retry logic for document processing.

    Coordinates:
    - Error classification and retry decisions
    - Stage tracking and stage-aware retry
    - Retry history logging
    - Job enqueueing for stage-specific retry
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        error_classifier: Optional[ErrorClassifier] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the retry manager.

        Args:
            db_client: Database client for stage tracking
            error_classifier: Error classifier for retry decisions
            config: Application settings
        """
        self.db = db_client or get_supabase_client()
        self.classifier = error_classifier or get_error_classifier()
        self.config = config or get_settings()

        logger.info("RetryManager initialized")

    async def handle_job_failure(
        self,
        document_id: UUID,
        error: Exception,
        current_stage: str,
        retry_count: int = 0,
    ) -> ClassifiedError:
        """
        Handle a job failure with error classification and retry decision.

        This is the main entry point for job handlers to report failures.

        Args:
            document_id: UUID of the failed document
            error: The exception that caused the failure
            current_stage: The processing stage that failed (parsing, embedding, analyzing)
            retry_count: Current retry attempt number

        Returns:
            ClassifiedError with retry decision and user-friendly messages
        """
        # Classify the error
        classified = self.classifier.classify(
            error=error,
            stage=current_stage,
            retry_count=retry_count,
        )

        logger.info(
            "Classified job failure",
            document_id=str(document_id),
            error_type=classified.error_type,
            category=classified.category.value,
            should_retry=classified.should_retry,
            stage=current_stage,
            retry_count=retry_count,
        )

        # Store the error information
        await self.db.update_processing_error(
            document_id=document_id,
            error_info=classified.to_dict(),
        )

        # Append to retry history
        retry_entry = {
            "attempt": retry_count + 1,
            "stage": current_stage,
            "error_type": classified.error_type,
            "message": classified.message[:500],  # Truncate long messages
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self.db.append_retry_history(
            document_id=document_id,
            retry_entry=retry_entry,
        )

        # Update document status based on classification
        if not classified.should_retry:
            # Permanent failure - mark as failed
            failed_status = self._get_failed_status(current_stage)
            await self.db.update_document_status(
                document_id=document_id,
                processing_status=failed_status,
            )
        # If should_retry is True, pg-boss will handle the retry

        return classified

    async def should_retry_stage(
        self,
        document_id: UUID,
        stage: str,
    ) -> tuple[bool, int]:
        """
        Check if a stage should be retried based on history.

        Args:
            document_id: UUID of the document
            stage: The stage to check

        Returns:
            Tuple of (should_retry, current_attempt_count)
        """
        history = await self.db.get_retry_history(document_id)

        # Count attempts for this stage
        stage_attempts = sum(
            1 for entry in history
            if entry.get("stage") == stage
        )

        should_retry = stage_attempts < MAX_RETRY_ATTEMPTS

        logger.info(
            "Checked retry eligibility",
            document_id=str(document_id),
            stage=stage,
            attempts=stage_attempts,
            max_attempts=MAX_RETRY_ATTEMPTS,
            should_retry=should_retry,
        )

        return should_retry, stage_attempts

    async def can_manual_retry(
        self,
        document_id: UUID,
    ) -> tuple[bool, Optional[str]]:
        """
        Check if a manual retry is allowed for a document.

        Enforces:
        - Cooldown period between manual retries (rate limiting)
        - Total retry attempt cap (cost control)

        Args:
            document_id: UUID of the document

        Returns:
            Tuple of (allowed, reason_if_denied)
        """
        history = await self.db.get_retry_history(document_id)

        # Check total retry attempts across all stages
        total_attempts = len(history)
        if total_attempts >= MAX_TOTAL_RETRY_ATTEMPTS:
            logger.info(
                "Manual retry denied: total attempt cap reached",
                document_id=str(document_id),
                total_attempts=total_attempts,
                max_total=MAX_TOTAL_RETRY_ATTEMPTS,
            )
            return False, f"Maximum retry attempts ({MAX_TOTAL_RETRY_ATTEMPTS}) reached. Please contact support."

        # Check cooldown period since last retry
        if history:
            last_entry = history[-1]
            last_timestamp_str = last_entry.get("timestamp")
            if last_timestamp_str:
                try:
                    last_timestamp = datetime.fromisoformat(last_timestamp_str.replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)
                    seconds_since_last = (now - last_timestamp).total_seconds()

                    if seconds_since_last < MANUAL_RETRY_COOLDOWN_SECONDS:
                        wait_time = int(MANUAL_RETRY_COOLDOWN_SECONDS - seconds_since_last)
                        logger.info(
                            "Manual retry denied: cooldown period active",
                            document_id=str(document_id),
                            seconds_since_last=seconds_since_last,
                            cooldown_seconds=MANUAL_RETRY_COOLDOWN_SECONDS,
                            wait_time=wait_time,
                        )
                        return False, f"Please wait {wait_time} seconds before retrying again."
                except (ValueError, TypeError) as e:
                    logger.warning(
                        "Could not parse retry timestamp",
                        document_id=str(document_id),
                        timestamp=last_timestamp_str,
                        error=str(e),
                    )

        logger.info(
            "Manual retry allowed",
            document_id=str(document_id),
            total_attempts=total_attempts,
        )
        return True, None

    async def get_next_retry_stage(
        self,
        document_id: UUID,
    ) -> Optional[str]:
        """
        Determine which stage to resume from for a retry.

        Args:
            document_id: UUID of the document

        Returns:
            The stage to start from, or None if processing is complete
        """
        # Get last completed stage
        last_completed = await self.db.get_document_stage(document_id)

        if last_completed is None:
            return "parsing"

        # Map to ProcessingStage enum
        try:
            stage_enum = ProcessingStage(last_completed)
            next_stage = get_next_stage(stage_enum)

            # Map ProcessingStage to job stage names
            stage_to_job = {
                ProcessingStage.PENDING: "parsing",
                ProcessingStage.PARSED: "embedding",
                ProcessingStage.EMBEDDED: "analyzing",
                ProcessingStage.ANALYZED: None,  # Complete
                ProcessingStage.COMPLETE: None,  # Complete
            }

            return stage_to_job.get(next_stage)

        except ValueError:
            logger.warning(
                "Unknown stage value, starting from beginning",
                document_id=str(document_id),
                last_completed=last_completed,
            )
            return "parsing"

    async def enqueue_stage_retry(
        self,
        document_id: UUID,
        stage: str,
        deal_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Enqueue a job to retry a specific stage.

        Args:
            document_id: UUID of the document
            stage: Stage to retry (parsing, embedding, analyzing)
            deal_id: Parent deal/project ID
            user_id: User who owns the document

        Returns:
            The enqueued job ID, or None if enqueueing failed
        """
        # Map stage to job name
        stage_to_job = {
            "parsing": "parse-document",
            "embedding": "generate-embeddings",
            "analyzing": "analyze-document",
        }

        job_name = stage_to_job.get(stage)
        if not job_name:
            logger.error(
                "Invalid stage for retry",
                document_id=str(document_id),
                stage=stage,
            )
            return None

        # Prepare job data
        job_data: dict[str, Any] = {
            "document_id": str(document_id),
            "is_retry": True,
        }

        if deal_id:
            job_data["deal_id"] = deal_id
        if user_id:
            job_data["user_id"] = user_id

        # Enqueue the job first, then clear error only if successful
        # This prevents inconsistent state if enqueueing fails
        try:
            queue = await get_job_queue()
            job_id = await queue.enqueue(job_name, job_data)
        except Exception as e:
            logger.error(
                "Failed to enqueue retry job",
                document_id=str(document_id),
                stage=stage,
                job_name=job_name,
                error=str(e),
            )
            return None

        # Clear the error only after successful enqueue
        await self.db.clear_processing_error(document_id)

        logger.info(
            "Enqueued stage retry",
            document_id=str(document_id),
            stage=stage,
            job_name=job_name,
            job_id=job_id,
        )

        return job_id

    async def prepare_stage_retry(
        self,
        document_id: UUID,
        stage: str,
    ) -> bool:
        """
        Prepare a document for stage retry by clearing partial data.

        This should be called before re-running a failed stage to ensure
        clean state.

        Args:
            document_id: UUID of the document
            stage: The stage being retried

        Returns:
            True if preparation succeeded
        """
        logger.info(
            "Preparing stage retry",
            document_id=str(document_id),
            stage=stage,
        )

        # Clear data for the stage being retried
        await self.db.clear_stage_data(document_id, stage)

        # Update status to indicate processing
        status_map = {
            "parsing": "parsing",
            "embedding": "embedding",
            "analyzing": "analyzing",
        }
        new_status = status_map.get(stage, "processing")
        await self.db.update_document_status(document_id, new_status)

        return True

    async def mark_stage_complete(
        self,
        document_id: UUID,
        stage: str,
    ) -> bool:
        """
        Mark a processing stage as complete.

        This updates the last_completed_stage for stage-aware retry.

        Args:
            document_id: UUID of the document
            stage: The stage that was completed

        Returns:
            True if update succeeded
        """
        # Map job stage to completed stage name
        stage_map = {
            "parsing": "parsed",
            "parsed": "parsed",
            "embedding": "embedded",
            "embedded": "embedded",
            "analyzing": "analyzed",
            "analyzed": "analyzed",
        }

        completed_stage = stage_map.get(stage, stage)

        logger.info(
            "Marking stage complete",
            document_id=str(document_id),
            stage=stage,
            completed_stage=completed_stage,
        )

        return await self.db.update_document_stage(
            document_id=document_id,
            last_completed_stage=completed_stage,
        )

    def _get_failed_status(self, stage: str) -> str:
        """Get the appropriate failed status for a stage."""
        status_map = {
            "parsing": "failed",
            "embedding": "embedding_failed",
            "analyzing": "analysis_failed",
        }
        return status_map.get(stage, "failed")


# Global manager instance
_retry_manager: Optional[RetryManager] = None


def get_retry_manager() -> RetryManager:
    """Get or create the global RetryManager instance."""
    global _retry_manager
    if _retry_manager is None:
        _retry_manager = RetryManager()
    return _retry_manager


__all__ = [
    "RetryManager",
    "get_retry_manager",
    "MAX_RETRY_ATTEMPTS",
    "MAX_TOTAL_RETRY_ATTEMPTS",
    "MANUAL_RETRY_COOLDOWN_SECONDS",
]
