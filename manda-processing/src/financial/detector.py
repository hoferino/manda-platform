"""
Financial document detection for identifying documents containing financial data.
Story: E3.9 - Financial Model Integration (AC: #4)

This module provides:
- FinancialDocumentDetector: Detect if a document contains financial data
- DetectionResult: Result of detection with confidence score
- Pattern-based detection for Excel sheets and PDF tables
- Support for English and German financial terminology
"""

import re
from dataclasses import dataclass, field
from typing import Optional

import structlog

from src.parsers import ParseResult, TableData, FormulaData

logger = structlog.get_logger(__name__)


@dataclass
class DetectionResult:
    """Result of financial document detection."""

    has_financial_data: bool
    confidence: float  # 0-100
    document_type: Optional[str] = None  # income_statement, balance_sheet, annual_report, financial_model, etc.
    detected_patterns: list[str] = field(default_factory=list)
    sheet_classifications: dict[str, str] = field(default_factory=dict)  # sheet_name -> classification
    table_count: int = 0
    formula_count: int = 0

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "has_financial_data": self.has_financial_data,
            "confidence": self.confidence,
            "document_type": self.document_type,
            "detected_patterns": self.detected_patterns,
            "sheet_classifications": self.sheet_classifications,
            "table_count": self.table_count,
            "formula_count": self.formula_count,
        }


