"""
Tests for the contradiction detector LLM service.
Story: E4.7 - Detect Contradictions Using Neo4j (AC: #3, #4)
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

# Set test environment variables
os.environ.setdefault("GOOGLE_API_KEY", "test-google-api-key")

from src.llm.contradiction_detector import (
    ContradictionDetector,
    ContradictionResult,
    BatchComparisonResult,
    ComparisonResult,
    CONTRADICTION_CONFIDENCE_THRESHOLD,
    _parse_comparison_response,
    _parse_batch_response,
    _get_comparison_prompt,
)


# --- Fixtures ---


@pytest.fixture
def mock_llm_client():
    """Mock Gemini client for testing."""
    client = MagicMock()
    client._invoke_model = AsyncMock()
    return client


@pytest.fixture
def detector(mock_llm_client):
    """Contradiction detector with mocked LLM client."""
    return ContradictionDetector(llm_client=mock_llm_client)


@pytest.fixture
def sample_finding_a():
    """Sample finding A for comparison."""
    return {
        "id": str(uuid4()),
        "text": "The company reported revenue of $50 million in Q3 2024.",
        "source_document": "Q3_Report.pdf",
        "domain": "financial",
        "date_referenced": "Q3 2024",
        "page_number": 5,
    }


@pytest.fixture
def sample_finding_b_contradiction():
    """Sample finding B that contradicts finding A."""
    return {
        "id": str(uuid4()),
        "text": "Revenue for Q3 2024 was $35 million, below projections.",
        "source_document": "Board_Presentation.pptx",
        "domain": "financial",
        "date_referenced": "Q3 2024",
        "page_number": 12,
    }


@pytest.fixture
def sample_finding_b_no_contradiction():
    """Sample finding B that does not contradict finding A."""
    return {
        "id": str(uuid4()),
        "text": "Employee count increased to 250 in Q3 2024.",
        "source_document": "HR_Report.pdf",
        "domain": "operational",
        "date_referenced": "Q3 2024",
        "page_number": 3,
    }


# --- Unit Tests for Response Parsing ---


class TestResponseParsing:
    """Tests for parsing LLM responses."""

    def test_parse_comparison_response_simple_json(self):
        """Parse a simple JSON comparison response."""
        response = '{"contradicts": true, "confidence": 0.85, "reason": "Different revenue figures"}'

        result = _parse_comparison_response(response)

        assert result.contradicts is True
        assert result.confidence == 0.85
        assert result.reason == "Different revenue figures"

    def test_parse_comparison_response_with_markdown(self):
        """Parse JSON embedded in markdown code blocks."""
        response = """```json
{"contradicts": false, "confidence": 0.2, "reason": "Different topics entirely"}
```"""

        result = _parse_comparison_response(response)

        assert result.contradicts is False
        assert result.confidence == 0.2
        assert "Different topics" in result.reason

    def test_parse_comparison_response_with_extra_text(self):
        """Parse JSON with surrounding explanation text."""
        response = """Let me analyze these findings.

After careful comparison: {"contradicts": true, "confidence": 0.92, "reason": "Conflicting numbers"}

This appears to be a significant discrepancy."""

        result = _parse_comparison_response(response)

        assert result.contradicts is True
        assert result.confidence == 0.92

    def test_parse_comparison_response_invalid_json(self):
        """Fail to parse when no valid JSON found."""
        response = "These findings are not contradictory."

        with pytest.raises(ValueError, match="No JSON object found"):
            _parse_comparison_response(response)

    def test_parse_batch_response_valid(self):
        """Parse a valid batch response."""
        response = """[
  {"pair": 1, "contradicts": true, "confidence": 0.85, "reason": "Revenue discrepancy"},
  {"pair": 2, "contradicts": false, "confidence": 0.15, "reason": "Different metrics"}
]"""

        results = _parse_batch_response(response, 2)

        assert len(results) == 2
        assert results[0]["pair"] == 1
        assert results[0]["contradicts"] is True
        assert results[1]["pair"] == 2
        assert results[1]["contradicts"] is False

    def test_parse_batch_response_no_array(self):
        """Fail when response doesn't contain array."""
        response = '{"error": "Something went wrong"}'

        with pytest.raises(ValueError, match="No JSON array found"):
            _parse_batch_response(response, 2)


