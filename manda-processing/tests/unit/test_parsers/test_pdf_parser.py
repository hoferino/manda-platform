"""
Unit tests for PDF parser with OCR support.
Story: E3.2 - Integrate Docling for Document Parsing (AC: #3, #6)

Note: These tests require the docling library to be installed.
They will be skipped if docling is not available.
"""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

# Check if docling is available
try:
    import docling
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not DOCLING_AVAILABLE,
    reason="docling library not installed - tests require docling>=2.15.0"
)


class TestPDFParserBasic:
    """Basic tests for PDFParser class."""

    def test_pdf_parser_initialization(self, mock_parser_settings: MagicMock) -> None:
        """Test that PDFParser initializes correctly."""
        from src.parsers.pdf_parser import PDFParser

        parser = PDFParser()

        assert parser.config is not None
        assert parser.chunker is not None
        assert parser._converter is None  # Lazy initialization

    def test_supports_pdf_types(self, mock_parser_settings: MagicMock) -> None:
        """Test that parser supports PDF file types."""
        from src.parsers.pdf_parser import PDFParser

        parser = PDFParser()

        assert parser.supports(".pdf") is True
        assert parser.supports("pdf") is True
        assert parser.supports("application/pdf") is True
        assert parser.supports(".xlsx") is False
        assert parser.supports(".docx") is False


class TestPDFTableConversion:
    """Tests for PDF table conversion."""

    def test_data_to_markdown(self, mock_parser_settings: MagicMock) -> None:
        """Test converting table data to markdown."""
        from src.parsers.pdf_parser import PDFParser

        parser = PDFParser()

        data = [
            ["Header1", "Header2", "Header3"],
            ["A", "B", "C"],
            ["D", "E", "F"],
        ]

        markdown = parser._data_to_markdown(data)

        assert "| Header1 | Header2 | Header3 |" in markdown
        assert "| --- | --- | --- |" in markdown
        assert "| A | B | C |" in markdown
        assert "| D | E | F |" in markdown

    def test_data_to_markdown_empty(self, mock_parser_settings: MagicMock) -> None:
        """Test handling empty table data."""
        from src.parsers.pdf_parser import PDFParser

        parser = PDFParser()

        assert parser._data_to_markdown([]) == ""
        assert parser._data_to_markdown([[]]) == ""

    def test_data_to_markdown_handles_none(self, mock_parser_settings: MagicMock) -> None:
        """Test handling None values in table data."""
        from src.parsers.pdf_parser import PDFParser

        parser = PDFParser()

        data = [
            ["Header1", "Header2"],
            [None, "Value"],
            ["Test", None],
        ]

        markdown = parser._data_to_markdown(data)

        assert "| Header1 | Header2 |" in markdown
        # None should be converted to empty string
        assert "|" in markdown


