"""
Tests for the detect_contradictions job handler.
Story: E4.7 - Detect Contradictions Using Neo4j (AC: #1, #2, #5-10)
"""

import os
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from src.jobs.queue import Job, JobState

# Set test environment variables
os.environ.setdefault("GOOGLE_API_KEY", "test-google-api-key")


from src.jobs.handlers.detect_contradictions import (
    DetectContradictionsHandler,
    handle_detect_contradictions,
    MAX_FINDINGS_PER_DOMAIN,
    BATCH_SIZE,
)
from src.llm.contradiction_detector import (
    ContradictionResult,
    BatchComparisonResult,
)


# --- Fixtures ---


@pytest.fixture
def sample_deal_id() -> str:
    """Sample deal ID."""
    return str(uuid4())


@pytest.fixture
def sample_document_id() -> str:
    """Sample document ID."""
    return str(uuid4())


@pytest.fixture
def sample_user_id() -> str:
    """Sample user ID."""
    return str(uuid4())


@pytest.fixture
def sample_job_payload(
    sample_deal_id: str,
    sample_document_id: str,
    sample_user_id: str,
) -> dict[str, Any]:
    """Sample job payload for detect-contradictions."""
    return {
        "deal_id": sample_deal_id,
        "document_id": sample_document_id,
        "user_id": sample_user_id,
    }


@pytest.fixture
def sample_job(sample_job_payload: dict[str, Any]) -> Job:
    """Create a sample Job instance."""
    return Job(
        id=str(uuid4()),
        name="detect-contradictions",
        data=sample_job_payload,
        state=JobState.ACTIVE,
        created_on=datetime.now(),
        started_on=datetime.now(),
        retry_count=0,
    )


@pytest.fixture
def sample_findings() -> list[dict[str, Any]]:
    """Sample findings for comparison."""
    return [
        {
            "id": str(uuid4()),
            "text": "Revenue was $50 million in Q3 2024.",
            "domain": "financial",
            "status": "pending",
            "confidence": 0.9,
            "chunk_id": "chunk-1",
            "date_referenced": "Q3 2024",
        },
        {
            "id": str(uuid4()),
            "text": "Revenue was $35 million in Q3 2024.",
            "domain": "financial",
            "status": "pending",
            "confidence": 0.85,
            "chunk_id": "chunk-2",
            "date_referenced": "Q3 2024",
        },
        {
            "id": str(uuid4()),
            "text": "Employee count was 250 at year end.",
            "domain": "operational",
            "status": "pending",
            "confidence": 0.8,
            "chunk_id": "chunk-3",
            "date_referenced": "2024",
        },
        {
            "id": str(uuid4()),
            "text": "This finding has been rejected.",
            "domain": "financial",
            "status": "rejected",  # Should be filtered out
            "confidence": 0.9,
            "chunk_id": "chunk-4",
        },
    ]


@pytest.fixture
def mock_db_client():
    """Mock SupabaseClient."""
    client = MagicMock()
    client.get_findings_by_deal = AsyncMock()
    client.get_existing_contradiction = AsyncMock(return_value=None)
    client.store_contradiction = AsyncMock()
    return client


@pytest.fixture
def mock_detector():
    """Mock ContradictionDetector."""
    detector = MagicMock()
    detector.compare_batch = AsyncMock()
    return detector


@pytest.fixture
def mock_retry_manager():
    """Mock RetryManager."""
    manager = MagicMock()
    manager.prepare_stage_retry = AsyncMock()
    manager.mark_stage_complete = AsyncMock()
    manager.handle_job_failure = AsyncMock()
    return manager


@pytest.fixture
def handler(mock_db_client, mock_detector, mock_retry_manager):
    """Handler with mocked dependencies."""
    return DetectContradictionsHandler(
        db_client=mock_db_client,
        detector=mock_detector,
        retry_manager=mock_retry_manager,
    )


# --- Unit Tests for Handler ---