class FinancialDocumentDetector:
    """
    Detect if a document contains financial data.

    Uses pattern matching on:
    - Excel sheet names and headers
    - PDF table headers and content
    - Formula presence and patterns
    """

    # Financial statement keywords (English)
    INCOME_STATEMENT_EN = [
        r"income\s*statement",
        r"profit\s*(?:and|&)?\s*loss",
        r"p\s*(?:and|&)?\s*l",
        r"revenue",
        r"sales",
        r"net\s*sales",
        r"gross\s*profit",
        r"operating\s*(?:income|profit|expenses?)",
        r"ebitda",
        r"ebit",
        r"net\s*income",
        r"cost\s*of\s*(?:goods\s*)?sold",
        r"cogs",
        r"gross\s*margin",
    ]

    BALANCE_SHEET_EN = [
        r"balance\s*sheet",
        r"assets?",
        r"liabilit(?:y|ies)",
        r"equity",
        r"shareholders?\s*equity",
        r"total\s*assets?",
        r"current\s*assets?",
        r"fixed\s*assets?",
        r"current\s*liabilit(?:y|ies)",
        r"long[\s-]*term\s*debt",
        r"working\s*capital",
        r"retained\s*earnings",
    ]

    CASH_FLOW_EN = [
        r"cash\s*flow",
        r"statement\s*of\s*cash\s*flows?",
        r"operating\s*(?:cash\s*)?(?:activities|cash\s*flow)",
        r"investing\s*(?:activities|cash\s*flow)",
        r"financing\s*(?:activities|cash\s*flow)",
        r"free\s*cash\s*flow",
        r"fcf",
        r"capex",
        r"capital\s*expenditure",
        r"depreciation",
        r"amortization",
    ]

    # Financial statement keywords (German)
    INCOME_STATEMENT_DE = [
        r"gewinn[\s-]*und[\s-]*verlust",
        r"guv",
        r"erfolgsrechnung",
        r"umsatz",
        r"erlöse",
        r"rohergebnis",
        r"betriebsergebnis",
        r"jahresüberschuss",
        r"herstellungskosten",
        r"bruttogewinn",
        r"bruttomarge",
    ]

    BALANCE_SHEET_DE = [
        r"bilanz",
        r"aktiva",
        r"passiva",
        r"bilanzsumme",
        r"eigenkapital",
        r"fremdkapital",
        r"verbindlichkeiten",
        r"anlagevermögen",
        r"umlaufvermögen",
        r"rückstellungen",
    ]

    CASH_FLOW_DE = [
        r"kapitalfluss",
        r"cashflow",
        r"cash[\s-]*flow",
        r"mittelfluss",
        r"liquiditätsrechnung",
        r"operativer\s*cashflow",
        r"investitions(?:tätigkeit|cashflow)",
        r"finanzierungs(?:tätigkeit|cashflow)",
    ]

    # General financial model indicators
    FINANCIAL_MODEL_INDICATORS = [
        r"financial\s*model",
        r"forecast",
        r"projection",
        r"budget",
        r"plan(?:ung)?",
        r"scenario",
        r"sensitivity",
        r"dcf",
        r"discounted\s*cash\s*flow",
        r"valuation",
        r"multiple",
        r"npv",
        r"irr",
        r"wacc",
        r"terminal\s*value",
    ]

    # Period indicators (for detecting actuals vs projections)
    ACTUAL_INDICATORS = [
        r"\d{4}\s*[aA](?:ctual)?",  # 2023A, 2023 Actual
        r"(?:ist|actual)[\s-]*\d{4}",
        r"ytd",
        r"year[\s-]*to[\s-]*date",
        r"[hH]1\s*\d{4}",
        r"[hH]2\s*\d{4}",
    ]

    PROJECTION_INDICATORS = [
        r"\d{4}\s*[eEfFpP](?:stimate|orecast|rojection)?",  # 2024E, 2024F, 2024P
        r"(?:plan|forecast|projection|budget)[\s-]*\d{4}",
        r"(?:\d{4}|\d{2})[\s-]*(?:plan|fc|budget)",
    ]

    # Minimum scores for classification
    MIN_CONFIDENCE_THRESHOLD = 30.0  # Minimum confidence to consider as financial
    HIGH_CONFIDENCE_THRESHOLD = 70.0  # High confidence threshold

    def __init__(self):
        """Initialize the detector with compiled patterns."""
        # Compile all patterns for efficiency
        self._income_patterns = self._compile_patterns(
            self.INCOME_STATEMENT_EN + self.INCOME_STATEMENT_DE
        )
        self._balance_patterns = self._compile_patterns(
            self.BALANCE_SHEET_EN + self.BALANCE_SHEET_DE
        )
        self._cashflow_patterns = self._compile_patterns(
            self.CASH_FLOW_EN + self.CASH_FLOW_DE
        )
        self._model_patterns = self._compile_patterns(self.FINANCIAL_MODEL_INDICATORS)
        self._actual_patterns = self._compile_patterns(self.ACTUAL_INDICATORS)
        self._projection_patterns = self._compile_patterns(self.PROJECTION_INDICATORS)

        logger.info("FinancialDocumentDetector initialized")

    def _compile_patterns(self, patterns: list[str]) -> list[re.Pattern]:
        """Compile regex patterns."""
        return [re.compile(p, re.IGNORECASE) for p in patterns]

    def detect(self, parse_result: ParseResult, file_type: str = "") -> DetectionResult:
        """
        Detect if a document contains financial data.

        Args:
            parse_result: Parsed document data with chunks, tables, and formulas
            file_type: MIME type or extension for context

        Returns:
            DetectionResult with confidence score and classification
        """
        detected_patterns: list[str] = []
        sheet_classifications: dict[str, str] = {}
        scores: dict[str, float] = {
            "income_statement": 0.0,
            "balance_sheet": 0.0,
            "cash_flow": 0.0,
            "financial_model": 0.0,
        }

        # Analyze tables
        for table in parse_result.tables:
            table_score = self._analyze_table(table, detected_patterns, scores)
            if table.sheet_name and table_score > 0:
                sheet_classifications[table.sheet_name] = self._get_primary_type(scores)

        # Analyze formulas (Excel-specific)
        formula_score = self._analyze_formulas(parse_result.formulas, detected_patterns)
        scores["financial_model"] += formula_score

        # Analyze chunks for additional context
        chunk_score = self._analyze_chunks(parse_result.chunks, detected_patterns, scores)

        # Calculate overall confidence
        max_score = max(scores.values())
        total_score = sum(scores.values())

        # Determine primary document type
        primary_type = self._get_primary_type(scores)

        # Adjust confidence based on evidence
        confidence = min(100.0, max_score * 1.5 + (total_score - max_score) * 0.3)

        # Boost confidence if we have both tables and formulas
        if parse_result.tables and parse_result.formulas:
            confidence = min(100.0, confidence * 1.2)

        has_financial_data = confidence >= self.MIN_CONFIDENCE_THRESHOLD

        result = DetectionResult(
            has_financial_data=has_financial_data,
            confidence=round(confidence, 2),
            document_type=primary_type if has_financial_data else None,
            detected_patterns=list(set(detected_patterns)),
            sheet_classifications=sheet_classifications,
            table_count=len(parse_result.tables),
            formula_count=len(parse_result.formulas),
        )

        logger.info(
            "Financial document detection complete",
            has_financial_data=has_financial_data,
            confidence=result.confidence,
            document_type=result.document_type,
            pattern_count=len(detected_patterns),
        )

        return result

    def _analyze_table(
        self,
        table: TableData,
        detected_patterns: list[str],
        scores: dict[str, float],
    ) -> float:
        """
        Analyze a table for financial content.

        Args:
            table: TableData from parsing
            detected_patterns: List to append detected patterns
            scores: Score dict to update

        Returns:
            Total score contribution from this table
        """
        total_score = 0.0

        # Analyze headers
        headers_text = " ".join(table.headers).lower()

        # Check income statement patterns
        for pattern in self._income_patterns:
            if pattern.search(headers_text):
                scores["income_statement"] += 15.0
                detected_patterns.append(f"income:{pattern.pattern}")
                total_score += 15.0

        # Check balance sheet patterns
        for pattern in self._balance_patterns:
            if pattern.search(headers_text):
                scores["balance_sheet"] += 15.0
                detected_patterns.append(f"balance:{pattern.pattern}")
                total_score += 15.0

        # Check cash flow patterns
        for pattern in self._cashflow_patterns:
            if pattern.search(headers_text):
                scores["cash_flow"] += 15.0
                detected_patterns.append(f"cashflow:{pattern.pattern}")
                total_score += 15.0

        # Analyze data rows for numeric patterns
        numeric_count = 0
        for row in table.data:
            for cell in row:
                # Check for numeric values (possibly with currency symbols)
                if re.match(r"^[\$€£¥]?\s*-?[\d,\.]+\s*[%KMB]?$", str(cell).strip()):
                    numeric_count += 1

        # Tables with lots of numbers are more likely financial
        if table.rows > 0 and table.cols > 0:
            numeric_ratio = numeric_count / (table.rows * table.cols)
            if numeric_ratio > 0.5:
                scores["financial_model"] += 10.0
                total_score += 10.0

        return total_score

    def _analyze_formulas(
        self,
        formulas: list[FormulaData],
        detected_patterns: list[str],
    ) -> float:
        """
        Analyze formulas for financial model indicators.

        Args:
            formulas: List of FormulaData from parsing
            detected_patterns: List to append detected patterns

        Returns:
            Score contribution from formula analysis
        """
        if not formulas:
            return 0.0

        score = 0.0

        # Having formulas is itself an indicator
        formula_count = len(formulas)
        if formula_count > 10:
            score += 20.0
            detected_patterns.append(f"formula_count:{formula_count}")
        elif formula_count > 0:
            score += 10.0
            detected_patterns.append(f"formula_count:{formula_count}")

        # Analyze formula types
        sum_count = 0
        reference_count = 0
        complex_count = 0

        for formula in formulas:
            formula_text = formula.formula.upper()

            # Count common financial formula patterns
            if "SUM" in formula_text:
                sum_count += 1
            if len(formula.references) > 2:
                complex_count += 1
            reference_count += len(formula.references)

        # Lots of SUM formulas indicate financial aggregation
        if sum_count > 5:
            score += 15.0
            detected_patterns.append(f"sum_formulas:{sum_count}")

        # Complex formulas with many references
        if complex_count > 3:
            score += 10.0
            detected_patterns.append(f"complex_formulas:{complex_count}")

        return score

    def _analyze_chunks(
        self,
        chunks: list,
        detected_patterns: list[str],
        scores: dict[str, float],
    ) -> float:
        """
        Analyze text chunks for financial terminology.

        Args:
            chunks: List of ChunkData
            detected_patterns: List to append detected patterns
            scores: Score dict to update

        Returns:
            Score contribution from chunk analysis
        """
        total_score = 0.0

        for chunk in chunks:
            content = chunk.content.lower() if hasattr(chunk, 'content') else str(chunk).lower()

            # Check financial model indicators
            for pattern in self._model_patterns:
                if pattern.search(content):
                    scores["financial_model"] += 5.0
                    detected_patterns.append(f"model:{pattern.pattern}")
                    total_score += 5.0
                    break  # Only count once per chunk

            # Check for period indicators (actuals vs projections)
            for pattern in self._actual_patterns:
                if pattern.search(content):
                    detected_patterns.append(f"actual:{pattern.pattern}")
                    total_score += 2.0
                    break

            for pattern in self._projection_patterns:
                if pattern.search(content):
                    detected_patterns.append(f"projection:{pattern.pattern}")
                    scores["financial_model"] += 3.0
                    total_score += 3.0
                    break

        return total_score

    def _get_primary_type(self, scores: dict[str, float]) -> Optional[str]:
        """Get the primary document type based on scores."""
        if not any(scores.values()):
            return None

        max_type = max(scores.keys(), key=lambda k: scores[k])
        if scores[max_type] > 0:
            return max_type
        return None

    def is_projection_year(self, text: str) -> bool:
        """Check if a text indicates a projection/forecast year."""
        for pattern in self._projection_patterns:
            if pattern.search(text):
                return True
        return False

    def is_actual_year(self, text: str) -> bool:
        """Check if a text indicates an actual/historical year."""
        for pattern in self._actual_patterns:
            if pattern.search(text):
                return True
        # Plain 4-digit years without indicators are typically actuals
        if re.match(r"^\d{4}$", text.strip()):
            return True
        return False


# Global detector instance
_detector: Optional[FinancialDocumentDetector] = None


def get_financial_detector() -> FinancialDocumentDetector:
    """Get or create the global FinancialDocumentDetector instance."""
    global _detector
    if _detector is None:
        _detector = FinancialDocumentDetector()
    return _detector


__all__ = [
    "FinancialDocumentDetector",
    "DetectionResult",
    "get_financial_detector",
]
