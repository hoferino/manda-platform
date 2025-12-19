"""
Integration tests for Pydantic AI analysis.
Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI (AC: #2, #3, #5)

These tests require:
- GOOGLE_API_KEY set for Gemini models (google-gla provider)
- Or ANTHROPIC_API_KEY for Claude models

Run with: pytest tests/integration/test_pydantic_ai_analysis.py -m integration
"""

import pytest
from unittest.mock import MagicMock

from src.llm.pydantic_agent import (
    AnalysisDependencies,
    create_analysis_agent,
)
from src.llm.schemas import FindingResult


@pytest.fixture
def mock_deps():
    """Create mock dependencies for testing."""
    mock_db = MagicMock()
    mock_db.get_findings_by_document = MagicMock(return_value=[])

    return AnalysisDependencies(
        db=mock_db,
        graphiti=None,
        deal_id="test-deal-123",
        document_id="test-doc-456",
        document_name="test_financials.pdf",
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_extraction_flow(mock_deps):
    """
    Test complete extraction with real LLM.

    This test requires a valid API key to be set.
    """
    try:
        agent = create_analysis_agent()
    except Exception as e:
        if "api_key" in str(e).lower() or "GOOGLE" in str(e):
            pytest.skip("Google API key not configured")
        raise

    sample_content = """
    Revenue was $5.2M in Q3 2024, up 15% from Q2.
    The company identified a risk of customer churn in the enterprise segment.
    EBITDA margin improved to 23.5% from 21.2% in the prior quarter.
    Management assumes 10% growth rate for 2025.
    """

    try:
        result = await agent.run(
            f"Extract findings from this financial content:\n\n{sample_content}",
            deps=mock_deps,
        )

        # Structured output guaranteed by Pydantic AI
        assert isinstance(result.data, list)
        assert all(isinstance(f, FindingResult) for f in result.data)

        # Should extract multiple findings from the content
        assert len(result.data) >= 2

        # Check that findings have valid types
        valid_types = {"fact", "metric", "risk", "opportunity", "assumption"}
        for finding in result.data:
            assert finding.finding_type in valid_types
            assert 0.0 <= finding.confidence <= 1.0
            assert len(finding.content) > 0

        # Pydantic AI 1.x uses result.usage() method
        usage = result.usage()
        assert usage is not None
        assert usage.request_tokens > 0

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.integration
@pytest.mark.asyncio
async def test_model_switching(mock_deps):
    """
    Test switching between different model providers.

    Validates that model string syntax works for different providers.
    """
    # Test with Gemini (most likely to be configured)
    try:
        gemini_agent = create_analysis_agent(model="google-gla:gemini-2.5-flash")
    except Exception as e:
        if "api_key" in str(e).lower() or "GOOGLE" in str(e):
            pytest.skip("Google API key not configured")
        raise

    try:
        result = await gemini_agent.run(
            "What is 2+2? Respond with a single finding.",
            deps=mock_deps,
        )

        assert result.data is not None

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("Google API key not configured")
        raise


@pytest.mark.integration
@pytest.mark.asyncio
async def test_token_counting(mock_deps):
    """
    Test that token usage is properly tracked.
    """
    try:
        agent = create_analysis_agent()
    except Exception as e:
        if "api_key" in str(e).lower() or "GOOGLE" in str(e):
            pytest.skip("Google API key not configured")
        raise

    try:
        result = await agent.run(
            "Extract one finding from: Revenue increased by 10%.",
            deps=mock_deps,
        )

        usage = result.usage()
        assert usage is not None
        assert usage.request_tokens > 0
        assert usage.response_tokens > 0

        # Total should be sum of request + response
        total = usage.request_tokens + usage.response_tokens
        assert total > 0

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.integration
@pytest.mark.asyncio
async def test_structured_output_validation(mock_deps):
    """
    Test that Pydantic AI validates structured output correctly.
    """
    try:
        agent = create_analysis_agent()
    except Exception as e:
        if "api_key" in str(e).lower() or "GOOGLE" in str(e):
            pytest.skip("Google API key not configured")
        raise

    try:
        # Request that should produce structured findings
        result = await agent.run(
            """Extract findings from this M&A context:
            - The target company has $10M ARR
            - There is a risk of key employee departure
            - The assumption is that market growth continues at 8% CAGR
            """,
            deps=mock_deps,
        )

        # All findings should be valid FindingResult instances
        for finding in result.data:
            assert isinstance(finding, FindingResult)

            # Validate required fields
            assert finding.content is not None
            assert finding.finding_type is not None
            assert isinstance(finding.confidence, float)
            assert isinstance(finding.source_reference, dict)

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.integration
@pytest.mark.asyncio
async def test_dependency_injection_in_tools(mock_deps):
    """
    Test that tools can access dependencies via RunContext.
    """
    try:
        agent = create_analysis_agent()
    except Exception as e:
        if "api_key" in str(e).lower() or "GOOGLE" in str(e):
            pytest.skip("Google API key not configured")
        raise

    # Mock the database method that tools might call
    mock_deps.db.get_findings_by_document.return_value = [
        {"id": "finding-1", "content": "Previous finding"}
    ]

    try:
        result = await agent.run(
            "Classify this chunk: Revenue breakdown by segment shows growth.",
            deps=mock_deps,
        )

        # The agent should be able to run (tools have access to deps)
        assert result.data is not None

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise
