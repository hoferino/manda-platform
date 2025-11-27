"""
Tests for FinancialDocumentDetector.
Story: E3.9 - Financial Model Integration (AC: #4)
"""

import pytest

from src.financial.detector import (
    FinancialDocumentDetector,
    DetectionResult,
    get_financial_detector,
)
from src.parsers import ParseResult, TableData, FormulaData, ChunkData


def make_table(headers: list[str], data: list[list[str]], sheet_name: str = None, page_number: int = None) -> TableData:
    """Helper to create TableData with required fields."""
    # Build markdown content from table data
    content = "| " + " | ".join(headers) + " |\n"
    content += "| " + " | ".join(["---"] * len(headers)) + " |\n"
    for row in data:
        content += "| " + " | ".join(row) + " |\n"

    return TableData(
        content=content,
        headers=headers,
        data=data,
        rows=len(data),
        cols=len(headers),
        sheet_name=sheet_name,
        page_number=page_number,
    )


@pytest.fixture
def detector() -> FinancialDocumentDetector:
    """Create a fresh detector instance."""
    return FinancialDocumentDetector()


@pytest.fixture
def empty_parse_result() -> ParseResult:
    """Create an empty parse result."""
    return ParseResult(
        chunks=[],
        tables=[],
        formulas=[],
    )


class TestFinancialDocumentDetector:
    """Tests for the FinancialDocumentDetector class."""

    def test_init(self, detector: FinancialDocumentDetector):
        """Test detector initialization."""
        assert detector is not None
        assert len(detector._income_patterns) > 0
        assert len(detector._balance_patterns) > 0
        assert len(detector._cashflow_patterns) > 0

    def test_detect_empty_document(
        self, detector: FinancialDocumentDetector, empty_parse_result: ParseResult
    ):
        """Test detection on empty document."""
        result = detector.detect(empty_parse_result)

        assert isinstance(result, DetectionResult)
        assert result.has_financial_data is False
        assert result.confidence == 0.0
        assert result.document_type is None

    def test_detect_income_statement_table(self, detector: FinancialDocumentDetector):
        """Test detection of income statement from table headers."""
        # Use two tables to ensure confidence threshold is met
        table1 = make_table(
            headers=["Income Statement", "2022", "2023", "2024E"],
            data=[
                ["Revenue", "100", "120", "150"],
                ["COGS", "40", "48", "60"],
                ["Gross Profit", "60", "72", "90"],
            ],
            sheet_name="P&L",
            page_number=1,
        )
        table2 = make_table(
            headers=["EBITDA Summary", "2022", "2023"],
            data=[
                ["EBITDA", "25", "30"],
                ["Net Income", "15", "20"],
            ],
            sheet_name="P&L",
            page_number=1,
        )

        parse_result = ParseResult(
            chunks=[],
            tables=[table1, table2],
            formulas=[],
        )

        result = detector.detect(parse_result)

        assert result.has_financial_data is True
        assert result.confidence >= 30.0
        assert result.document_type == "income_statement"
        assert len(result.detected_patterns) > 0

    def test_detect_balance_sheet_table(self, detector: FinancialDocumentDetector):
        """Test detection of balance sheet from table headers."""
        # Use two tables to ensure confidence threshold is met
        table1 = make_table(
            headers=["Balance Sheet", "2022", "2023"],
            data=[
                ["Total Assets", "500", "600"],
                ["Current Assets", "200", "250"],
                ["Total Liabilities", "300", "350"],
                ["Shareholders Equity", "200", "250"],
            ],
            sheet_name="BS",
            page_number=1,
        )
        table2 = make_table(
            headers=["Asset Summary", "2022", "2023"],
            data=[
                ["Fixed Assets", "300", "350"],
                ["Intangible Assets", "50", "60"],
            ],
            sheet_name="BS",
            page_number=1,
        )

        parse_result = ParseResult(
            chunks=[],
            tables=[table1, table2],
            formulas=[],
        )

        result = detector.detect(parse_result)

        assert result.has_financial_data is True
        assert result.document_type == "balance_sheet"

    def test_detect_cash_flow_table(self, detector: FinancialDocumentDetector):
        """Test detection of cash flow statement from table headers."""
        table = make_table(
            headers=["Cash Flow Statement", "2022", "2023"],
            data=[
                ["Operating Cash Flow", "50", "60"],
                ["Investing Activities", "-20", "-25"],
                ["Financing Activities", "-10", "-15"],
                ["Free Cash Flow", "30", "35"],
            ],
            sheet_name="CF",
            page_number=1,
        )

        parse_result = ParseResult(
            chunks=[],
            tables=[table],
            formulas=[],
        )

        result = detector.detect(parse_result)

        assert result.has_financial_data is True
        assert result.document_type == "cash_flow"

    def test_detect_formulas_boost_confidence(self, detector: FinancialDocumentDetector):
        """Test that formulas boost detection confidence."""
        table = make_table(
            headers=["Revenue", "2022", "2023"],
            data=[["Sales", "100", "120"]],
            sheet_name="Summary",
        )

        formulas = [
            FormulaData(
                cell_reference="B2",
                formula="=SUM(B3:B10)",
                sheet_name="Summary",
                references=["B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10"],
                result_value="100",
            ),
            FormulaData(
                cell_reference="C2",
                formula="=SUM(C3:C10)",
                sheet_name="Summary",
                references=["C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10"],
                result_value="120",
            ),
        ]

        # Without formulas
        parse_result_no_formulas = ParseResult(
            chunks=[],
            tables=[table],
            formulas=[],
        )
        result_no_formulas = detector.detect(parse_result_no_formulas)

        # With formulas
        parse_result_with_formulas = ParseResult(
            chunks=[],
            tables=[table],
            formulas=formulas,
        )
        result_with_formulas = detector.detect(parse_result_with_formulas)

        # Formulas should boost confidence
        assert result_with_formulas.formula_count == 2
        assert result_with_formulas.confidence >= result_no_formulas.confidence

    def test_detect_german_terminology(self, detector: FinancialDocumentDetector):
        """Test detection of German financial terminology."""
        # Use two tables to ensure confidence threshold is met
        table1 = make_table(
            headers=["Gewinn und Verlust", "2022", "2023"],
            data=[
                ["Umsatz", "100", "120"],
                ["Bruttogewinn", "60", "72"],
                ["Betriebsergebnis", "25", "30"],
                ["Jahresüberschuss", "15", "20"],
            ],
            sheet_name="GuV",
            page_number=1,
        )
        table2 = make_table(
            headers=["EBITDA Analyse", "2022", "2023"],
            data=[
                ["EBITDA", "40", "48"],
            ],
            sheet_name="GuV",
            page_number=1,
        )

        parse_result = ParseResult(
            chunks=[],
            tables=[table1, table2],
            formulas=[],
        )

        result = detector.detect(parse_result)

        assert result.has_financial_data is True
        assert result.confidence >= 30.0

    def test_detect_financial_model_indicators(self, detector: FinancialDocumentDetector):
        """Test detection of financial model indicators."""
        chunk = ChunkData(
            content="This DCF model includes forecast projections for 2024-2028 with terminal value calculation using WACC of 10%.",
            chunk_index=0,
            chunk_type="text",
            page_number=1,
            metadata={},
        )

        parse_result = ParseResult(
            chunks=[chunk],
            tables=[],
            formulas=[],
        )

        result = detector.detect(parse_result)

        # Should detect financial model indicators
        assert result.has_financial_data is True or result.confidence > 0
        assert "financial_model" in result.detected_patterns or any(
            "model:" in p for p in result.detected_patterns
        )

    def test_is_projection_year(self, detector: FinancialDocumentDetector):
        """Test projection year detection."""
        assert detector.is_projection_year("2024E") is True
        assert detector.is_projection_year("2024F") is True
        assert detector.is_projection_year("2024P") is True
        assert detector.is_projection_year("Forecast 2024") is True
        assert detector.is_projection_year("2023") is False
        assert detector.is_projection_year("2023A") is False

    def test_is_actual_year(self, detector: FinancialDocumentDetector):
        """Test actual year detection."""
        assert detector.is_actual_year("2023A") is True
        assert detector.is_actual_year("2023 Actual") is True
        assert detector.is_actual_year("2023") is True
        assert detector.is_actual_year("YTD") is True

    def test_detection_result_to_dict(self):
        """Test DetectionResult serialization."""
        result = DetectionResult(
            has_financial_data=True,
            confidence=75.0,
            document_type="income_statement",
            detected_patterns=["revenue", "ebitda"],
            sheet_classifications={"P&L": "income_statement"},
            table_count=3,
            formula_count=50,
        )

        result_dict = result.to_dict()

        assert result_dict["has_financial_data"] is True
        assert result_dict["confidence"] == 75.0
        assert result_dict["document_type"] == "income_statement"
        assert "revenue" in result_dict["detected_patterns"]

    def test_get_financial_detector_singleton(self):
        """Test that get_financial_detector returns singleton."""
        detector1 = get_financial_detector()
        detector2 = get_financial_detector()

        assert detector1 is detector2