# --- Unit Tests for Contradiction Detection ---


class TestContradictionDetector:
    """Tests for the ContradictionDetector class."""

    @pytest.mark.asyncio
    async def test_compare_findings_contradiction(
        self,
        detector,
        mock_llm_client,
        sample_finding_a,
        sample_finding_b_contradiction,
    ):
        """Test comparing two contradicting findings."""
        mock_llm_client._invoke_model.return_value = (
            '{"contradicts": true, "confidence": 0.88, "reason": "Different revenue figures for same quarter"}',
            1000,
            200,
        )

        result = await detector.compare_findings(
            sample_finding_a,
            sample_finding_b_contradiction,
        )

        assert isinstance(result, ContradictionResult)
        assert result.contradicts is True
        assert result.confidence == 0.88
        assert result.above_threshold is True  # 0.88 > 0.70
        assert "revenue" in result.reason.lower()
        assert result.finding_a_id == sample_finding_a["id"]
        assert result.finding_b_id == sample_finding_b_contradiction["id"]

    @pytest.mark.asyncio
    async def test_compare_findings_no_contradiction(
        self,
        detector,
        mock_llm_client,
        sample_finding_a,
        sample_finding_b_no_contradiction,
    ):
        """Test comparing two non-contradicting findings."""
        mock_llm_client._invoke_model.return_value = (
            '{"contradicts": false, "confidence": 0.1, "reason": "Different domains and topics"}',
            1000,
            200,
        )

        result = await detector.compare_findings(
            sample_finding_a,
            sample_finding_b_no_contradiction,
        )

        assert result.contradicts is False
        assert result.confidence == 0.1
        assert result.above_threshold is False

    @pytest.mark.asyncio
    async def test_compare_findings_below_threshold(
        self,
        detector,
        mock_llm_client,
        sample_finding_a,
        sample_finding_b_contradiction,
    ):
        """Test contradiction detected but below confidence threshold."""
        mock_llm_client._invoke_model.return_value = (
            '{"contradicts": true, "confidence": 0.55, "reason": "Possible discrepancy but uncertain"}',
            1000,
            200,
        )

        result = await detector.compare_findings(
            sample_finding_a,
            sample_finding_b_contradiction,
        )

        assert result.contradicts is True
        assert result.confidence == 0.55
        # Below 70% threshold
        assert result.above_threshold is False

    @pytest.mark.asyncio
    async def test_compare_batch_multiple_pairs(
        self,
        detector,
        mock_llm_client,
        sample_finding_a,
    ):
        """Test batch comparison of multiple finding pairs."""
        finding_b = {"id": str(uuid4()), "text": "Revenue was $35M", "domain": "financial"}
        finding_c = {"id": str(uuid4()), "text": "Employee count 250", "domain": "operational"}
        finding_d = {"id": str(uuid4()), "text": "Revenue was $48M", "domain": "financial"}

        pairs = [
            (sample_finding_a, finding_b),
            (sample_finding_a, finding_c),
            (sample_finding_a, finding_d),
        ]

        mock_llm_client._invoke_model.return_value = (
            """[
              {"pair": 1, "contradicts": true, "confidence": 0.85, "reason": "Revenue mismatch"},
              {"pair": 2, "contradicts": false, "confidence": 0.05, "reason": "Different topics"},
              {"pair": 3, "contradicts": true, "confidence": 0.72, "reason": "Similar revenue discrepancy"}
            ]""",
            3000,
            600,
        )

        result = await detector.compare_batch(pairs, batch_size=5)

        assert isinstance(result, BatchComparisonResult)
        assert len(result.comparisons) == 3
        assert len(result.contradictions_found) == 2  # Both above 70%
        assert len(result.contradictions_below_threshold) == 0
        assert result.total_input_tokens == 3000
        assert result.total_output_tokens == 600

    @pytest.mark.asyncio
    async def test_compare_batch_empty_pairs(self, detector):
        """Test batch comparison with empty pairs list."""
        result = await detector.compare_batch([])

        assert len(result.comparisons) == 0
        assert len(result.contradictions_found) == 0

    @pytest.mark.asyncio
    async def test_compare_batch_handles_parse_error(
        self,
        detector,
        mock_llm_client,
        sample_finding_a,
    ):
        """Test batch comparison handles parsing errors gracefully."""
        finding_b = {"id": str(uuid4()), "text": "Some text", "domain": "financial"}
        pairs = [(sample_finding_a, finding_b)]

        # Return invalid response
        mock_llm_client._invoke_model.return_value = (
            "I cannot process this request.",
            500,
            100,
        )

        result = await detector.compare_batch(pairs, batch_size=5)

        # Should have failed comparisons tracked
        assert len(result.failed_comparisons) == 1
        assert len(result.comparisons) == 0


