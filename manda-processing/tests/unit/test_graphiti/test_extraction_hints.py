"""
Unit tests for extraction_hints module.

Story: E14-S2 - Document-Type Extraction Hints (AC: #5)
"""

import pytest

from src.graphiti.extraction_hints import (
    DocumentType,
    EXTRACTION_HINTS,
    detect_document_type,
    get_extraction_hints,
)


class TestDetectDocumentType:
    """Tests for document type detection from filename."""

    def test_detect_financial_document_explicit(self):
        """Financial keywords in filename should return FINANCIAL type."""
        assert detect_document_type({"filename": "Q3_Financial_Statements.xlsx"}) == DocumentType.FINANCIAL
        assert detect_document_type({"filename": "income_statement_2024.pdf"}) == DocumentType.FINANCIAL
        assert detect_document_type({"filename": "balance_sheet.xlsx"}) == DocumentType.FINANCIAL

    def test_detect_financial_document_variants(self):
        """Various financial document naming patterns."""
        assert detect_document_type({"filename": "cashflow_projection.xlsx"}) == DocumentType.FINANCIAL
        assert detect_document_type({"filename": "P&L_Summary.pdf"}) == DocumentType.FINANCIAL
        assert detect_document_type({"filename": "budget_2025.xlsx"}) == DocumentType.FINANCIAL
        assert detect_document_type({"filename": "revenue_forecast.docx"}) == DocumentType.FINANCIAL
        assert detect_document_type({"filename": "EBITDA_model.xlsx"}) == DocumentType.FINANCIAL

    def test_detect_legal_document(self):
        """Legal keywords in filename should return LEGAL type."""
        assert detect_document_type({"filename": "Customer_Agreement_v2.docx"}) == DocumentType.LEGAL
        assert detect_document_type({"filename": "NDA_Acme_Corp.pdf"}) == DocumentType.LEGAL
        assert detect_document_type({"filename": "service_contract.pdf"}) == DocumentType.LEGAL
        assert detect_document_type({"filename": "software_license.docx"}) == DocumentType.LEGAL
        assert detect_document_type({"filename": "lease_agreement.pdf"}) == DocumentType.LEGAL

    def test_detect_operational_document(self):
        """Operational keywords in filename should return OPERATIONAL type."""
        assert detect_document_type({"filename": "operations_overview.pdf"}) == DocumentType.OPERATIONAL
        assert detect_document_type({"filename": "org_structure.docx"}) == DocumentType.OPERATIONAL
        assert detect_document_type({"filename": "capacity_plan.xlsx"}) == DocumentType.OPERATIONAL
        assert detect_document_type({"filename": "SOP_manufacturing.pdf"}) == DocumentType.OPERATIONAL
        assert detect_document_type({"filename": "employee_headcount.xlsx"}) == DocumentType.OPERATIONAL

    def test_detect_market_document(self):
        """Market keywords in filename should return MARKET type."""
        assert detect_document_type({"filename": "market_analysis.pdf"}) == DocumentType.MARKET
        assert detect_document_type({"filename": "industry_research.docx"}) == DocumentType.MARKET
        assert detect_document_type({"filename": "competitor_landscape.pdf"}) == DocumentType.MARKET
        assert detect_document_type({"filename": "customer_segment_analysis.xlsx"}) == DocumentType.MARKET

    def test_detect_general_fallback(self):
        """Unknown filenames should return GENERAL type."""
        assert detect_document_type({"filename": "random_doc.pdf"}) == DocumentType.GENERAL
        assert detect_document_type({"filename": "notes.txt"}) == DocumentType.GENERAL
        assert detect_document_type({"filename": "presentation.pptx"}) == DocumentType.GENERAL

    def test_detect_with_empty_metadata(self):
        """Empty metadata should return GENERAL type."""
        assert detect_document_type({}) == DocumentType.GENERAL

    def test_detect_with_missing_filename(self):
        """Missing filename key should return GENERAL type."""
        assert detect_document_type({"other_key": "value"}) == DocumentType.GENERAL

    def test_detect_case_insensitivity(self):
        """Detection should be case insensitive."""
        assert detect_document_type({"filename": "FINANCIAL_REPORT.PDF"}) == DocumentType.FINANCIAL
        assert detect_document_type({"filename": "Contract_V1.docx"}) == DocumentType.LEGAL
        assert detect_document_type({"filename": "MARKET_Analysis.pdf"}) == DocumentType.MARKET