class TestPDFParserWithMocks:
    """Tests using mocked Docling responses."""

    @pytest.mark.asyncio
    async def test_parse_with_mocked_docling(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test parsing with mocked Docling converter."""
        from src.parsers.pdf_parser import PDFParser
        from pathlib import Path
        import tempfile
        import os

        # Create a temp file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 dummy content")
            temp_path = Path(f.name)

        try:
            # Mock the Docling converter
            mock_doc = MagicMock()
            mock_doc.export_to_markdown.return_value = """
            # Document Title

            This is the first paragraph of the document.
            It contains important information about the company.

            ## Financial Summary

            Revenue increased by 25% year over year.

            | Metric | Value |
            |--------|-------|
            | Revenue | $150M |
            | EBITDA | $27M |
            """
            mock_doc.pages = None  # No page-level access
            mock_doc.tables = []

            mock_result = MagicMock()
            mock_result.document = mock_doc

            mock_converter = MagicMock()
            mock_converter.convert.return_value = mock_result

            parser = PDFParser()

            with patch.object(parser, "_get_converter", return_value=mock_converter):
                result = await parser.parse(temp_path)

            assert len(result.chunks) > 0
            assert result.formulas == []  # PDFs don't have formulas

            # Check content was extracted
            combined = " ".join(c.content for c in result.chunks)
            assert "Revenue" in combined or "Document" in combined

        finally:
            os.unlink(temp_path)

    @pytest.mark.asyncio
    async def test_parse_with_pages(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test parsing PDF with page-level content."""
        from src.parsers.pdf_parser import PDFParser
        from pathlib import Path
        import tempfile
        import os

        # Create a temp file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 dummy content")
            temp_path = Path(f.name)

        try:
            # Mock pages
            mock_page1 = MagicMock()
            mock_page1.text = "Page 1 content about financials"
            mock_page1.tables = []

            mock_page2 = MagicMock()
            mock_page2.text = "Page 2 content about operations"
            mock_page2.tables = []

            mock_doc = MagicMock()
            mock_doc.pages = [mock_page1, mock_page2]
            mock_doc.export_to_markdown.return_value = "Full document text"

            mock_result = MagicMock()
            mock_result.document = mock_doc

            mock_converter = MagicMock()
            mock_converter.convert.return_value = mock_result

            parser = PDFParser()

            with patch.object(parser, "_get_converter", return_value=mock_converter):
                result = await parser.parse(temp_path)

            assert result.total_pages == 2
            assert len(result.chunks) > 0

            # Check page numbers are tracked
            page_numbers = [c.page_number for c in result.chunks if c.page_number]
            assert 1 in page_numbers or 2 in page_numbers

        finally:
            os.unlink(temp_path)


class TestPDFParserTableExtraction:
    """Tests for table extraction from PDFs."""

    def test_convert_table_from_markdown(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test converting Docling table to TableData."""
        from src.parsers.pdf_parser import PDFParser

        parser = PDFParser()

        mock_table = MagicMock()
        mock_table.export_to_markdown.return_value = """| A | B | C |
| --- | --- | --- |
| 1 | 2 | 3 |
| 4 | 5 | 6 |"""

        table_data = parser._convert_table(mock_table, page_num=1, source_file="test.pdf")

        assert table_data is not None
        assert table_data.rows >= 3  # Header + data rows (separator excluded in some counts)
        assert table_data.cols == 3
        assert table_data.headers == ["A", "B", "C"]
        assert table_data.page_number == 1

    def test_convert_table_empty(self, mock_parser_settings: MagicMock) -> None:
        """Test handling empty table."""
        from src.parsers.pdf_parser import PDFParser

        parser = PDFParser()

        mock_table = MagicMock()
        mock_table.export_to_markdown.return_value = ""

        result = parser._convert_table(mock_table, None, "test.pdf")
        assert result is None


class TestPDFParserErrors:
    """Tests for error handling in PDF parser."""

    @pytest.mark.asyncio
    async def test_parse_nonexistent_file(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test handling of non-existent file."""
        from src.parsers.pdf_parser import PDFParser
        from src.parsers import CorruptFileError

        parser = PDFParser()

        with pytest.raises(Exception):
            await parser.parse(Path("/nonexistent/file.pdf"))

    @pytest.mark.asyncio
    async def test_parse_handles_docling_error(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test handling Docling conversion errors."""
        from src.parsers.pdf_parser import PDFParser
        from src.parsers import CorruptFileError
        from pathlib import Path
        import tempfile
        import os

        # Create a temp file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"not a real pdf")
            temp_path = Path(f.name)

        try:
            mock_converter = MagicMock()
            mock_converter.convert.side_effect = Exception("Docling failed")

            parser = PDFParser()

            with patch.object(parser, "_get_converter", return_value=mock_converter):
                with pytest.raises(CorruptFileError):
                    await parser.parse(temp_path)

        finally:
            os.unlink(temp_path)


class TestPDFParserMetadata:
    """Tests for metadata extraction from PDFs."""

    @pytest.mark.asyncio
    async def test_parse_records_metadata(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test that parsing records appropriate metadata."""
        from src.parsers.pdf_parser import PDFParser
        from pathlib import Path
        import tempfile
        import os

        # Create a temp file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 content")
            temp_path = Path(f.name)

        try:
            mock_doc = MagicMock()
            mock_doc.export_to_markdown.return_value = "Test content"
            mock_doc.pages = None

            mock_result = MagicMock()
            mock_result.document = mock_doc

            mock_converter = MagicMock()
            mock_converter.convert.return_value = mock_result

            parser = PDFParser()

            with patch.object(parser, "_get_converter", return_value=mock_converter):
                result = await parser.parse(temp_path)

            assert result.metadata.get("source") == str(temp_path)
            assert result.metadata.get("ocr_enabled") is True
            assert result.parse_time_ms is not None
            assert result.parse_time_ms >= 0

        finally:
            os.unlink(temp_path)
