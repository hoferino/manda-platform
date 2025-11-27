"""
Financial metric extraction from parsed documents.
Story: E3.9 - Financial Model Integration (AC: #1, #2, #3)

This module provides:
- FinancialMetricExtractor: Extract metrics from ParseResult
- Pattern-based metric identification (EN + DE)
- Period detection from headers
- Formula linking for Excel documents
- Source attribution for all extracted metrics
"""

import re
import time
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional
from uuid import UUID

import structlog

from src.parsers import ParseResult, TableData, FormulaData, ChunkData
from src.models.financial_metrics import (
    MetricCategory,
    PeriodType,
    FinancialMetricCreate,
    FinancialExtractionResult,
    normalize_metric,
)
from src.financial.detector import FinancialDocumentDetector, get_financial_detector

logger = structlog.get_logger(__name__)


# Metric identification patterns (regex)
METRIC_PATTERNS: dict[str, list[str]] = {
    # Income statement
    "revenue": [r"revenue", r"sales", r"net\s*sales", r"total\s*revenue", r"umsatz", r"erlöse"],
    "cogs": [r"cogs", r"cost\s*of\s*(?:goods\s*)?sold", r"cost\s*of\s*sales", r"herstellungskosten"],
    "gross_profit": [r"gross\s*profit", r"gross\s*margin\s*(?:amount)?", r"bruttogewinn", r"rohergebnis"],
    "operating_expenses": [r"operating\s*expenses?", r"opex", r"betriebsaufwand"],
    "ebitda": [r"ebitda", r"operating\s*(?:income|profit)\s*(?:before)?"],
    "ebit": [r"ebit", r"operating\s*(?:income|profit)", r"betriebsergebnis"],
    "net_income": [r"net\s*income", r"net\s*profit", r"bottom\s*line", r"jahresüberschuss", r"gewinn"],
    # Balance sheet
    "total_assets": [r"total\s*assets?", r"assets?\s*total", r"bilanzsumme"],
    "current_assets": [r"current\s*assets?", r"umlaufvermögen"],
    "fixed_assets": [r"fixed\s*assets?", r"non[\s-]*current\s*assets?", r"anlagevermögen"],
    "total_liabilities": [r"total\s*liabilit(?:y|ies)", r"liabilit(?:y|ies)\s*total", r"verbindlichkeiten"],
    "current_liabilities": [r"current\s*liabilit(?:y|ies)", r"kurzfristige\s*verbindlichkeiten"],
    "equity": [r"(?:shareholders?\'?)?\s*equity", r"eigenkapital", r"net\s*worth"],
    "working_capital": [r"working\s*capital", r"betriebskapital"],
    # Cash flow
    "operating_cash_flow": [r"(?:operating|cash\s*flow\s*from\s*operations?)\s*cash\s*flow", r"operativer?\s*cashflow"],
    "investing_cash_flow": [r"investing\s*(?:activities|cash\s*flow)", r"investitions\s*cashflow"],
    "financing_cash_flow": [r"financing\s*(?:activities|cash\s*flow)", r"finanzierungs\s*cashflow"],
    "free_cash_flow": [r"free\s*cash\s*flow", r"fcf"],
    "capex": [r"capex", r"capital\s*expenditure", r"investitionen"],
    # Ratios
    "gross_margin": [r"gross\s*margin", r"bruttomarge"],
    "net_margin": [r"net\s*(?:profit\s*)?margin", r"nettomarge"],
    "ebitda_margin": [r"ebitda\s*margin"],
    "operating_margin": [r"operating\s*margin", r"betriebliche\s*marge"],
}

