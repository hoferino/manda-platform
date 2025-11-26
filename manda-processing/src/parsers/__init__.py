"""
Document parsing module for Manda processing service.
Story: E3.2 - Integrate Docling for Document Parsing (AC: #1, #5)

This module provides a unified interface for parsing various document types:
- Excel (.xlsx, .xls) with formula preservation
- PDF with native text and OCR support
- Word (.docx) documents

The parser returns structured data including:
- Text chunks with semantic boundaries
- Table data with row/column structure
- Formula data with cell references (Excel)
- Rich metadata for source attribution
"""

from typing import Literal, Optional, Protocol
from pathlib import Path

from pydantic import BaseModel, Field


# Chunk types matching the tech spec and database schema
ChunkType = Literal["text", "table", "formula", "image"]


class ChunkData(BaseModel):
    """
    Represents a single chunk of parsed document content.

    Chunks are the atomic units for embedding and retrieval.
    Each chunk includes source attribution metadata for traceability.
    """

    content: str
    chunk_type: ChunkType
    chunk_index: int
    page_number: Optional[int] = None
    sheet_name: Optional[str] = None
    cell_reference: Optional[str] = None
    metadata: dict = Field(default_factory=dict)

    # Token count for the content (computed during chunking)
    token_count: Optional[int] = None


class TableData(BaseModel):
    """
    Represents an extracted table from a document.

    Tables are stored both as structured data and as markdown
    for different use cases (analysis vs. embedding).
    """

    content: str  # Markdown representation
    rows: int
    cols: int
    headers: list[str] = Field(default_factory=list)
    sheet_name: Optional[str] = None
    page_number: Optional[int] = None

    # Raw data for structured queries
    data: list[list[str]] = Field(default_factory=list)


class FormulaData(BaseModel):
    """
    Represents an Excel formula with context.

    Formulas are valuable for understanding financial models
    and dependencies between cells.
    """

    formula: str  # e.g., "=SUM(A1:A10)"
    cell_reference: str  # e.g., "B15"
    sheet_name: str
    result_value: Optional[str] = None

    # Dependencies for graph building
    references: list[str] = Field(default_factory=list)  # Cells referenced by formula


class ParseResult(BaseModel):
    """
    Complete result from parsing a document.

    Contains all extracted content organized by type,
    plus metadata about the parsing process.
    """

    chunks: list[ChunkData]
    tables: list[TableData]
    formulas: list[FormulaData]
    metadata: dict = Field(default_factory=dict)

    # Processing stats
    total_pages: Optional[int] = None
    total_sheets: Optional[int] = None
    parse_time_ms: Optional[int] = None

    # Error tracking for partial failures
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ParseError(Exception):
    """Base exception for parsing errors."""

    def __init__(self, message: str, file_path: Optional[Path] = None, details: Optional[dict] = None):
        self.message = message
        self.file_path = file_path
        self.details = details or {}
        super().__init__(message)


class UnsupportedFileTypeError(ParseError):
    """Raised when attempting to parse an unsupported file type."""
    pass


class CorruptFileError(ParseError):
    """Raised when a file is corrupt or cannot be read."""
    pass


class FileTooLargeError(ParseError):
    """Raised when a file exceeds the maximum allowed size."""
    pass


class DocumentParser(Protocol):
    """
    Protocol defining the interface for document parsers.

    All parser implementations must conform to this interface,
    enabling consistent usage across different file types.
    """

    async def parse(self, file_path: Path, file_type: str) -> ParseResult:
        """
        Parse a document and return structured content.

        Args:
            file_path: Path to the document file
            file_type: MIME type or file extension

        Returns:
            ParseResult containing chunks, tables, formulas, and metadata

        Raises:
            ParseError: If parsing fails
            UnsupportedFileTypeError: If file type is not supported
            CorruptFileError: If file is corrupt
        """
        ...

    def supports(self, file_type: str) -> bool:
        """
        Check if this parser supports the given file type.

        Args:
            file_type: MIME type or file extension

        Returns:
            True if this parser can handle the file type
        """
        ...


# Supported MIME types and extensions
SUPPORTED_MIME_TYPES = {
    # Excel
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    # PDF
    "application/pdf": "pdf",
    # Word
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    # Images (for OCR)
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/tiff": "tiff",
}

SUPPORTED_EXTENSIONS = {
    ".xlsx": "excel",
    ".xls": "excel",
    ".pdf": "pdf",
    ".docx": "word",
    ".doc": "word",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".tiff": "image",
}


def get_file_category(file_type: str) -> Optional[str]:
    """
    Get the category of a file based on MIME type or extension.

    Args:
        file_type: MIME type or file extension

    Returns:
        Category string ('excel', 'pdf', 'word', 'image') or None
    """
    # Check MIME type
    if file_type in SUPPORTED_MIME_TYPES:
        ext = SUPPORTED_MIME_TYPES[file_type]
        return SUPPORTED_EXTENSIONS.get(f".{ext}")

    # Check extension (with or without dot)
    ext = file_type if file_type.startswith(".") else f".{file_type}"
    return SUPPORTED_EXTENSIONS.get(ext.lower())


def is_supported(file_type: str) -> bool:
    """Check if a file type is supported for parsing."""
    return get_file_category(file_type) is not None


__all__ = [
    # Data models
    "ChunkData",
    "TableData",
    "FormulaData",
    "ParseResult",
    "ChunkType",
    # Protocol
    "DocumentParser",
    # Exceptions
    "ParseError",
    "UnsupportedFileTypeError",
    "CorruptFileError",
    "FileTooLargeError",
    # Utilities
    "SUPPORTED_MIME_TYPES",
    "SUPPORTED_EXTENSIONS",
    "get_file_category",
    "is_supported",
]
