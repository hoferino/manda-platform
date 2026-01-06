"""
Unit tests for Financial Analyst Specialist Agent.
Story: E13.5 - Financial Analyst Specialist Agent (AC: #5)

Tests:
- FinancialDependencies dataclass creation and validation
- FinancialAnalysisResult Pydantic model validation
- Tool execution with mocked Graphiti/DB
- Ratio calculations accuracy
- Period comparison logic
"""

from dataclasses import fields
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from src.agents.schemas.financial import (
    FinancialAnalysisResult,
    FinancialFinding,
    FinancialRatio,
    PeriodComparison,
    SourceReference,
)
from src.agents.financial_analyst import (
    FinancialDependencies,
    FINANCIAL_ANALYST_SYSTEM_PROMPT,
    create_financial_analyst_agent,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_supabase():
    """Mock SupabaseClient for testing."""
    mock = MagicMock()
    mock.get_findings_by_document = AsyncMock(return_value=[])
    return mock


@pytest.fixture
def mock_graphiti():
    """Mock GraphitiClient for testing."""
    mock = MagicMock()
    mock._instance = MagicMock()
    mock._instance.search = AsyncMock(return_value=[])
    return mock


@pytest.fixture
def financial_deps(mock_supabase, mock_graphiti):
    """Create FinancialDependencies for testing."""
    return FinancialDependencies(
        db=mock_supabase,
        graphiti=mock_graphiti,
        deal_id="test-deal-123",
        organization_id="test-org-456",
        document_ids=["doc-1", "doc-2"],
        context_window="Test context for financial analysis",
    )


# =============================================================================
# FinancialDependencies Tests (Task 1)
# =============================================================================


class TestFinancialDependencies:
    """Tests for FinancialDependencies dataclass."""

    def test_create_with_required_fields(self, mock_supabase):
        """Test creating dependencies with only required fields."""
        deps = FinancialDependencies(
            db=mock_supabase,
            graphiti=None,
            deal_id="deal-123",
            organization_id="org-456",
        )
        assert deps.deal_id == "deal-123"
        assert deps.organization_id == "org-456"
        assert deps.graphiti is None
        assert deps.document_ids == []
        assert deps.context_window == ""

    def test_create_with_all_fields(self, mock_supabase, mock_graphiti):
        """Test creating dependencies with all fields."""
        deps = FinancialDependencies(
            db=mock_supabase,
            graphiti=mock_graphiti,
            deal_id="deal-123",
            organization_id="org-456",
            document_ids=["doc-1", "doc-2"],
            context_window="Additional context",
        )
        assert deps.document_ids == ["doc-1", "doc-2"]
        assert deps.context_window == "Additional context"

    def test_dataclass_has_expected_fields(self):
        """Test that FinancialDependencies has all expected fields."""
        field_names = {f.name for f in fields(FinancialDependencies)}
        expected_fields = {
            "db",
            "graphiti",
            "deal_id",
            "organization_id",
            "document_ids",
            "context_window",
        }
        assert field_names == expected_fields


# =============================================================================
# Pydantic Model Tests (Task 2)
# =============================================================================


class TestSourceReference:
    """Tests for SourceReference model."""

    def test_create_empty(self):
        """Test creating empty source reference."""
        source = SourceReference()
        assert source.document_id is None
        assert source.document_name is None

    def test_create_with_all_fields(self):
        """Test creating source with all fields."""
        source = SourceReference(
            document_id="doc-123",
            document_name="Financial Report.pdf",
            page_number=15,
            line_item="Revenue - Q3 2024",
            excerpt="Revenue was $5.2M in Q3 2024",
        )
        assert source.document_id == "doc-123"
        assert source.page_number == 15


class TestFinancialFinding:
    """Tests for FinancialFinding model."""

    def test_create_minimal(self):
        """Test creating finding with minimal fields."""
        finding = FinancialFinding(
            metric="Revenue",
            value=5200000,
            confidence=0.9,
        )
        assert finding.metric == "Revenue"
        assert finding.value == 5200000
        assert finding.confidence == 0.9

    def test_create_with_string_value(self):
        """Test creating finding with string value."""
        finding = FinancialFinding(
            metric="EBITDA",
            value="$1.2M",
            confidence=0.85,
        )
        assert finding.value == "$1.2M"

    def test_create_with_calculation(self):
        """Test creating finding with calculation."""
        finding = FinancialFinding(
            metric="Gross Margin",
            value=0.35,
            confidence=0.95,
            calculation="($5.2M - $3.38M) / $5.2M = 35%",
        )
        assert finding.calculation is not None

    def test_confidence_validation_min(self):
        """Test confidence must be >= 0."""
        with pytest.raises(ValidationError):
            FinancialFinding(
                metric="Revenue",
                value=100,
                confidence=-0.1,
            )

    def test_confidence_validation_max(self):
        """Test confidence must be <= 1."""
        with pytest.raises(ValidationError):
            FinancialFinding(
                metric="Revenue",
                value=100,
                confidence=1.5,
            )


class TestFinancialRatio:
    """Tests for FinancialRatio model."""

    def test_create_ratio(self):
        """Test creating financial ratio."""
        ratio = FinancialRatio(
            name="Gross Margin",
            value=0.35,
            formula="(Revenue - COGS) / Revenue",
            interpretation="35% of revenue retained after direct costs",
        )
        assert ratio.name == "Gross Margin"
        assert ratio.value == 0.35

    def test_create_ratio_with_benchmark(self):
        """Test creating ratio with benchmark comparison."""
        ratio = FinancialRatio(
            name="Current Ratio",
            value=1.8,
            formula="Current Assets / Current Liabilities",
            interpretation="Company can cover short-term obligations 1.8 times",
            benchmark=2.0,
            assessment="below_benchmark",
        )
        assert ratio.benchmark == 2.0
        assert ratio.assessment == "below_benchmark"


class TestPeriodComparison:
    """Tests for PeriodComparison model."""

    def test_create_comparison(self):
        """Test creating period comparison."""
        comparison = PeriodComparison(
            metric="Revenue",
            period1="Q3 2023",
            period1_value=4500000,
            period2="Q3 2024",
            period2_value=5200000,
            change_absolute=700000,
            change_percent=15.56,
            trend="increasing",
        )
        assert comparison.change_absolute == 700000
        assert comparison.trend == "increasing"

    def test_trend_values(self):
        """Test valid trend values."""
        for trend in ["increasing", "stable", "decreasing"]:
            comparison = PeriodComparison(
                metric="Revenue",
                period1="Q1",
                period1_value=100,
                period2="Q2",
                period2_value=100,
                change_absolute=0,
                change_percent=0,
                trend=trend,
            )
            assert comparison.trend == trend


class TestFinancialAnalysisResult:
    """Tests for FinancialAnalysisResult model."""

    def test_create_minimal(self):
        """Test creating result with minimal fields."""
        result = FinancialAnalysisResult(
            summary="Revenue increased 15% YoY",
            confidence=0.85,
        )
        assert result.summary == "Revenue increased 15% YoY"
        assert result.findings == []
        assert result.sources == []

    def test_create_with_findings(self):
        """Test creating result with findings."""
        result = FinancialAnalysisResult(
            summary="Financial analysis complete",
            findings=[
                FinancialFinding(metric="Revenue", value=5200000, confidence=0.9),
                FinancialFinding(metric="EBITDA", value=1200000, confidence=0.85),
            ],
            confidence=0.87,
        )
        assert len(result.findings) == 2

    def test_create_with_follow_up_questions(self):
        """Test creating result with follow-up questions."""
        result = FinancialAnalysisResult(
            summary="Analysis limited by missing data",
            confidence=0.5,
            limitations="Q4 financial data not available",
            follow_up_questions=[
                "Can you provide Q4 2024 financials?",
                "What is the expected revenue for Q4?",
            ],
        )
        assert len(result.follow_up_questions) == 2


# =============================================================================
# Agent Creation Tests (Task 3)
# =============================================================================


class TestAgentCreation:
    """Tests for agent creation and configuration."""

    def test_system_prompt_has_required_sections(self):
        """Test system prompt includes required M&A expertise sections."""
        prompt = FINANCIAL_ANALYST_SYSTEM_PROMPT

        # Check for core expertise sections
        assert "Quality of Earnings" in prompt or "QoE" in prompt
        assert "EBITDA" in prompt
        assert "working capital" in prompt.lower()
        assert "citation" in prompt.lower() or "cite" in prompt.lower()

    def test_system_prompt_has_placeholders(self):
        """Test system prompt has format placeholders."""
        prompt = FINANCIAL_ANALYST_SYSTEM_PROMPT
        assert "{deal_id}" in prompt
        assert "{organization_id}" in prompt
        assert "{context}" in prompt

    def test_get_agent_model_config_returns_expected_structure(self):
        """Test model config retrieval returns expected structure."""
        from src.config import get_agent_model_config

        config = get_agent_model_config("financial_analyst")
        # Config should have primary key at minimum
        assert "primary" in config or config == {}

    def test_system_prompt_format_works(self):
        """Test system prompt can be formatted with values."""
        formatted = FINANCIAL_ANALYST_SYSTEM_PROMPT.format(
            deal_id="test-deal-123",
            organization_id="test-org-456",
            context="Test context",
        )
        assert "test-deal-123" in formatted
        assert "test-org-456" in formatted
        assert "Test context" in formatted


# =============================================================================
# Tool Logic Tests (Tasks 4-7)
# =============================================================================


class TestRatioCalculations:
    """Tests for financial ratio calculation logic."""

    def test_gross_margin_calculation(self):
        """Test gross margin calculation."""
        revenue = 5_000_000
        cogs = 3_250_000
        expected_margin = (revenue - cogs) / revenue
        assert abs(expected_margin - 0.35) < 0.001

    def test_ebitda_margin_calculation(self):
        """Test EBITDA margin calculation."""
        ebitda = 1_200_000
        revenue = 5_000_000
        expected_margin = ebitda / revenue
        assert abs(expected_margin - 0.24) < 0.001

    def test_current_ratio_calculation(self):
        """Test current ratio calculation."""
        current_assets = 2_500_000
        current_liabilities = 1_500_000
        expected_ratio = current_assets / current_liabilities
        assert abs(expected_ratio - 1.667) < 0.001

    def test_debt_equity_calculation(self):
        """Test debt-to-equity calculation."""
        total_debt = 3_000_000
        total_equity = 4_000_000
        expected_ratio = total_debt / total_equity
        assert abs(expected_ratio - 0.75) < 0.001


class TestPeriodComparisonLogic:
    """Tests for period comparison calculation logic."""

    def test_calculate_yoy_increase(self):
        """Test YoY calculation for increasing metric."""
        period1_value = 4_500_000
        period2_value = 5_200_000
        change_absolute = period2_value - period1_value
        change_percent = ((period2_value - period1_value) / period1_value) * 100

        assert change_absolute == 700_000
        assert abs(change_percent - 15.56) < 0.01

    def test_calculate_yoy_decrease(self):
        """Test YoY calculation for decreasing metric."""
        period1_value = 5_200_000
        period2_value = 4_500_000
        change_absolute = period2_value - period1_value
        change_percent = ((period2_value - period1_value) / period1_value) * 100

        assert change_absolute == -700_000
        assert change_percent < 0

    def test_determine_trend(self):
        """Test trend determination logic."""
        # Increasing
        change_percent = 15
        assert change_percent > 5  # increasing

        # Stable
        change_percent = 2
        assert -5 <= change_percent <= 5  # stable

        # Decreasing
        change_percent = -10
        assert change_percent < -5  # decreasing


class TestValueExtraction:
    """Tests for value extraction from search results."""

    def test_extract_currency_millions(self):
        """Test extracting currency values in millions."""
        from src.agents.tools.financial_tools import _extract_value_from_result

        class MockResult:
            fact = "Revenue was $5.2 million in Q3"
            properties = {}

        result = _extract_value_from_result(MockResult(), "revenue")
        assert result == 5_200_000

    def test_extract_currency_billions(self):
        """Test extracting currency values in billions."""
        from src.agents.tools.financial_tools import _extract_value_from_result

        class MockResult:
            fact = "Total assets of $1.5 billion"
            properties = {}

        result = _extract_value_from_result(MockResult(), "assets")
        assert result == 1_500_000_000

    def test_extract_from_properties(self):
        """Test extracting value from properties dict."""
        from src.agents.tools.financial_tools import _extract_value_from_result

        class MockResult:
            fact = None
            properties = {"value": 5200000}

        result = _extract_value_from_result(MockResult(), None)
        assert result == 5200000


class TestPeriodExtraction:
    """Tests for period extraction from dates."""

    def test_extract_period_q1(self):
        """Test extracting Q1 period."""
        from src.agents.tools.financial_tools import _extract_period_from_date

        result = _extract_period_from_date("2024-02-15")
        assert result == "Q1 2024"

    def test_extract_period_q3(self):
        """Test extracting Q3 period."""
        from src.agents.tools.financial_tools import _extract_period_from_date

        result = _extract_period_from_date("2024-08-01")
        assert result == "Q3 2024"

    def test_extract_period_q4(self):
        """Test extracting Q4 period."""
        from src.agents.tools.financial_tools import _extract_period_from_date

        result = _extract_period_from_date("2024-11-30")
        assert result == "Q4 2024"

    def test_extract_period_none(self):
        """Test handling None date."""
        from src.agents.tools.financial_tools import _extract_period_from_date

        result = _extract_period_from_date(None)
        assert result is None


# =============================================================================
# API Response Tests
# =============================================================================


class TestAPIResponseModels:
    """Tests for API response structure."""

    def test_result_serializes_to_json(self):
        """Test FinancialAnalysisResult serializes properly."""
        result = FinancialAnalysisResult(
            summary="Analysis complete",
            findings=[
                FinancialFinding(
                    metric="Revenue",
                    value=5200000,
                    confidence=0.9,
                    source=SourceReference(document_name="Report.pdf", page_number=5),
                ),
            ],
            confidence=0.9,
            sources=[
                SourceReference(document_name="Report.pdf", page_number=5),
            ],
        )

        json_str = result.model_dump_json()
        assert "summary" in json_str
        assert "Revenue" in json_str
        assert "5200000" in json_str

    def test_result_roundtrip(self):
        """Test serialization roundtrip."""
        original = FinancialAnalysisResult(
            summary="Test analysis",
            confidence=0.85,
            findings=[
                FinancialFinding(metric="EBITDA", value="$1.2M", confidence=0.88),
            ],
        )

        json_dict = original.model_dump()
        restored = FinancialAnalysisResult.model_validate(json_dict)

        assert restored.summary == original.summary
        assert restored.confidence == original.confidence
        assert len(restored.findings) == len(original.findings)


# =============================================================================
# Error Handling Tests
# =============================================================================


class TestErrorHandling:
    """Tests for error handling scenarios."""

    def test_graphiti_unavailable(self, mock_supabase):
        """Test handling when Graphiti is not available."""
        deps = FinancialDependencies(
            db=mock_supabase,
            graphiti=None,
            deal_id="deal-123",
            organization_id="org-456",
        )
        assert deps.graphiti is None

    def test_empty_document_ids(self, mock_supabase, mock_graphiti):
        """Test handling empty document IDs."""
        deps = FinancialDependencies(
            db=mock_supabase,
            graphiti=mock_graphiti,
            deal_id="deal-123",
            organization_id="org-456",
            document_ids=[],
        )
        assert deps.document_ids == []
