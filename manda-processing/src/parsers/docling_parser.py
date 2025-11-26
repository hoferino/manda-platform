"""
Docling-based document parser implementation.
Story: E3.2 - Integrate Docling for Document Parsing (AC: #1, #3, #5)

This module wraps the Docling library to provide:
- Unified parsing interface for PDF, Excel, Word documents
- OCR support for scanned documents
- Rich metadata extraction
- Integration with our chunking strategy
"""

import asyncio
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import Any, Optional

import structlog
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode

from src.config import Settings, get_settings
from src.parsers import (
    ChunkData,
    ChunkType,
    CorruptFileError,
    FileTooLargeError,
    FormulaData,
    ParseError,
    ParseResult,
    TableData,
    UnsupportedFileTypeError,
    get_file_category,
    is_supported,
)
from src.parsers.chunker import Chunker, get_chunker

logger = structlog.get_logger(__name__)


class DoclingParser:
    """
    Document parser using Docling for text extraction.

    Handles PDF, Excel, and Word documents with consistent
    output format for downstream processing.
    """

    def __init__(
        self,
        config: Optional[Settings] = None,
        chunker: Optional[Chunker] = None,
    ):
        """
        Initialize the Docling parser.

        Args:
            config: Application settings (uses defaults if not provided)
            chunker: Chunker instance for text splitting
        """
        self.config = config or get_settings()
        self.chunker = chunker or get_chunker()

        # Configure Docling converter
        self._setup_converter()

        # Ensure temp directory exists
        os.makedirs(self.config.parser_temp_dir, exist_ok=True)

        logger.info(
            "DoclingParser initialized",
            ocr_enabled=self.config.parser_ocr_enabled,
            max_file_size_mb=self.config.parser_max_file_size_mb,
        )

    def _setup_converter(self) -> None:
        """Set up the Docling document converter with appropriate options."""
        # Configure PDF pipeline options
        pdf_options = PdfPipelineOptions()
        pdf_options.do_ocr = self.config.parser_ocr_enabled
        pdf_options.do_table_structure = True
        pdf_options.table_structure_options.mode = TableFormerMode.ACCURATE

        # Create converter with options
        self.converter = DocumentConverter(
            allowed_formats=[
                InputFormat.PDF,
                InputFormat.DOCX,
                InputFormat.XLSX,
                InputFormat.IMAGE,
            ],
        )

    def supports(self, file_type: str) -> bool:
        """Check if this parser supports the given file type."""
        return is_supported(file_type)

    async def parse(
        self,
        file_path: Path,
        file_type: str,
    ) -> ParseResult:
        """
        Parse a document and return structured content.

        Args:
            file_path: Path to the document file
            file_type: MIME type or file extension

        Returns:
            ParseResult with chunks, tables, formulas, and metadata

        Raises:
            UnsupportedFileTypeError: If file type not supported
            FileTooLargeError: If file exceeds size limit
            CorruptFileError: If file cannot be parsed
            ParseError: For other parsing failures
        """
        start_time = time.perf_counter()

        # Validate file type
        category = get_file_category(file_type)
        if not category:
            raise UnsupportedFileTypeError(
                f"Unsupported file type: {file_type}",
                file_path=file_path,
            )

        # Validate file exists and check size
        if not file_path.exists():
            raise ParseError(f"File not found: {file_path}", file_path=file_path)

        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        if file_size_mb > self.config.parser_max_file_size_mb:
            raise FileTooLargeError(
                f"File size {file_size_mb:.1f}MB exceeds limit of "
                f"{self.config.parser_max_file_size_mb}MB",
                file_path=file_path,
                details={"size_mb": file_size_mb},
            )

        logger.info(
            "Starting document parse",
            file_path=str(file_path),
            file_type=file_type,
            category=category,
            size_mb=f"{file_size_mb:.2f}",
        )

        try:
            # Run Docling conversion in thread pool (it's CPU-bound)
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                self._convert_document,
                file_path,
            )

            # Process based on file category
            if category == "excel":
                parse_result = await self._process_excel(result, file_path)
            elif category == "pdf":
                parse_result = await self._process_pdf(result, file_path)
            elif category == "word":
                parse_result = await self._process_word(result, file_path)
            elif category == "image":
                parse_result = await self._process_image(result, file_path)
            else:
                parse_result = await self._process_generic(result, file_path)

            # Add timing metadata
            parse_time_ms = int((time.perf_counter() - start_time) * 1000)
            parse_result.parse_time_ms = parse_time_ms
            parse_result.metadata["file_type"] = file_type
            parse_result.metadata["file_category"] = category
            parse_result.metadata["file_size_bytes"] = file_path.stat().st_size

            logger.info(
                "Document parsed successfully",
                file_path=str(file_path),
                chunks=len(parse_result.chunks),
                tables=len(parse_result.tables),
                formulas=len(parse_result.formulas),
                parse_time_ms=parse_time_ms,
            )

            return parse_result

        except Exception as e:
            if isinstance(e, ParseError):
                raise

            logger.error(
                "Document parsing failed",
                file_path=str(file_path),
                error=str(e),
                exc_info=True,
            )
            raise CorruptFileError(
                f"Failed to parse document: {str(e)}",
                file_path=file_path,
                details={"original_error": str(e)},
            )

    def _convert_document(self, file_path: Path) -> Any:
        """Convert document using Docling (synchronous)."""
        result = self.converter.convert(str(file_path))
        return result

    async def _process_pdf(
        self,
        docling_result: Any,
        file_path: Path,
    ) -> ParseResult:
        """Process Docling result for PDF documents."""
        chunks: list[ChunkData] = []
        tables: list[TableData] = []
        errors: list[str] = []
        warnings: list[str] = []

        chunk_index = 0
        total_pages = 0

        try:
            # Get the document from result
            doc = docling_result.document

            # Extract text content by pages
            if hasattr(doc, "pages") and doc.pages:
                total_pages = len(doc.pages)

                for page_num, page in enumerate(doc.pages, start=1):
                    # Get page text
                    page_text = self._extract_page_text(page)

                    if page_text.strip():
                        page_chunks = self.chunker.chunk_text(
                            page_text,
                            chunk_type="text",
                            base_metadata={"source_file": file_path.name},
                            page_number=page_num,
                        )
                        for chunk in page_chunks:
                            chunk.chunk_index = chunk_index
                            chunks.append(chunk)
                            chunk_index += 1

                    # Extract tables from page
                    page_tables = self._extract_page_tables(page, page_num, file_path.name)
                    for table in page_tables:
                        tables.append(table)

                        # Also create chunk for table content
                        table_chunks = self.chunker.chunk_table(
                            table.content,
                            chunk_index=chunk_index,
                            base_metadata={"source_file": file_path.name, "is_table": True},
                            page_number=page_num,
                        )
                        for chunk in table_chunks:
                            chunks.append(chunk)
                            chunk_index += 1

            # Fallback: try to get text from export
            if not chunks:
                export_text = docling_result.document.export_to_markdown()
                if export_text.strip():
                    text_chunks = self.chunker.chunk_text(
                        export_text,
                        chunk_type="text",
                        base_metadata={"source_file": file_path.name},
                    )
                    for chunk in text_chunks:
                        chunk.chunk_index = chunk_index
                        chunks.append(chunk)
                        chunk_index += 1

        except Exception as e:
            errors.append(f"Error processing PDF content: {str(e)}")
            logger.warning("PDF processing error", error=str(e), file=str(file_path))

        return ParseResult(
            chunks=chunks,
            tables=tables,
            formulas=[],  # PDFs don't have formulas
            metadata={"source": str(file_path)},
            total_pages=total_pages,
            errors=errors,
            warnings=warnings,
        )

    async def _process_excel(
        self,
        docling_result: Any,
        file_path: Path,
    ) -> ParseResult:
        """Process Docling result for Excel documents."""
        # Excel requires special handling - use openpyxl directly
        # for formula extraction (Docling doesn't preserve formulas)
        from src.parsers.excel_parser import ExcelParser

        excel_parser = ExcelParser(chunker=self.chunker)
        return await excel_parser.parse(file_path, file_type="xlsx")

    async def _process_word(
        self,
        docling_result: Any,
        file_path: Path,
    ) -> ParseResult:
        """Process Docling result for Word documents."""
        chunks: list[ChunkData] = []
        tables: list[TableData] = []
        errors: list[str] = []
        warnings: list[str] = []

        chunk_index = 0

        try:
            # Export to markdown for text content
            doc = docling_result.document
            markdown_content = doc.export_to_markdown()

            if markdown_content.strip():
                text_chunks = self.chunker.chunk_text(
                    markdown_content,
                    chunk_type="text",
                    base_metadata={"source_file": file_path.name},
                )
                for chunk in text_chunks:
                    chunk.chunk_index = chunk_index
                    chunks.append(chunk)
                    chunk_index += 1

            # Extract tables if present
            if hasattr(doc, "tables"):
                for i, table in enumerate(doc.tables):
                    table_data = self._convert_docling_table(table, None, file_path.name)
                    if table_data:
                        tables.append(table_data)

                        # Create chunk for table
                        table_chunks = self.chunker.chunk_table(
                            table_data.content,
                            chunk_index=chunk_index,
                            base_metadata={"source_file": file_path.name, "is_table": True},
                        )
                        for chunk in table_chunks:
                            chunks.append(chunk)
                            chunk_index += 1

        except Exception as e:
            errors.append(f"Error processing Word document: {str(e)}")
            logger.warning("Word processing error", error=str(e), file=str(file_path))

        return ParseResult(
            chunks=chunks,
            tables=tables,
            formulas=[],  # Word doesn't have formulas
            metadata={"source": str(file_path)},
            errors=errors,
            warnings=warnings,
        )

    async def _process_image(
        self,
        docling_result: Any,
        file_path: Path,
    ) -> ParseResult:
        """Process Docling result for images (OCR)."""
        chunks: list[ChunkData] = []
        errors: list[str] = []

        try:
            # Export OCR'd text
            doc = docling_result.document
            ocr_text = doc.export_to_markdown()

            if ocr_text.strip():
                text_chunks = self.chunker.chunk_text(
                    ocr_text,
                    chunk_type="image",  # Mark as image-sourced text
                    base_metadata={
                        "source_file": file_path.name,
                        "ocr_processed": True,
                    },
                )
                for i, chunk in enumerate(text_chunks):
                    chunk.chunk_index = i
                    chunks.append(chunk)

        except Exception as e:
            errors.append(f"Error processing image: {str(e)}")
            logger.warning("Image processing error", error=str(e), file=str(file_path))

        return ParseResult(
            chunks=chunks,
            tables=[],
            formulas=[],
            metadata={"source": str(file_path), "ocr_processed": True},
            errors=errors,
        )

    async def _process_generic(
        self,
        docling_result: Any,
        file_path: Path,
    ) -> ParseResult:
        """Generic processing fallback."""
        chunks: list[ChunkData] = []

        try:
            doc = docling_result.document
            content = doc.export_to_markdown()

            if content.strip():
                text_chunks = self.chunker.chunk_text(
                    content,
                    chunk_type="text",
                    base_metadata={"source_file": file_path.name},
                )
                for i, chunk in enumerate(text_chunks):
                    chunk.chunk_index = i
                    chunks.append(chunk)

        except Exception as e:
            logger.warning("Generic processing error", error=str(e))

        return ParseResult(
            chunks=chunks,
            tables=[],
            formulas=[],
            metadata={"source": str(file_path)},
        )

    def _extract_page_text(self, page: Any) -> str:
        """Extract text content from a Docling page object."""
        try:
            if hasattr(page, "text"):
                return page.text
            if hasattr(page, "export_to_text"):
                return page.export_to_text()
            if hasattr(page, "content"):
                return str(page.content)
            return ""
        except Exception:
            return ""

    def _extract_page_tables(
        self,
        page: Any,
        page_num: int,
        source_file: str,
    ) -> list[TableData]:
        """Extract tables from a Docling page object."""
        tables: list[TableData] = []

        try:
            if hasattr(page, "tables"):
                for table in page.tables:
                    table_data = self._convert_docling_table(table, page_num, source_file)
                    if table_data:
                        tables.append(table_data)
        except Exception as e:
            logger.debug("Error extracting tables from page", error=str(e), page=page_num)

        return tables

    def _convert_docling_table(
        self,
        table: Any,
        page_num: Optional[int],
        source_file: str,
    ) -> Optional[TableData]:
        """Convert a Docling table to our TableData format."""
        try:
            # Try to get markdown representation
            if hasattr(table, "export_to_markdown"):
                content = table.export_to_markdown()
            elif hasattr(table, "to_markdown"):
                content = table.to_markdown()
            else:
                # Fallback: try to build from data
                content = str(table)

            if not content.strip():
                return None

            # Parse table structure
            rows = content.strip().split("\n")
            num_rows = len([r for r in rows if r.strip() and not r.strip().startswith("|---")])
            num_cols = len(rows[0].split("|")) - 2 if rows else 0  # Subtract empty columns from |

            # Extract headers
            headers: list[str] = []
            if rows and "|" in rows[0]:
                headers = [h.strip() for h in rows[0].split("|")[1:-1]]

            return TableData(
                content=content,
                rows=num_rows,
                cols=num_cols,
                headers=headers,
                page_number=page_num,
            )

        except Exception as e:
            logger.debug("Error converting table", error=str(e))
            return None


# Factory function
def create_docling_parser(
    config: Optional[Settings] = None,
    chunker: Optional[Chunker] = None,
) -> DoclingParser:
    """Create a DoclingParser instance."""
    return DoclingParser(config=config, chunker=chunker)


__all__ = ["DoclingParser", "create_docling_parser"]
