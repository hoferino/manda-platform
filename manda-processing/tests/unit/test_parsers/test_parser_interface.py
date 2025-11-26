"""
Unit tests for parser interface and data models.
Story: E3.2 - Integrate Docling for Document Parsing (AC: #5, #6)
"""

import pytest
from pathlib import Path
from pydantic import ValidationError


class TestChunkData:
    """Tests for ChunkData model."""

    def test_chunk_data_creation(self) -> None:
        """Test basic ChunkData creation."""
        from src.parsers import ChunkData

        chunk = ChunkData(
            content="Test content",
            chunk_type="text",
            chunk_index=0,
        )

        assert chunk.content == "Test content"
        assert chunk.chunk_type == "text"
        assert chunk.chunk_index == 0
        assert chunk.page_number is None
        assert chunk.sheet_name is None
        assert chunk.metadata == {}

    def test_chunk_data_with_metadata(self) -> None:
        """Test ChunkData with full metadata."""
        from src.parsers import ChunkData

        chunk = ChunkData(
            content="Financial data",
            chunk_type="table",
            chunk_index=5,
            page_number=3,
            sheet_name="Revenue",
            cell_reference="A1:D10",
            metadata={"source": "report.xlsx", "is_table": True},
            token_count=150,
        )

        assert chunk.page_number == 3
        assert chunk.sheet_name == "Revenue"
        assert chunk.cell_reference == "A1:D10"
        assert chunk.metadata["source"] == "report.xlsx"
        assert chunk.token_count == 150

    def test_chunk_type_validation(self) -> None:
        """Test that chunk_type validates against allowed values."""
        from src.parsers import ChunkData

        # Valid types
        for chunk_type in ["text", "table", "formula", "image"]:
            chunk = ChunkData(
                content="Test",
                chunk_type=chunk_type,  # type: ignore
                chunk_index=0,
            )
            assert chunk.chunk_type == chunk_type

        # Invalid type should raise
        with pytest.raises(ValidationError):
            ChunkData(
                content="Test",
                chunk_type="invalid",  # type: ignore
                chunk_index=0,
            )


class TestTableData:
    """Tests for TableData model."""

    def test_table_data_creation(self) -> None:
        """Test basic TableData creation."""
        from src.parsers import TableData

        table = TableData(
            content="| A | B |\n|---|---|\n| 1 | 2 |",
            rows=2,
            cols=2,
        )

        assert table.content.startswith("|")
        assert table.rows == 2
        assert table.cols == 2
        assert table.headers == []

    def test_table_data_with_headers(self) -> None:
        """Test TableData with headers and raw data."""
        from src.parsers import TableData

        table = TableData(
            content="| Name | Value |\n|---|---|\n| A | 100 |",
            rows=2,
            cols=2,
            headers=["Name", "Value"],
            sheet_name="Data",
            page_number=1,
            data=[["A", "100"]],
        )

        assert table.headers == ["Name", "Value"]
        assert table.sheet_name == "Data"
        assert table.data == [["A", "100"]]


class TestFormulaData:
    """Tests for FormulaData model."""

    def test_formula_data_creation(self) -> None:
        """Test basic FormulaData creation."""
        from src.parsers import FormulaData

        formula = FormulaData(
            formula="=SUM(A1:A10)",
            cell_reference="A11",
            sheet_name="Sheet1",
        )

        assert formula.formula == "=SUM(A1:A10)"
        assert formula.cell_reference == "A11"
        assert formula.sheet_name == "Sheet1"
        assert formula.result_value is None
        assert formula.references == []

    def test_formula_data_with_references(self) -> None:
        """Test FormulaData with cell references extracted."""
        from src.parsers import FormulaData

        formula = FormulaData(
            formula="=B5*C5+D5",
            cell_reference="E5",
            sheet_name="Revenue",
            result_value="15000",
            references=["B5", "C5", "D5"],
        )

        assert formula.result_value == "15000"
        assert formula.references == ["B5", "C5", "D5"]