# Period detection patterns
YEAR_PATTERN = re.compile(r"(?:FY|CY)?\s*(\d{4})\s*([AaEeFfPp])?", re.IGNORECASE)
QUARTER_PATTERN = re.compile(r"Q([1-4])\s*['\"]?(\d{2,4})?", re.IGNORECASE)
MONTH_PATTERN = re.compile(
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s*['\"]?(\d{2,4})?",
    re.IGNORECASE,
)

# Currency and unit patterns
CURRENCY_SYMBOLS = {"$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "CHF": "CHF"}
UNIT_PATTERNS = [
    (r"\(in\s*millions?\)", 1_000_000),
    (r"\(in\s*thousands?\)", 1_000),
    (r"\(in\s*billions?\)", 1_000_000_000),
    (r"(?:m|mn|mm)$", 1_000_000),
    (r"(?:k|K)$", 1_000),
    (r"(?:b|bn)$", 1_000_000_000),
]


@dataclass
class PeriodInfo:
    """Extracted period information."""

    period_type: Optional[PeriodType] = None
    fiscal_year: Optional[int] = None
    fiscal_quarter: Optional[int] = None
    is_actual: bool = True
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class FinancialMetricExtractor:
    """
    Extract financial metrics from parsed documents.

    Consumes ParseResult (chunks, tables, formulas) from the parsing pipeline
    and extracts structured financial metrics with source attribution.
    """

    def __init__(self, detector: Optional[FinancialDocumentDetector] = None):
        """
        Initialize the extractor.

        Args:
            detector: Financial document detector (uses global if not provided)
        """
        self.detector = detector or get_financial_detector()

        # Compile metric patterns
        self._metric_patterns: dict[str, list[re.Pattern]] = {}
        for metric_name, patterns in METRIC_PATTERNS.items():
            self._metric_patterns[metric_name] = [
                re.compile(p, re.IGNORECASE) for p in patterns
            ]

        logger.info("FinancialMetricExtractor initialized")

    def extract(
        self,
        document_id: UUID,
        parse_result: ParseResult,
        file_type: str = "",
    ) -> FinancialExtractionResult:
        """
        Extract financial metrics from a parsed document.

        Args:
            document_id: UUID of the source document
            parse_result: Parsed document data
            file_type: MIME type or extension for context

        Returns:
            FinancialExtractionResult with extracted metrics
        """
        start_time = time.perf_counter()

        # First detect if this is a financial document
        detection = self.detector.detect(parse_result, file_type)

        result = FinancialExtractionResult(
            document_id=document_id,
            has_financial_data=detection.has_financial_data,
            detection_confidence=detection.confidence,
            document_type=detection.document_type,
        )

        if not detection.has_financial_data:
            result.processing_time_ms = int((time.perf_counter() - start_time) * 1000)
            logger.info(
                "No financial data detected, skipping extraction",
                document_id=str(document_id),
                confidence=detection.confidence,
            )
            return result

        try:
            # Extract metrics from tables
            table_metrics = self._extract_from_tables(
                document_id, parse_result.tables, parse_result.formulas
            )
            result.metrics.extend(table_metrics)

            # Extract metrics from chunks (text content)
            chunk_metrics = self._extract_from_chunks(document_id, parse_result.chunks)
            result.metrics.extend(chunk_metrics)

            logger.info(
                "Financial metrics extracted",
                document_id=str(document_id),
                metrics_count=len(result.metrics),
                table_metrics=len(table_metrics),
                chunk_metrics=len(chunk_metrics),
            )

        except Exception as e:
            logger.error(
                "Error extracting financial metrics",
                document_id=str(document_id),
                error=str(e),
                exc_info=True,
            )
            result.errors.append(f"Extraction error: {str(e)}")

        result.processing_time_ms = int((time.perf_counter() - start_time) * 1000)
        return result

    def _extract_from_tables(
        self,
        document_id: UUID,
        tables: list[TableData],
        formulas: list[FormulaData],
    ) -> list[FinancialMetricCreate]:
        """
        Extract metrics from table data.

        Args:
            document_id: Source document ID
            tables: List of TableData from parsing
            formulas: List of FormulaData for formula linking

        Returns:
            List of extracted FinancialMetricCreate instances
        """
        metrics: list[FinancialMetricCreate] = []

        # Build formula lookup by cell reference
        formula_lookup: dict[str, FormulaData] = {}
        for formula in formulas:
            key = f"{formula.sheet_name}:{formula.cell_reference}".lower()
            formula_lookup[key] = formula

        for table in tables:
            # Extract period info from headers
            header_periods = self._extract_periods_from_headers(table.headers)

            # Scan each row for metric patterns
            for row_idx, row in enumerate(table.data):
                if not row:
                    continue

                # First column is typically the metric name/label
                label = str(row[0]).strip().lower() if row else ""

                # Try to identify the metric
                metric_name, category = self._identify_metric(label)
                if not metric_name:
                    continue

                # Extract values from remaining columns
                for col_idx, cell_value in enumerate(row[1:], start=1):
                    value, unit = self._parse_value(cell_value)
                    if value is None:
                        continue

                    # Get period info for this column
                    period = header_periods.get(col_idx, PeriodInfo())

                    # Build cell reference
                    cell_ref = self._build_cell_reference(row_idx + 1, col_idx + 1)

                    # Look up formula if Excel
                    source_formula = None
                    if table.sheet_name:
                        formula_key = f"{table.sheet_name}:{cell_ref}".lower()
                        if formula_key in formula_lookup:
                            source_formula = formula_lookup[formula_key].formula

                    metric = FinancialMetricCreate(
                        document_id=document_id,
                        metric_name=metric_name,
                        metric_category=category,
                        value=value,
                        unit=unit,
                        period_type=period.period_type,
                        fiscal_year=period.fiscal_year,
                        fiscal_quarter=period.fiscal_quarter,
                        period_start=period.period_start,
                        period_end=period.period_end,
                        source_cell=cell_ref,
                        source_sheet=table.sheet_name,
                        source_page=table.page_number,
                        source_formula=source_formula,
                        is_actual=period.is_actual,
                        confidence_score=70.0,  # Base confidence for table extraction
                    )
                    metrics.append(metric)

        return metrics

    def _extract_from_chunks(
        self,
        document_id: UUID,
        chunks: list[ChunkData],
    ) -> list[FinancialMetricCreate]:
        """
        Extract metrics mentioned in text chunks.

        This is a fallback for metrics mentioned in text but not in tables.
        Uses regex patterns to find metric values in context.

        Args:
            document_id: Source document ID
            chunks: List of ChunkData from parsing

        Returns:
            List of extracted FinancialMetricCreate instances
        """
        metrics: list[FinancialMetricCreate] = []

        # Pattern for metric + value in text (e.g., "revenue of $10M")
        value_pattern = re.compile(
            r"(?:of|was|is|equals?|:)\s*([\$€£¥]?\s*[\d,\.]+\s*(?:million|billion|thousand|[KMB])?)",
            re.IGNORECASE,
        )

        for chunk in chunks:
            content = chunk.content

            for metric_name, patterns in self._metric_patterns.items():
                for pattern in patterns:
                    matches = pattern.finditer(content)
                    for match in matches:
                        # Look for a value near the match
                        context_start = max(0, match.end())
                        context_end = min(len(content), match.end() + 100)
                        context = content[context_start:context_end]

                        value_match = value_pattern.search(context)
                        if value_match:
                            value, unit = self._parse_value(value_match.group(1))
                            if value is not None:
                                _, category = normalize_metric(metric_name)

                                metric = FinancialMetricCreate(
                                    document_id=document_id,
                                    metric_name=metric_name,
                                    metric_category=category,
                                    value=value,
                                    unit=unit,
                                    source_page=chunk.page_number,
                                    is_actual=True,  # Assume actuals in text
                                    confidence_score=50.0,  # Lower confidence for text extraction
                                    notes=f"Extracted from text: {content[max(0, match.start()-20):match.end()+50]}",
                                )
                                metrics.append(metric)
                                break  # One extraction per match

        return metrics

    def _identify_metric(self, label: str) -> tuple[Optional[str], Optional[MetricCategory]]:
        """
        Identify a metric from its label text.

        Args:
            label: Row label text (typically first column)

        Returns:
            Tuple of (metric_name, category) or (None, None) if not identified
        """
        for metric_name, patterns in self._metric_patterns.items():
            for pattern in patterns:
                if pattern.search(label):
                    _, category = normalize_metric(metric_name)
                    return metric_name, category
        return None, None

    def _extract_periods_from_headers(
        self,
        headers: list[str],
    ) -> dict[int, PeriodInfo]:
        """
        Extract period information from table headers.

        Args:
            headers: List of header strings

        Returns:
            Dict mapping column index to PeriodInfo
        """
        periods: dict[int, PeriodInfo] = {}

        for idx, header in enumerate(headers):
            period = PeriodInfo()

            # Try year pattern
            year_match = YEAR_PATTERN.search(header)
            if year_match:
                year = int(year_match.group(1))
                period.fiscal_year = year
                period.period_type = PeriodType.ANNUAL

                # Check for actual vs projection indicator
                indicator = year_match.group(2)
                if indicator:
                    indicator = indicator.upper()
                    period.is_actual = indicator == "A"
                else:
                    # Assume historical years are actuals
                    from datetime import datetime

                    current_year = datetime.now().year
                    period.is_actual = year < current_year

            # Try quarter pattern
            quarter_match = QUARTER_PATTERN.search(header)
            if quarter_match:
                period.fiscal_quarter = int(quarter_match.group(1))
                period.period_type = PeriodType.QUARTERLY
                if quarter_match.group(2):
                    year_str = quarter_match.group(2)
                    if len(year_str) == 2:
                        year_str = "20" + year_str
                    period.fiscal_year = int(year_str)

            # Try month pattern
            month_match = MONTH_PATTERN.search(header)
            if month_match:
                period.period_type = PeriodType.MONTHLY

            if period.fiscal_year or period.fiscal_quarter or period.period_type:
                periods[idx] = period

        return periods

    def _parse_value(self, cell_value: str) -> tuple[Optional[Decimal], Optional[str]]:
        """
        Parse a numeric value from a cell.

        Args:
            cell_value: Raw cell content

        Returns:
            Tuple of (value, unit) or (None, None) if not parseable
        """
        if not cell_value:
            return None, None

        text = str(cell_value).strip()
        if not text or text in ["-", "—", "N/A", "n/a", "NA"]:
            return None, None

        unit = None

        # Extract currency symbol
        for symbol, currency in CURRENCY_SYMBOLS.items():
            if symbol in text:
                unit = currency
                text = text.replace(symbol, "")
                break

        # Check for percentage
        if "%" in text:
            unit = "%"
            text = text.replace("%", "")

        # Extract multiplier from text
        multiplier = 1
        for pattern, mult in UNIT_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                multiplier = mult
                text = re.sub(pattern, "", text, flags=re.IGNORECASE)
                break

        # Clean and parse the number
        text = text.strip()
        text = text.replace(",", "")  # Remove thousands separator
        text = text.replace(" ", "")

        # Handle parentheses as negative (accounting notation)
        is_negative = False
        if text.startswith("(") and text.endswith(")"):
            is_negative = True
            text = text[1:-1]
        elif text.startswith("-"):
            is_negative = True
            text = text[1:]

        try:
            value = Decimal(text) * multiplier
            if is_negative:
                value = -value
            return value, unit
        except (InvalidOperation, ValueError):
            return None, None

    def _build_cell_reference(self, row: int, col: int) -> str:
        """
        Build Excel-style cell reference (e.g., A1, B15, AA1).

        Args:
            row: 1-based row number
            col: 1-based column number

        Returns:
            Cell reference string
        """
        result = ""
        while col > 0:
            col -= 1
            result = chr(65 + col % 26) + result
            col //= 26
        return f"{result}{row}"


# Global extractor instance
_extractor: Optional[FinancialMetricExtractor] = None


def get_financial_extractor() -> FinancialMetricExtractor:
    """Get or create the global FinancialMetricExtractor instance."""
    global _extractor
    if _extractor is None:
        _extractor = FinancialMetricExtractor()
    return _extractor


__all__ = [
    "FinancialMetricExtractor",
    "get_financial_extractor",
    "METRIC_PATTERNS",
]
