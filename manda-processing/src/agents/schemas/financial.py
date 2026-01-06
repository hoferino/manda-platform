"""
Pydantic models for financial analysis structured outputs.
Story: E13.5 - Financial Analyst Specialist Agent (AC: #1, #3)

These models guarantee validated, typed responses from the Financial Analyst agent.
Using Pydantic models as result_type ensures the LLM output matches the schema.
"""

from typing import Literal, Optional, Union

from pydantic import BaseModel, Field


class SourceReference(BaseModel):
    """
    Reference to the source of a financial finding.

    Provides traceability back to the original document and location.
    """

    document_id: Optional[str] = Field(
        default=None,
        description="UUID of the source document",
    )
    document_name: Optional[str] = Field(
        default=None,
        description="Human-readable name of the source document",
    )
    page_number: Optional[int] = Field(
        default=None,
        description="Page number where the data was found",
    )
    line_item: Optional[str] = Field(
        default=None,
        description="Specific line item or cell reference (e.g., 'Revenue - Q3 2024')",
    )
    excerpt: Optional[str] = Field(
        default=None,
        description="Brief excerpt from the source text",
    )


class FinancialFinding(BaseModel):
    """
    A single financial finding extracted from analysis.

    Represents a specific metric, calculation, or insight with full provenance.
    """

    metric: str = Field(
        description="Name of the financial metric (e.g., 'EBITDA', 'Revenue', 'Gross Margin')",
    )
    value: Union[str, float, int] = Field(
        description="The metric value - can be numeric or formatted string (e.g., '$5.2M')",
    )
    period: Optional[str] = Field(
        default=None,
        description="Time period for this metric (e.g., 'Q3 2024', 'FY2023')",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score from 0.0 to 1.0 based on data quality",
    )
    source: SourceReference = Field(
        default_factory=SourceReference,
        description="Reference to where this finding was extracted from",
    )
    calculation: Optional[str] = Field(
        default=None,
        description="Calculation formula if derived (e.g., 'Revenue ($5.2M) × Margin (35%) = $1.82M')",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Additional context or caveats about this finding",
    )


class FinancialRatio(BaseModel):
    """
    A calculated financial ratio with interpretation.

    Used for ratio analysis like margins, leverage, and liquidity metrics.
    """

    name: str = Field(
        description="Name of the ratio (e.g., 'Gross Margin', 'Current Ratio', 'Debt-to-Equity')",
    )
    value: float = Field(
        description="Calculated ratio value",
    )
    formula: str = Field(
        description="Formula used to calculate the ratio (e.g., '(Revenue - COGS) / Revenue')",
    )
    interpretation: str = Field(
        description="Plain-English interpretation of what this ratio means",
    )
    period: Optional[str] = Field(
        default=None,
        description="Time period for the ratio calculation",
    )
    benchmark: Optional[float] = Field(
        default=None,
        description="Industry benchmark value for comparison",
    )
    assessment: Optional[Literal["above_benchmark", "at_benchmark", "below_benchmark"]] = Field(
        default=None,
        description="Assessment relative to benchmark",
    )


class PeriodComparison(BaseModel):
    """
    Comparison of a metric across two time periods.

    Used for YoY, QoQ, and other temporal comparisons.
    """

    metric: str = Field(
        description="Name of the metric being compared",
    )
    period1: str = Field(
        description="Earlier period label (e.g., 'Q3 2023')",
    )
    period1_value: float = Field(
        description="Metric value for the earlier period",
    )
    period2: str = Field(
        description="Later period label (e.g., 'Q3 2024')",
    )
    period2_value: float = Field(
        description="Metric value for the later period",
    )
    change_absolute: float = Field(
        description="Absolute change (period2_value - period1_value)",
    )
    change_percent: float = Field(
        description="Percentage change ((period2 - period1) / period1 * 100)",
    )
    trend: Literal["increasing", "stable", "decreasing"] = Field(
        description="Direction of the trend",
    )
    assessment: Optional[str] = Field(
        default=None,
        description="Qualitative assessment of the change",
    )


class FinancialAnalysisResult(BaseModel):
    """
    Complete result from financial analysis.

    This is the result_type for the Financial Analyst agent, ensuring
    all responses have consistent structure.
    """

    summary: str = Field(
        description="Executive summary answering the user's query directly",
    )
    findings: list[FinancialFinding] = Field(
        default_factory=list,
        description="List of specific financial findings supporting the summary",
    )
    ratios: list[FinancialRatio] = Field(
        default_factory=list,
        description="Calculated financial ratios if applicable",
    )
    comparisons: list[PeriodComparison] = Field(
        default_factory=list,
        description="Period-over-period comparisons if applicable",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall confidence in the analysis based on data completeness",
    )
    sources: list[SourceReference] = Field(
        default_factory=list,
        description="All sources referenced in this analysis",
    )
    limitations: Optional[str] = Field(
        default=None,
        description="Data limitations or caveats that affect the analysis",
    )
    follow_up_questions: list[str] = Field(
        default_factory=list,
        description="Suggested follow-up questions if data was insufficient",
    )


__all__ = [
    "SourceReference",
    "FinancialFinding",
    "FinancialRatio",
    "PeriodComparison",
    "FinancialAnalysisResult",
]