class TestParseResult:
    """Tests for ParseResult model."""

    def test_parse_result_creation(self) -> None:
        """Test basic ParseResult creation."""
        from src.parsers import ParseResult, ChunkData

        result = ParseResult(
            chunks=[
                ChunkData(content="Test", chunk_type="text", chunk_index=0)
            ],
            tables=[],
            formulas=[],
        )

        assert len(result.chunks) == 1
        assert result.tables == []
        assert result.formulas == []
        assert result.metadata == {}
        assert result.errors == []

    def test_parse_result_with_stats(self) -> None:
        """Test ParseResult with processing stats."""
        from src.parsers import ParseResult

        result = ParseResult(
            chunks=[],
            tables=[],
            formulas=[],
            metadata={"file_type": "pdf"},
            total_pages=10,
            total_sheets=None,
            parse_time_ms=2500,
            errors=["Page 5 failed to parse"],
            warnings=["Some images could not be OCR'd"],
        )

        assert result.total_pages == 10
        assert result.parse_time_ms == 2500
        assert len(result.errors) == 1
        assert len(result.warnings) == 1


class TestParseErrors:
    """Tests for parser exception classes."""

    def test_parse_error(self) -> None:
        """Test base ParseError."""
        from src.parsers import ParseError

        error = ParseError(
            "Failed to parse document",
            file_path=Path("/test/doc.pdf"),
            details={"reason": "corrupt"},
        )

        assert "Failed to parse" in str(error)
        assert error.file_path == Path("/test/doc.pdf")
        assert error.details["reason"] == "corrupt"

    def test_unsupported_file_type_error(self) -> None:
        """Test UnsupportedFileTypeError."""
        from src.parsers import UnsupportedFileTypeError

        error = UnsupportedFileTypeError(
            "Unsupported type: .xyz",
            file_path=Path("/test/doc.xyz"),
        )

        assert isinstance(error, Exception)
        assert ".xyz" in str(error)

    def test_corrupt_file_error(self) -> None:
        """Test CorruptFileError."""
        from src.parsers import CorruptFileError

        error = CorruptFileError(
            "File is corrupt",
            file_path=Path("/test/corrupt.pdf"),
        )

        assert isinstance(error, Exception)

    def test_file_too_large_error(self) -> None:
        """Test FileTooLargeError."""
        from src.parsers import FileTooLargeError

        error = FileTooLargeError(
            "File exceeds 100MB limit",
            details={"size_mb": 150},
        )

        assert error.details["size_mb"] == 150


class TestSupportedTypes:
    """Tests for file type detection utilities."""

    def test_get_file_category_mime_types(self) -> None:
        """Test category detection from MIME types."""
        from src.parsers import get_file_category

        assert get_file_category("application/pdf") == "pdf"
        assert get_file_category("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") == "excel"
        assert get_file_category("application/vnd.ms-excel") == "excel"
        assert get_file_category("application/vnd.openxmlformats-officedocument.wordprocessingml.document") == "word"
        assert get_file_category("image/png") == "image"

    def test_get_file_category_extensions(self) -> None:
        """Test category detection from extensions."""
        from src.parsers import get_file_category

        assert get_file_category(".pdf") == "pdf"
        assert get_file_category("pdf") == "pdf"
        assert get_file_category(".xlsx") == "excel"
        assert get_file_category(".XLSX") == "excel"
        assert get_file_category(".docx") == "word"
        assert get_file_category(".png") == "image"

    def test_get_file_category_unknown(self) -> None:
        """Test that unknown types return None."""
        from src.parsers import get_file_category

        assert get_file_category(".xyz") is None
        assert get_file_category("application/unknown") is None

    def test_is_supported(self) -> None:
        """Test is_supported utility."""
        from src.parsers import is_supported

        assert is_supported("application/pdf") is True
        assert is_supported(".xlsx") is True
        assert is_supported(".xyz") is False
        assert is_supported("text/plain") is False
