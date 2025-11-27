"""
Pydantic models for financial metrics extracted from documents.
Story: E3.9 - Financial Model Integration (AC: #1, #3, #4)

This module provides:
- FinancialMetric model with all required fields matching DB schema
- MetricCategory and PeriodType enums
- Source attribution fields for Excel and PDF sources
- Extraction result models for API responses
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MetricCategory(str, Enum):
    """Category classification for financial metrics."""

    INCOME_STATEMENT = "income_statement"  # Revenue, COGS, gross profit, EBITDA, net income
    BALANCE_SHEET = "balance_sheet"  # Assets, liabilities, equity, working capital
    CASH_FLOW = "cash_flow"  # Operating cash flow, CapEx, free cash flow
    RATIO = "ratio"  # Margins, multiples, coverage ratios


class PeriodType(str, Enum):
    """Time period classification for financial metrics."""

    ANNUAL = "annual"  # Full fiscal year
    QUARTERLY = "quarterly"  # Q1, Q2, Q3, Q4
    MONTHLY = "monthly"  # Individual month
    YTD = "ytd"  # Year to date


class FinancialMetricBase(BaseModel):
    """Base model for financial metrics (shared fields for create/read)."""

    # Metric identification
    metric_name: str = Field(..., min_length=1, description="Normalized metric name (e.g., 'revenue', 'ebitda')")
    metric_category: MetricCategory = Field(..., description="Category classification")

    # Value and unit
    value: Optional[Decimal] = Field(None, description="Numeric value of the metric")
    unit: Optional[str] = Field(None, description="Unit of measurement (e.g., 'USD', 'EUR', '%')")

    # Period information
    period_type: Optional[PeriodType] = Field(None, description="Type of time period")
    period_start: Optional[date] = Field(None, description="Start of the period")
    period_end: Optional[date] = Field(None, description="End of the period")
    fiscal_year: Optional[int] = Field(None, ge=1900, le=2100, description="Fiscal year")
    fiscal_quarter: Optional[int] = Field(None, ge=1, le=4, description="Fiscal quarter (1-4)")

    # Source attribution
    source_cell: Optional[str] = Field(None, description="Excel cell reference (e.g., 'B15')")
    source_sheet: Optional[str] = Field(None, description="Excel sheet name")
    source_page: Optional[int] = Field(None, ge=1, description="PDF page number")
    source_table_index: Optional[int] = Field(None, ge=0, description="Table index on PDF page")
    source_formula: Optional[str] = Field(None, description="Original Excel formula")

    # Classification
    is_actual: bool = Field(True, description="True for actuals, False for projections")
    confidence_score: Optional[float] = Field(
        None, ge=0, le=100, description="Extraction confidence (0-100)"
    )

    # Additional metadata
    notes: Optional[str] = Field(None, description="Additional notes about the metric")
    metadata: dict = Field(default_factory=dict, description="Additional metadata")

    @field_validator("confidence_score")
    @classmethod
    def validate_confidence(cls, v: Optional[float]) -> Optional[float]:
        """Ensure confidence score is in valid range."""
        if v is not None:
            if not 0 <= v <= 100:
                raise ValueError("confidence_score must be between 0 and 100")
            return round(v, 2)
        return v

    @field_validator("metric_name")
    @classmethod
    def normalize_metric_name(cls, v: str) -> str:
        """Normalize metric name to lowercase with underscores."""
        return v.lower().replace(" ", "_").replace("-", "_")


class FinancialMetricCreate(FinancialMetricBase):
    """Schema for creating a new financial metric."""

    document_id: UUID = Field(..., description="Source document ID")
    finding_id: Optional[UUID] = Field(None, description="Related finding ID (if applicable)")


class FinancialMetric(FinancialMetricCreate):
    """Full financial metric model including IDs and timestamps."""

    id: UUID = Field(..., description="Unique metric ID")
    created_at: datetime = Field(
        default_factory=datetime.utcnow, description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow, description="Last update timestamp"
    )


class FinancialMetricResponse(BaseModel):
    """API response model for a single financial metric."""

    id: UUID
    document_id: UUID
    finding_id: Optional[UUID] = None
    metric_name: str
    metric_category: str
    value: Optional[Decimal] = None
    unit: Optional[str] = None
    period_type: Optional[str] = None
    fiscal_year: Optional[int] = None
    fiscal_quarter: Optional[int] = None
    source_cell: Optional[str] = None
    source_sheet: Optional[str] = None
    source_page: Optional[int] = None
    source_formula: Optional[str] = None
    is_actual: bool = True
    confidence_score: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime


class FinancialExtractionResult(BaseModel):
    """Result of extracting financial metrics from a document."""

    document_id: UUID = Field(..., description="Source document ID")
    metrics: list[FinancialMetricCreate] = Field(
        default_factory=list, description="Extracted metrics"
    )
    has_financial_data: bool = Field(
        False, description="Whether document contains financial data"
    )
    detection_confidence: float = Field(
        0.0, ge=0, le=100, description="Confidence that document contains financial data"
    )
    document_type: Optional[str] = Field(
        None, description="Detected financial document type (e.g., 'income_statement', 'annual_report')"
    )
    processing_time_ms: int = Field(0, description="Processing time in milliseconds")
    errors: list[str] = Field(default_factory=list, description="Extraction errors")
    warnings: list[str] = Field(default_factory=list, description="Extraction warnings")

    @property
    def metrics_count(self) -> int:
        """Number of metrics extracted."""
        return len(self.metrics)

    @property
    def success(self) -> bool:
        """Whether extraction was successful (no errors)."""
        return len(self.errors) == 0


class FinancialMetricsQueryParams(BaseModel):
    """Query parameters for financial metrics API."""

    project_id: Optional[UUID] = Field(None, description="Filter by project")
    document_id: Optional[UUID] = Field(None, description="Filter by document")
    metric_name: Optional[str] = Field(None, description="Filter by metric name")
    metric_category: Optional[MetricCategory] = Field(None, description="Filter by category")
    fiscal_year: Optional[int] = Field(None, description="Filter by fiscal year")
    is_actual: Optional[bool] = Field(None, description="Filter by actual/projection")
    limit: int = Field(100, ge=1, le=1000, description="Maximum results")
    offset: int = Field(0, ge=0, description="Pagination offset")


class FinancialMetricsListResponse(BaseModel):
    """API response for listing financial metrics."""

    metrics: list[FinancialMetricResponse]
    total: int
    limit: int
    offset: int


# Mapping of common metric names to their normalized forms and categories
METRIC_NORMALIZATION = {
    # Revenue
    "revenue": ("revenue", MetricCategory.INCOME_STATEMENT),
    "sales": ("revenue", MetricCategory.INCOME_STATEMENT),
    "net sales": ("revenue", MetricCategory.INCOME_STATEMENT),
    "total revenue": ("revenue", MetricCategory.INCOME_STATEMENT),
    "umsatz": ("revenue", MetricCategory.INCOME_STATEMENT),
    "erlöse": ("revenue", MetricCategory.INCOME_STATEMENT),
    # EBITDA
    "ebitda": ("ebitda", MetricCategory.INCOME_STATEMENT),
    "operating profit": ("ebitda", MetricCategory.INCOME_STATEMENT),
    "operating income": ("ebitda", MetricCategory.INCOME_STATEMENT),
    "betriebsergebnis": ("ebitda", MetricCategory.INCOME_STATEMENT),
    "ebit": ("ebit", MetricCategory.INCOME_STATEMENT),
    # Gross profit
    "gross profit": ("gross_profit", MetricCategory.INCOME_STATEMENT),
    "gross margin amount": ("gross_profit", MetricCategory.INCOME_STATEMENT),
    "bruttogewinn": ("gross_profit", MetricCategory.INCOME_STATEMENT),
    # Net income
    "net income": ("net_income", MetricCategory.INCOME_STATEMENT),
    "net profit": ("net_income", MetricCategory.INCOME_STATEMENT),
    "bottom line": ("net_income", MetricCategory.INCOME_STATEMENT),
    "jahresüberschuss": ("net_income", MetricCategory.INCOME_STATEMENT),
    "gewinn": ("net_income", MetricCategory.INCOME_STATEMENT),
    # COGS
    "cogs": ("cogs", MetricCategory.INCOME_STATEMENT),
    "cost of goods sold": ("cogs", MetricCategory.INCOME_STATEMENT),
    "cost of sales": ("cogs", MetricCategory.INCOME_STATEMENT),
    "herstellungskosten": ("cogs", MetricCategory.INCOME_STATEMENT),
    # Balance sheet
    "total assets": ("total_assets", MetricCategory.BALANCE_SHEET),
    "assets total": ("total_assets", MetricCategory.BALANCE_SHEET),
    "bilanzsumme": ("total_assets", MetricCategory.BALANCE_SHEET),
    "total liabilities": ("total_liabilities", MetricCategory.BALANCE_SHEET),
    "liabilities total": ("total_liabilities", MetricCategory.BALANCE_SHEET),
    "verbindlichkeiten": ("total_liabilities", MetricCategory.BALANCE_SHEET),
    "equity": ("equity", MetricCategory.BALANCE_SHEET),
    "shareholders equity": ("equity", MetricCategory.BALANCE_SHEET),
    "eigenkapital": ("equity", MetricCategory.BALANCE_SHEET),
    "working capital": ("working_capital", MetricCategory.BALANCE_SHEET),
    # Cash flow
    "cash flow from operations": ("operating_cash_flow", MetricCategory.CASH_FLOW),
    "operating cash flow": ("operating_cash_flow", MetricCategory.CASH_FLOW),
    "operativer cashflow": ("operating_cash_flow", MetricCategory.CASH_FLOW),
    "free cash flow": ("free_cash_flow", MetricCategory.CASH_FLOW),
    "fcf": ("free_cash_flow", MetricCategory.CASH_FLOW),
    "capex": ("capex", MetricCategory.CASH_FLOW),
    "capital expenditure": ("capex", MetricCategory.CASH_FLOW),
    "investitionen": ("capex", MetricCategory.CASH_FLOW),
    # Ratios
    "gross margin": ("gross_margin", MetricCategory.RATIO),
    "bruttomarge": ("gross_margin", MetricCategory.RATIO),
    "net margin": ("net_margin", MetricCategory.RATIO),
    "nettomarge": ("net_margin", MetricCategory.RATIO),
    "ebitda margin": ("ebitda_margin", MetricCategory.RATIO),
    "operating margin": ("operating_margin", MetricCategory.RATIO),
    "debt to equity": ("debt_to_equity", MetricCategory.RATIO),
    "current ratio": ("current_ratio", MetricCategory.RATIO),
}


def normalize_metric(raw_name: str) -> tuple[str, MetricCategory]:
    """
    Normalize a metric name and determine its category.

    Args:
        raw_name: Raw metric name from extraction

    Returns:
        Tuple of (normalized_name, category)
    """
    name_lower = raw_name.lower().strip()

    # Check direct match
    if name_lower in METRIC_NORMALIZATION:
        return METRIC_NORMALIZATION[name_lower]

    # Check partial matches
    for pattern, (normalized, category) in METRIC_NORMALIZATION.items():
        if pattern in name_lower:
            return normalized, category

    # Default: use cleaned name with unknown categorization
    # Guess category based on keywords
    cleaned = name_lower.replace(" ", "_").replace("-", "_")

    if any(kw in name_lower for kw in ["margin", "ratio", "multiple", "rate"]):
        return cleaned, MetricCategory.RATIO
    elif any(kw in name_lower for kw in ["cash", "flow"]):
        return cleaned, MetricCategory.CASH_FLOW
    elif any(kw in name_lower for kw in ["asset", "liability", "equity", "debt"]):
        return cleaned, MetricCategory.BALANCE_SHEET
    else:
        return cleaned, MetricCategory.INCOME_STATEMENT


__all__ = [
    "MetricCategory",
    "PeriodType",
    "FinancialMetricBase",
    "FinancialMetricCreate",
    "FinancialMetric",
    "FinancialMetricResponse",
    "FinancialExtractionResult",
    "FinancialMetricsQueryParams",
    "FinancialMetricsListResponse",
    "METRIC_NORMALIZATION",
    "normalize_metric",
]