# --- Unit Tests for Comparison Prompt Generation ---


class TestPromptGeneration:
    """Tests for prompt generation functions."""

    def test_get_comparison_prompt_includes_key_fields(
        self,
        sample_finding_a,
        sample_finding_b_contradiction,
    ):
        """Test that comparison prompt includes all key fields."""
        prompt = _get_comparison_prompt(sample_finding_a, sample_finding_b_contradiction)

        # Check Finding A content is included
        assert "$50 million" in prompt
        assert "Q3_Report.pdf" in prompt
        assert "financial" in prompt

        # Check Finding B content is included
        assert "$35 million" in prompt
        assert "Board_Presentation.pptx" in prompt

        # Check structure elements
        assert "Finding A" in prompt
        assert "Finding B" in prompt
        assert "JSON" in prompt

    def test_get_comparison_prompt_handles_missing_fields(self):
        """Test prompt generation with minimal fields."""
        minimal_finding_a = {"text": "Some text", "id": str(uuid4())}
        minimal_finding_b = {"text": "Other text", "id": str(uuid4())}

        prompt = _get_comparison_prompt(minimal_finding_a, minimal_finding_b)

        assert "Some text" in prompt
        assert "Other text" in prompt
        assert "Unknown" in prompt  # Default for missing fields


# --- Unit Tests for Result Properties ---


class TestContradictionResultProperties:
    """Tests for ContradictionResult properties."""

    def test_above_threshold_true(self):
        """Test above_threshold when contradiction is above 70%."""
        result = ContradictionResult(
            finding_a_id="a",
            finding_b_id="b",
            contradicts=True,
            confidence=0.85,
            reason="test",
        )

        assert result.above_threshold is True

    def test_above_threshold_false_low_confidence(self):
        """Test above_threshold when confidence is below 70%."""
        result = ContradictionResult(
            finding_a_id="a",
            finding_b_id="b",
            contradicts=True,
            confidence=0.65,
            reason="test",
        )

        assert result.above_threshold is False

    def test_above_threshold_false_no_contradiction(self):
        """Test above_threshold when not a contradiction."""
        result = ContradictionResult(
            finding_a_id="a",
            finding_b_id="b",
            contradicts=False,
            confidence=0.90,
            reason="test",
        )

        assert result.above_threshold is False

    def test_threshold_constant(self):
        """Verify the 70% threshold constant."""
        assert CONTRADICTION_CONFIDENCE_THRESHOLD == 0.70


class TestBatchComparisonResultProperties:
    """Tests for BatchComparisonResult properties."""

    def test_contradictions_found_filters_correctly(self):
        """Test that contradictions_found returns only above-threshold items."""
        result = BatchComparisonResult(
            comparisons=[
                ContradictionResult("a", "b", True, 0.85, "high"),
                ContradictionResult("c", "d", True, 0.60, "low"),  # Below threshold
                ContradictionResult("e", "f", False, 0.90, "not contradiction"),
                ContradictionResult("g", "h", True, 0.75, "medium"),
            ]
        )

        found = result.contradictions_found
        assert len(found) == 2
        assert all(c.above_threshold for c in found)

    def test_contradictions_below_threshold(self):
        """Test that contradictions_below_threshold returns correct items."""
        result = BatchComparisonResult(
            comparisons=[
                ContradictionResult("a", "b", True, 0.85, "high"),
                ContradictionResult("c", "d", True, 0.60, "low"),  # Below threshold
                ContradictionResult("e", "f", True, 0.50, "very low"),  # Below threshold
            ]
        )

        below = result.contradictions_below_threshold
        assert len(below) == 2
        assert all(c.contradicts and not c.above_threshold for c in below)
