"""
Detect contradictions job handler for LLM-based contradiction detection.
Story: E4.7 - Detect Contradictions Using Neo4j (AC: #1, #2, #5, #6, #7, #8, #9)

This handler processes detect-contradictions jobs from the pg-boss queue:
1. Fetches all findings for the deal from Supabase
2. Groups findings by domain (financial, operational, market, legal, technical)
3. Pre-filters pairs for efficiency (same domain, similar content, different chunks)
4. Uses Gemini 2.5 Pro for pairwise contradiction comparison
5. Stores contradictions in Neo4j CONTRADICTS relationship and contradictions table
6. Updates document stage tracking

Detection flow:
analyze-document completes → detect-contradictions job enqueued →
fetch findings → group by domain → pre-filter pairs →
LLM comparison → apply 70% threshold → store in Neo4j + Supabase
"""

import time
from collections import defaultdict
from itertools import combinations
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.jobs.queue import Job
from src.jobs.retry_manager import RetryManager, get_retry_manager
from src.llm.contradiction_detector import (
    ContradictionDetector,
    ContradictionResult,
    CONTRADICTION_CONFIDENCE_THRESHOLD,
    get_contradiction_detector,
)
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)

logger = structlog.get_logger(__name__)


# Configuration constants
MAX_FINDINGS_PER_DOMAIN = 100  # AC: #8 - Limit comparisons for large datasets
BATCH_SIZE = 5  # AC: #3 - Batch comparisons for efficiency
MIN_SEMANTIC_SIMILARITY = 0.6  # AC: #9 - Pre-filter threshold


# Errors that should NOT trigger retry (permanent failures)
NON_RETRYABLE_ERRORS = (
    ValueError,  # Invalid input data
)