class TestDetectContradictionsHandler:
    """Tests for DetectContradictionsHandler."""

    @pytest.mark.asyncio
    async def test_handle_success_with_contradictions(
        self,
        handler,
        sample_job,
        sample_findings,
        mock_db_client,
        mock_detector,
        mock_retry_manager,
    ):
        """Test successful handling with detected contradictions."""
        mock_db_client.get_findings_by_deal.return_value = sample_findings

        # Return a contradiction between the two financial findings
        mock_detector.compare_batch.return_value = BatchComparisonResult(
            comparisons=[
                ContradictionResult(
                    finding_a_id=sample_findings[0]["id"],
                    finding_b_id=sample_findings[1]["id"],
                    contradicts=True,
                    confidence=0.85,
                    reason="Different revenue figures",
                ),
            ],
            total_input_tokens=1000,
            total_output_tokens=200,
            batch_count=1,
        )

        mock_db_client.store_contradiction.return_value = uuid4()

        result = await handler.handle(sample_job)

        # Verify success
        assert result["success"] is True
        assert result["contradictions_found"] == 1
        assert result["findings_count"] == 4  # All findings fetched

        # Verify store was called
        mock_db_client.store_contradiction.assert_called_once()

        # Verify stage tracking
        mock_retry_manager.mark_stage_complete.assert_called()

    @pytest.mark.asyncio
    async def test_handle_no_findings(
        self,
        handler,
        sample_job,
        mock_db_client,
        mock_detector,
    ):
        """Test handling when no findings exist."""
        mock_db_client.get_findings_by_deal.return_value = []

        result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["findings_count"] == 0
        assert result["comparisons_made"] == 0
        assert result["contradictions_found"] == 0

        # Detector should not be called
        mock_detector.compare_batch.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_filters_rejected_findings(
        self,
        handler,
        sample_job,
        sample_findings,
        mock_db_client,
        mock_detector,
    ):
        """Test that rejected findings are excluded from comparison."""
        mock_db_client.get_findings_by_deal.return_value = sample_findings

        # No contradictions found
        mock_detector.compare_batch.return_value = BatchComparisonResult(
            comparisons=[],
            total_input_tokens=0,
            total_output_tokens=0,
            batch_count=0,
        )

        await handler.handle(sample_job)

        # Get the pairs that were passed to compare_batch
        call_args = mock_detector.compare_batch.call_args
        if call_args:
            pairs = call_args[1]["pairs"] if "pairs" in call_args[1] else call_args[0][0]
            # Verify rejected finding is not in any pair
            rejected_id = sample_findings[3]["id"]
            for finding_a, finding_b in pairs:
                assert finding_a.get("id") != rejected_id
                assert finding_b.get("id") != rejected_id

    @pytest.mark.asyncio
    async def test_handle_deduplicates_existing_contradictions(
        self,
        handler,
        sample_job,
        sample_findings,
        mock_db_client,
        mock_detector,
    ):
        """Test that existing contradictions are not stored again."""
        mock_db_client.get_findings_by_deal.return_value = sample_findings

        mock_detector.compare_batch.return_value = BatchComparisonResult(
            comparisons=[
                ContradictionResult(
                    finding_a_id=sample_findings[0]["id"],
                    finding_b_id=sample_findings[1]["id"],
                    contradicts=True,
                    confidence=0.85,
                    reason="Duplicate",
                ),
            ],
            total_input_tokens=1000,
            total_output_tokens=200,
            batch_count=1,
        )

        # Contradiction already exists
        mock_db_client.get_existing_contradiction.return_value = {"id": str(uuid4())}

        result = await handler.handle(sample_job)

        # Should not store again
        mock_db_client.store_contradiction.assert_not_called()
        assert result["contradictions_found"] == 0

    @pytest.mark.asyncio
    async def test_handle_requires_deal_id(self, handler):
        """Test that deal_id is required."""
        job = Job(
            id=str(uuid4()),
            name="detect-contradictions",
            data={"document_id": str(uuid4())},  # Missing deal_id
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            started_on=datetime.now(),
            retry_count=0,
        )

        with pytest.raises(ValueError, match="deal_id is required"):
            await handler.handle(job)


# --- Unit Tests for Domain Grouping ---


class TestDomainGrouping:
    """Tests for finding grouping by domain."""

    def test_group_findings_by_domain(self, handler, sample_findings):
        """Test that findings are grouped correctly by domain."""
        groups = handler._group_findings_by_domain(sample_findings)

        # Financial findings (excluding rejected)
        assert "financial" in groups
        assert len(groups["financial"]) == 2  # 2 non-rejected financial

        # Operational findings
        assert "operational" in groups
        assert len(groups["operational"]) == 1

    def test_group_excludes_rejected(self, handler, sample_findings):
        """Test that rejected findings are excluded."""
        groups = handler._group_findings_by_domain(sample_findings)

        # Flatten all findings
        all_findings = []
        for findings in groups.values():
            all_findings.extend(findings)

        # None should be rejected
        assert all(f.get("status") != "rejected" for f in all_findings)


