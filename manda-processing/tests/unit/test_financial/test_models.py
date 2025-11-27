"""
Tests for financial metrics Pydantic models.
Story: E3.9 - Financial Model Integration (AC: #1)
"""

import pytest
from decimal import Decimal
from datetime import date, datetime
from uuid import uuid4

from src.models.financial_metrics import (
    MetricCategory,
    PeriodType,
    FinancialMetricBase,
    FinancialMetricCreate,
    FinancialMetric,
    FinancialMetricResponse,
    FinancialExtractionResult,
    FinancialMetricsQueryParams,
    FinancialMetricsListResponse,
    METRIC_NORMALIZATION,
    normalize_metric,
)


class TestMetricCategory:
    """Tests for MetricCategory enum."""

    def test_income_statement(self):
        assert MetricCategory.INCOME_STATEMENT == "income_statement"

    def test_balance_sheet(self):
        assert MetricCategory.BALANCE_SHEET == "balance_sheet"

    def test_cash_flow(self):
        assert MetricCategory.CASH_FLOW == "cash_flow"

    def test_ratio(self):
        assert MetricCategory.RATIO == "ratio"


class TestPeriodType:
    """Tests for PeriodType enum."""

    def test_annual(self):
        assert PeriodType.ANNUAL == "annual"

    def test_quarterly(self):
        assert PeriodType.QUARTERLY == "quarterly"

    def test_monthly(self):
        assert PeriodType.MONTHLY == "monthly"

    def test_ytd(self):
        assert PeriodType.YTD == "ytd"


class TestFinancialMetricBase:
    """Tests for FinancialMetricBase model."""

    def test_create_minimal(self):
        """Test creating metric with minimal required fields."""
        metric = FinancialMetricBase(
            metric_name="revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
        )

        assert metric.metric_name == "revenue"
        assert metric.metric_category == MetricCategory.INCOME_STATEMENT
        assert metric.value is None
        assert metric.is_actual is True

    def test_create_full(self):
        """Test creating metric with all fields."""
        metric = FinancialMetricBase(
            metric_name="Revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
            value=Decimal("1000000"),
            unit="USD",
            period_type=PeriodType.ANNUAL,
            period_start=date(2023, 1, 1),
            period_end=date(2023, 12, 31),
            fiscal_year=2023,
            fiscal_quarter=None,
            source_cell="B5",
            source_sheet="P&L",
            source_page=1,
            source_formula="=SUM(B3:B4)",
            is_actual=True,
            confidence_score=85.5,
            notes="Annual revenue",
            metadata={"currency_code": "USD"},
        )

        assert metric.metric_name == "revenue"  # Should be normalized
        assert metric.value == Decimal("1000000")
        assert metric.unit == "USD"
        assert metric.fiscal_year == 2023
        assert metric.confidence_score == 85.5

    def test_metric_name_normalization(self):
        """Test that metric names are normalized."""
        metric = FinancialMetricBase(
            metric_name="Net Revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
        )

        assert metric.metric_name == "net_revenue"

    def test_confidence_score_validation(self):
        """Test confidence score validation."""
        # Valid confidence
        metric = FinancialMetricBase(
            metric_name="revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
            confidence_score=75.0,
        )
        assert metric.confidence_score == 75.0

        # Confidence is rounded to 2 decimal places
        metric2 = FinancialMetricBase(
            metric_name="revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
            confidence_score=75.555,
        )
        assert metric2.confidence_score == 75.56

    def test_confidence_score_out_of_range(self):
        """Test that invalid confidence scores raise error."""
        with pytest.raises(ValueError):
            FinancialMetricBase(
                metric_name="revenue",
                metric_category=MetricCategory.INCOME_STATEMENT,
                confidence_score=150.0,  # Invalid: > 100
            )

    def test_fiscal_quarter_validation(self):
        """Test fiscal quarter validation."""
        # Valid quarter
        metric = FinancialMetricBase(
            metric_name="revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
            fiscal_quarter=4,
        )
        assert metric.fiscal_quarter == 4

        # Invalid quarter should fail validation
        with pytest.raises(ValueError):
            FinancialMetricBase(
                metric_name="revenue",
                metric_category=MetricCategory.INCOME_STATEMENT,
                fiscal_quarter=5,  # Invalid: > 4
            )


class TestFinancialMetricCreate:
    """Tests for FinancialMetricCreate model."""

    def test_create_with_document_id(self):
        """Test creating metric with document ID."""
        doc_id = uuid4()
        metric = FinancialMetricCreate(
            document_id=doc_id,
            metric_name="ebitda",
            metric_category=MetricCategory.INCOME_STATEMENT,
            value=Decimal("250000"),
        )

        assert metric.document_id == doc_id
        assert metric.metric_name == "ebitda"

    def test_create_with_finding_id(self):
        """Test creating metric with finding ID."""
        doc_id = uuid4()
        finding_id = uuid4()

        metric = FinancialMetricCreate(
            document_id=doc_id,
            finding_id=finding_id,
            metric_name="revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
        )

        assert metric.finding_id == finding_id