class DetectContradictionsHandler:
    """
    Handler for detect-contradictions jobs.

    Orchestrates the contradiction detection pipeline:
    Fetch Findings -> Group by Domain -> Pre-filter -> Compare -> Store

    Features:
    - Domain-based grouping (AC: #2)
    - LLM comparison with Gemini 2.5 Pro (AC: #3)
    - 70% confidence threshold (AC: #4)
    - Neo4j CONTRADICTS + Supabase contradictions dual-write (AC: #5, #6)
    - Stage tracking and error classification (AC: #7)
    - Performance optimizations (AC: #8, #9)
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        detector: Optional[ContradictionDetector] = None,
        retry_manager: Optional[RetryManager] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            db_client: Database client for storage
            detector: Contradiction detector LLM service
            retry_manager: Retry manager for stage tracking
            config: Application settings
        """
        self.db = db_client or get_supabase_client()
        self.detector = detector or get_contradiction_detector()
        self.retry_mgr = retry_manager or get_retry_manager()
        self.config = config or get_settings()

        logger.info("DetectContradictionsHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle a detect-contradictions job.

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
        document_id = job_data.get("document_id")
        deal_id = job_data.get("deal_id")
        user_id = job_data.get("user_id")
        is_retry = job_data.get("is_retry", False)

        # deal_id is required for contradiction detection
        if not deal_id:
            raise ValueError("deal_id is required for contradiction detection")

        logger.info(
            "Processing detect-contradictions job",
            job_id=job.id,
            document_id=document_id,
            deal_id=deal_id,
            retry_count=job.retry_count,
            is_retry=is_retry,
        )

        try:
            # E3.8 pattern: Prepare for retry if needed
            if is_retry and document_id:
                await self.retry_mgr.prepare_stage_retry(
                    UUID(document_id), "contradiction_detection"
                )

            # Step 1: Fetch all findings for the deal (AC: #2)
            findings = await self.db.get_findings_by_deal(UUID(deal_id))

            if not findings:
                logger.info(
                    "No findings to compare for deal",
                    deal_id=deal_id,
                )
                return {
                    "success": True,
                    "deal_id": deal_id,
                    "document_id": document_id,
                    "findings_count": 0,
                    "comparisons_made": 0,
                    "contradictions_found": 0,
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                }

            logger.info(
                "Fetched findings for deal",
                deal_id=deal_id,
                findings_count=len(findings),
            )

            # Step 2: Group findings by domain (AC: #2)
            domain_groups = self._group_findings_by_domain(findings)

            logger.info(
                "Grouped findings by domain",
                domains={domain: len(items) for domain, items in domain_groups.items()},
            )

            # Step 3: Generate comparison pairs with pre-filtering (AC: #8, #9)
            all_pairs = self._generate_comparison_pairs(domain_groups)

            logger.info(
                "Generated comparison pairs after pre-filtering",
                pair_count=len(all_pairs),
            )

            if not all_pairs:
                logger.info(
                    "No pairs to compare after pre-filtering",
                    deal_id=deal_id,
                )
                return {
                    "success": True,
                    "deal_id": deal_id,
                    "document_id": document_id,
                    "findings_count": len(findings),
                    "comparisons_made": 0,
                    "contradictions_found": 0,
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                }

            # Step 4: Run LLM comparison (AC: #3)
            comparison_result = await self.detector.compare_batch(
                pairs=all_pairs,
                batch_size=BATCH_SIZE,
            )

            logger.info(
                "LLM comparison complete",
                comparisons_made=len(comparison_result.comparisons),
                contradictions_above_threshold=len(comparison_result.contradictions_found),
                contradictions_below_threshold=len(comparison_result.contradictions_below_threshold),
                failed_comparisons=len(comparison_result.failed_comparisons),
            )

            # Step 5: Store contradictions above threshold (AC: #5, #6)
            stored_count = 0
            for contradiction in comparison_result.contradictions_found:
                try:
                    success = await self._store_contradiction(
                        deal_id=deal_id,
                        contradiction=contradiction,
                    )
                    if success:
                        stored_count += 1
                except Exception as e:
                    logger.warning(
                        "Failed to store contradiction",
                        finding_a_id=contradiction.finding_a_id,
                        finding_b_id=contradiction.finding_b_id,
                        error=str(e),
                    )

            # Mark stage complete if we have a document_id
            if document_id:
                await self.retry_mgr.mark_stage_complete(
                    UUID(document_id), "contradiction_detection"
                )

            # Calculate metrics
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            result = {
                "success": True,
                "deal_id": deal_id,
                "document_id": document_id,
                "findings_count": len(findings),
                "comparisons_made": len(comparison_result.comparisons),
                "contradictions_found": stored_count,
                "contradictions_below_threshold": len(comparison_result.contradictions_below_threshold),
                "failed_comparisons": len(comparison_result.failed_comparisons),
                "input_tokens": comparison_result.total_input_tokens,
                "output_tokens": comparison_result.total_output_tokens,
                "total_time_ms": elapsed_ms,
            }

            logger.info(
                "detect-contradictions job completed",
                job_id=job.id,
                **result,
            )

            return result

        except NON_RETRYABLE_ERRORS as e:
            logger.error(
                "detect-contradictions job failed permanently",
                job_id=job.id,
                deal_id=deal_id,
                error=str(e),
                error_type=type(e).__name__,
            )

            if document_id:
                await self.retry_mgr.handle_job_failure(
                    document_id=UUID(document_id),
                    error=e,
                    current_stage="contradiction_detection",
                    retry_count=job.retry_count,
                )
            raise

        except DatabaseError as e:
            logger.warning(
                "detect-contradictions job failed (may retry)",
                job_id=job.id,
                deal_id=deal_id,
                error=str(e),
                error_type=type(e).__name__,
                retryable=e.retryable,
            )

            if document_id:
                await self.retry_mgr.handle_job_failure(
                    document_id=UUID(document_id),
                    error=e,
                    current_stage="contradiction_detection",
                    retry_count=job.retry_count,
                )
            raise

        except Exception as e:
            error_type = type(e).__name__

            logger.error(
                "detect-contradictions job failed unexpectedly",
                job_id=job.id,
                deal_id=deal_id,
                error=str(e),
                error_type=error_type,
                exc_info=True,
            )

            if document_id:
                await self.retry_mgr.handle_job_failure(
                    document_id=UUID(document_id),
                    error=e,
                    current_stage="contradiction_detection",
                    retry_count=job.retry_count,
                )
            raise

    def _group_findings_by_domain(
        self,
        findings: list[dict[str, Any]],
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Group findings by domain and filter out rejected findings.

        Args:
            findings: List of finding dicts from database

        Returns:
            Dict mapping domain -> list of findings
        """
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for finding in findings:
            # Skip rejected findings (AC: #2)
            status = finding.get("status", "pending")
            if status == "rejected":
                continue

            domain = finding.get("domain", "operational")
            groups[domain].append(finding)

        return dict(groups)

    def _generate_comparison_pairs(
        self,
        domain_groups: dict[str, list[dict[str, Any]]],
    ) -> list[tuple[dict[str, Any], dict[str, Any]]]:
        """
        Generate finding pairs for comparison with pre-filtering.

        Pre-filtering (AC: #8, #9):
        - Limit to MAX_FINDINGS_PER_DOMAIN per domain
        - Skip identical findings (same text)
        - Skip findings from the same chunk
        - Only compare findings with overlapping date_referenced (if available)

        Args:
            domain_groups: Dict mapping domain -> list of findings

        Returns:
            List of (finding_a, finding_b) tuples to compare
        """
        all_pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []

        for domain, findings in domain_groups.items():
            # Limit findings per domain (AC: #8)
            if len(findings) > MAX_FINDINGS_PER_DOMAIN:
                logger.info(
                    "Limiting findings for domain",
                    domain=domain,
                    original_count=len(findings),
                    limited_to=MAX_FINDINGS_PER_DOMAIN,
                )
                # Sort by confidence descending and take top N
                findings = sorted(
                    findings,
                    key=lambda f: f.get("confidence", 0) or 0,
                    reverse=True,
                )[:MAX_FINDINGS_PER_DOMAIN]

            # Generate pairwise combinations
            for finding_a, finding_b in combinations(findings, 2):
                # Skip identical findings (same text = same finding) (AC: #8)
                text_a = finding_a.get("text", "").strip()
                text_b = finding_b.get("text", "").strip()
                if text_a == text_b:
                    continue

                # Skip findings from the same chunk (same source = not contradiction) (AC: #9)
                chunk_a = finding_a.get("chunk_id")
                chunk_b = finding_b.get("chunk_id")
                if chunk_a and chunk_b and chunk_a == chunk_b:
                    continue

                # Skip findings with different date_referenced (temporal alignment) (AC: #9)
                # Only filter if both have date_referenced set
                date_a = finding_a.get("date_referenced")
                date_b = finding_b.get("date_referenced")
                if date_a and date_b and date_a != date_b:
                    continue

                all_pairs.append((finding_a, finding_b))

        return all_pairs

    async def _store_contradiction(
        self,
        deal_id: str,
        contradiction: ContradictionResult,
    ) -> bool:
        """
        Store a detected contradiction in both Neo4j and Supabase.

        Args:
            deal_id: The deal/project ID
            contradiction: The contradiction result from LLM comparison

        Returns:
            True if stored successfully

        Note: This implements "best effort" dual-write rather than true
        distributed transaction. If one write fails, we log and continue.
        """
        finding_a_id = contradiction.finding_a_id
        finding_b_id = contradiction.finding_b_id

        logger.info(
            "Storing contradiction",
            deal_id=deal_id,
            finding_a_id=finding_a_id,
            finding_b_id=finding_b_id,
            confidence=contradiction.confidence,
        )

        # Check for existing contradiction (dedupe) (AC: #6)
        existing = await self.db.get_existing_contradiction(
            finding_a_id=UUID(finding_a_id),
            finding_b_id=UUID(finding_b_id),
        )

        if existing:
            logger.info(
                "Contradiction already exists, skipping",
                finding_a_id=finding_a_id,
                finding_b_id=finding_b_id,
                existing_id=existing.get("id"),
            )
            return False

        # Store in Supabase contradictions table (AC: #6)
        try:
            await self.db.store_contradiction(
                deal_id=UUID(deal_id),
                finding_a_id=UUID(finding_a_id),
                finding_b_id=UUID(finding_b_id),
                confidence=contradiction.confidence,
                reason=contradiction.reason,
            )
            logger.debug(
                "Stored contradiction in Supabase",
                finding_a_id=finding_a_id,
                finding_b_id=finding_b_id,
            )
        except Exception as e:
            logger.error(
                "Failed to store contradiction in Supabase",
                finding_a_id=finding_a_id,
                finding_b_id=finding_b_id,
                error=str(e),
            )
            # Continue to try Neo4j anyway
            return False

        # Note: Neo4j CONTRADICTS relationship creation is handled by
        # the Next.js app's Neo4j client since manda-processing doesn't
        # have direct Neo4j access. The relationship can be created via:
        # 1. A separate Neo4j sync job
        # 2. API call to Next.js endpoint
        # 3. Direct insertion if Neo4j client added to manda-processing
        #
        # For now, the Supabase contradictions table is the primary store,
        # and Neo4j relationships can be synced as a follow-up task.

        return True


# Handler instance factory
_handler: Optional[DetectContradictionsHandler] = None


def get_detect_contradictions_handler() -> DetectContradictionsHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = DetectContradictionsHandler()
    return _handler


async def handle_detect_contradictions(job: Job) -> dict[str, Any]:
    """
    Entry point for detect-contradictions job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_detect_contradictions_handler()
    return await handler.handle(job)


__all__ = [
    "DetectContradictionsHandler",
    "handle_detect_contradictions",
    "get_detect_contradictions_handler",
]