# --- Unit Tests for Pair Generation ---


class TestPairGeneration:
    """Tests for comparison pair generation."""

    def test_generate_pairs_within_domain(self, handler, sample_findings):
        """Test pairs are generated within domain."""
        groups = handler._group_findings_by_domain(sample_findings)
        pairs = handler._generate_comparison_pairs(groups)

        # Should only have 1 pair (the two financial findings)
        # The operational finding has no partner
        assert len(pairs) == 1

        # Verify the pair is the two financial findings
        finding_ids = [sample_findings[0]["id"], sample_findings[1]["id"]]
        pair_ids = [pairs[0][0]["id"], pairs[0][1]["id"]]
        assert set(pair_ids) == set(finding_ids)

    def test_generate_pairs_skips_same_chunk(self, handler):
        """Test that findings from same chunk are not compared."""
        findings = [
            {
                "id": "1",
                "text": "Finding 1",
                "domain": "financial",
                "status": "pending",
                "chunk_id": "same-chunk",
            },
            {
                "id": "2",
                "text": "Finding 2",
                "domain": "financial",
                "status": "pending",
                "chunk_id": "same-chunk",  # Same chunk
            },
        ]

        groups = handler._group_findings_by_domain(findings)
        pairs = handler._generate_comparison_pairs(groups)

        # Should have no pairs
        assert len(pairs) == 0

    def test_generate_pairs_skips_different_dates(self, handler):
        """Test that findings with different date_referenced are not compared."""
        findings = [
            {
                "id": "1",
                "text": "Finding 1",
                "domain": "financial",
                "status": "pending",
                "chunk_id": "chunk-1",
                "date_referenced": "Q1 2024",
            },
            {
                "id": "2",
                "text": "Finding 2",
                "domain": "financial",
                "status": "pending",
                "chunk_id": "chunk-2",
                "date_referenced": "Q3 2024",  # Different period
            },
        ]

        groups = handler._group_findings_by_domain(findings)
        pairs = handler._generate_comparison_pairs(groups)

        # Should have no pairs due to date mismatch
        assert len(pairs) == 0

    def test_generate_pairs_skips_identical_text(self, handler):
        """Test that findings with identical text are not compared."""
        findings = [
            {
                "id": "1",
                "text": "Exact same text",
                "domain": "financial",
                "status": "pending",
                "chunk_id": "chunk-1",
            },
            {
                "id": "2",
                "text": "Exact same text",  # Same text
                "domain": "financial",
                "status": "pending",
                "chunk_id": "chunk-2",
            },
        ]

        groups = handler._group_findings_by_domain(findings)
        pairs = handler._generate_comparison_pairs(groups)

        # Should have no pairs
        assert len(pairs) == 0

    def test_generate_pairs_limits_per_domain(self, handler):
        """Test that findings are limited per domain."""
        # Create more than MAX_FINDINGS_PER_DOMAIN findings
        findings = [
            {
                "id": str(i),
                "text": f"Finding {i}",
                "domain": "financial",
                "status": "pending",
                "chunk_id": f"chunk-{i}",
                "confidence": 0.9 - (i * 0.001),  # Decreasing confidence
            }
            for i in range(MAX_FINDINGS_PER_DOMAIN + 20)
        ]

        groups = handler._group_findings_by_domain(findings)
        pairs = handler._generate_comparison_pairs(groups)

        # Number of pairs should be limited
        max_pairs = (MAX_FINDINGS_PER_DOMAIN * (MAX_FINDINGS_PER_DOMAIN - 1)) // 2
        assert len(pairs) <= max_pairs


# --- Integration Test with Entry Point ---


class TestHandleEntryPoint:
    """Tests for the module-level entry point."""

    @pytest.mark.asyncio
    async def test_handle_detect_contradictions_function(
        self,
        sample_job,
    ):
        """Test the module-level handler function."""
        with patch(
            "src.jobs.handlers.detect_contradictions.get_detect_contradictions_handler"
        ) as mock_get_handler:
            mock_handler = MagicMock()
            mock_handler.handle = AsyncMock(
                return_value={
                    "success": True,
                    "contradictions_found": 5,
                }
            )
            mock_get_handler.return_value = mock_handler

            result = await handle_detect_contradictions(sample_job)

            assert result["success"] is True
            assert result["contradictions_found"] == 5
            mock_handler.handle.assert_called_once_with(sample_job)