class TestFinancialMetric:
    """Tests for FinancialMetric model."""

    def test_create_full_metric(self):
        """Test creating full metric with ID and timestamps."""
        metric = FinancialMetric(
            id=uuid4(),
            document_id=uuid4(),
            metric_name="revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
            value=Decimal("1000000"),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        assert metric.id is not None
        assert metric.created_at is not None


class TestFinancialExtractionResult:
    """Tests for FinancialExtractionResult model."""

    def test_create_empty_result(self):
        """Test creating result with no metrics."""
        result = FinancialExtractionResult(
            document_id=uuid4(),
        )

        assert result.metrics == []
        assert result.metrics_count == 0
        assert result.success is True
        assert result.has_financial_data is False

    def test_create_result_with_metrics(self):
        """Test creating result with metrics."""
        doc_id = uuid4()
        metric = FinancialMetricCreate(
            document_id=doc_id,
            metric_name="revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
            value=Decimal("1000000"),
        )

        result = FinancialExtractionResult(
            document_id=doc_id,
            metrics=[metric],
            has_financial_data=True,
            detection_confidence=85.0,
            document_type="income_statement",
        )

        assert result.metrics_count == 1
        assert result.success is True

    def test_result_with_errors(self):
        """Test that errors affect success status."""
        result = FinancialExtractionResult(
            document_id=uuid4(),
            errors=["Extraction failed"],
        )

        assert result.success is False


class TestFinancialMetricsQueryParams:
    """Tests for FinancialMetricsQueryParams model."""

    def test_default_values(self):
        """Test default query parameter values."""
        params = FinancialMetricsQueryParams()

        assert params.limit == 100
        assert params.offset == 0
        assert params.project_id is None
        assert params.metric_name is None

    def test_with_filters(self):
        """Test query params with filters."""
        project_id = uuid4()
        params = FinancialMetricsQueryParams(
            project_id=project_id,
            metric_name="revenue",
            metric_category=MetricCategory.INCOME_STATEMENT,
            fiscal_year=2023,
            is_actual=True,
            limit=50,
            offset=10,
        )

        assert params.project_id == project_id
        assert params.metric_name == "revenue"
        assert params.fiscal_year == 2023


class TestFinancialMetricsListResponse:
    """Tests for FinancialMetricsListResponse model."""

    def test_empty_response(self):
        """Test empty list response."""
        response = FinancialMetricsListResponse(
            metrics=[],
            total=0,
            limit=100,
            offset=0,
        )

        assert len(response.metrics) == 0
        assert response.total == 0


class TestNormalizeMetric:
    """Tests for normalize_metric function."""

    def test_normalize_revenue(self):
        """Test normalizing revenue variations."""
        name, category = normalize_metric("revenue")
        assert name == "revenue"
        assert category == MetricCategory.INCOME_STATEMENT

        name, category = normalize_metric("sales")
        assert name == "revenue"
        assert category == MetricCategory.INCOME_STATEMENT

        name, category = normalize_metric("Net Sales")
        assert name == "revenue"
        assert category == MetricCategory.INCOME_STATEMENT

    def test_normalize_ebitda(self):
        """Test normalizing EBITDA variations."""
        name, category = normalize_metric("ebitda")
        assert name == "ebitda"
        assert category == MetricCategory.INCOME_STATEMENT

        name, category = normalize_metric("EBITDA")
        assert name == "ebitda"
        assert category == MetricCategory.INCOME_STATEMENT

    def test_normalize_balance_sheet_items(self):
        """Test normalizing balance sheet items."""
        name, category = normalize_metric("total assets")
        assert name == "total_assets"
        assert category == MetricCategory.BALANCE_SHEET

        name, category = normalize_metric("shareholders equity")
        assert name == "equity"
        assert category == MetricCategory.BALANCE_SHEET

    def test_normalize_cash_flow_items(self):
        """Test normalizing cash flow items."""
        name, category = normalize_metric("free cash flow")
        assert name == "free_cash_flow"
        assert category == MetricCategory.CASH_FLOW

        name, category = normalize_metric("capex")
        assert name == "capex"
        assert category == MetricCategory.CASH_FLOW

    def test_normalize_ratios(self):
        """Test normalizing ratio metrics."""
        name, category = normalize_metric("gross margin")
        assert name == "gross_margin"
        assert category == MetricCategory.RATIO

    def test_normalize_unknown(self):
        """Test normalizing unknown metric names."""
        name, category = normalize_metric("custom metric xyz")
        assert name == "custom_metric_xyz"
        # Category should be guessed based on keywords

    def test_normalize_german(self):
        """Test normalizing German metric names."""
        name, category = normalize_metric("Umsatz")
        assert name == "revenue"
        assert category == MetricCategory.INCOME_STATEMENT

        name, category = normalize_metric("Eigenkapital")
        assert name == "equity"
        assert category == MetricCategory.BALANCE_SHEET


class TestMetricNormalizationMapping:
    """Tests for METRIC_NORMALIZATION constant."""

    def test_revenue_mappings_exist(self):
        """Test that revenue mappings exist."""
        assert "revenue" in METRIC_NORMALIZATION
        assert "sales" in METRIC_NORMALIZATION

    def test_german_mappings_exist(self):
        """Test that German mappings exist."""
        assert "umsatz" in METRIC_NORMALIZATION
        assert "eigenkapital" in METRIC_NORMALIZATION