class TestGetExtractionHints:
    """Tests for extraction hint generation."""

    def test_get_hints_for_financial(self):
        """Financial hints should include financial metrics guidance."""
        hints = get_extraction_hints(DocumentType.FINANCIAL)
        assert "financial metrics" in hints.lower()
        assert "revenue" in hints.lower()
        assert "ebitda" in hints.lower()

    def test_get_hints_for_legal(self):
        """Legal hints should include contract-related guidance."""
        hints = get_extraction_hints(DocumentType.LEGAL)
        assert "contract" in hints.lower()
        assert "parties" in hints.lower()
        assert "obligations" in hints.lower()

    def test_get_hints_for_operational(self):
        """Operational hints should include process-related guidance."""
        hints = get_extraction_hints(DocumentType.OPERATIONAL)
        assert "operational" in hints.lower() or "process" in hints.lower()
        assert "kpi" in hints.lower()

    def test_get_hints_for_market(self):
        """Market hints should include market analysis guidance."""
        hints = get_extraction_hints(DocumentType.MARKET)
        assert "market" in hints.lower()
        assert "competitor" in hints.lower()

    def test_get_hints_for_general(self):
        """General hints should be comprehensive."""
        hints = get_extraction_hints(DocumentType.GENERAL)
        assert "entities" in hints.lower()
        assert "m&a" in hints.lower()

    def test_get_hints_includes_filename_metadata(self):
        """Hints should include source document when provided."""
        hints = get_extraction_hints(DocumentType.FINANCIAL, {"filename": "test_report.xlsx"})
        assert "test_report.xlsx" in hints

    def test_get_hints_includes_file_type_metadata(self):
        """Hints should include file format when provided."""
        hints = get_extraction_hints(DocumentType.FINANCIAL, {"filename": "test.xlsx", "file_type": "xlsx"})
        assert "xlsx" in hints.lower()

    def test_get_hints_without_metadata(self):
        """Hints should work without metadata."""
        hints = get_extraction_hints(DocumentType.FINANCIAL)
        assert len(hints) > 100  # Should have substantial content

    def test_get_hints_with_empty_metadata(self):
        """Hints should work with empty metadata dict."""
        hints = get_extraction_hints(DocumentType.FINANCIAL, {})
        assert len(hints) > 100


class TestExtractionHintsConstant:
    """Tests for EXTRACTION_HINTS constant completeness."""

    def test_all_document_types_have_hints(self):
        """Every DocumentType should have corresponding hints."""
        for doc_type in DocumentType:
            assert doc_type in EXTRACTION_HINTS
            assert len(EXTRACTION_HINTS[doc_type]) > 50  # Non-trivial content

    def test_hints_are_not_empty(self):
        """All hints should have meaningful content."""
        for doc_type, hints in EXTRACTION_HINTS.items():
            assert hints.strip()  # Not empty or whitespace only
            assert "extract" in hints.lower()  # Should have extraction guidance


class TestDocumentTypeEnum:
    """Tests for DocumentType enum."""

    def test_enum_values(self):
        """Verify expected enum values exist."""
        assert DocumentType.FINANCIAL.value == "financial"
        assert DocumentType.LEGAL.value == "legal"
        assert DocumentType.OPERATIONAL.value == "operational"
        assert DocumentType.MARKET.value == "market"
        assert DocumentType.GENERAL.value == "general"

    def test_enum_count(self):
        """Should have exactly 5 document types."""
        assert len(DocumentType) == 5