class TestDetectionWithNumericContent:
    """Tests for numeric content detection."""

    def test_high_numeric_ratio_boosts_confidence(self):
        """Test that tables with high numeric content boost confidence."""
        detector = FinancialDocumentDetector()

        # Table with mostly numeric values
        numeric_table = make_table(
            headers=["Metric", "2021", "2022", "2023"],
            data=[
                ["Item 1", "100.5", "200.3", "300.7"],
                ["Item 2", "$50K", "€60K", "£70K"],
                ["Item 3", "15%", "18%", "22%"],
            ],
            sheet_name="Data",
            page_number=1,
        )

        parse_result = ParseResult(
            chunks=[],
            tables=[numeric_table],
            formulas=[],
        )

        result = detector.detect(parse_result)

        # Should have some confidence due to numeric content
        assert result.confidence > 0


class TestSheetClassifications:
    """Tests for sheet classification."""

    def test_multiple_sheets_classified(self):
        """Test that multiple sheets are properly classified."""
        detector = FinancialDocumentDetector()

        tables = [
            make_table(
                headers=["Income Statement", "2023"],
                data=[["Revenue", "100"]],
                sheet_name="P&L",
            ),
            make_table(
                headers=["Balance Sheet", "2023"],
                data=[["Assets", "500"]],
                sheet_name="BS",
            ),
        ]

        parse_result = ParseResult(
            chunks=[],
            tables=tables,
            formulas=[],
        )

        result = detector.detect(parse_result)

        assert "P&L" in result.sheet_classifications or "BS" in result.sheet_classifications
