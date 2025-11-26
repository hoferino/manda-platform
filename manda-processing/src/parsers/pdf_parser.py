"""
PDF-specific parser with OCR support.
Story: E3.2 - Integrate Docling for Document Parsing (AC: #3)

This module handles PDF files with:
- Native text extraction from digital PDFs
- OCR for scanned documents and embedded images
- Page number tracking in metadata
- Table extraction with structure preservation
"""

import asyncio
import time
from pathlib import Path
from typing import Any, Optional

import structlog

from src.config import Settings, get_settings
from src.parsers import (
    ChunkData,
    CorruptFileError,
    ParseError,
    ParseResult,
    TableData,
)
from src.parsers.chunker import Chunker, get_chunker

logger = structlog.get_logger(__name__)


class PDFParser:
    """
    PDF parser using Docling for text and table extraction.

    This parser provides:
    - Native text extraction for digital PDFs
    - OCR for scanned documents (when enabled)
    - Page-level metadata tracking
    - Table structure preservation
    """

    def __init__(
        self,
        config: Optional[Settings] = None,
        chunker: Optional[Chunker] = None,
    ):
        """
        Initialize the PDF parser.

        Args:
            config: Application settings
            chunker: Chunker instance for text splitting
        """
        self.config = config or get_settings()
        self.chunker = chunker or get_chunker()
        self._converter = None

    def _get_converter(self) -> Any:
        """Lazily initialize the Docling converter."""
        if self._converter is None:
            from docling.document_converter import DocumentConverter
            from docling.datamodel.pipeline_options import (
                PdfPipelineOptions,
                TableFormerMode,
            )
            from docling.datamodel.base_models import InputFormat

            # Configure PDF pipeline
            pdf_options = PdfPipelineOptions()
            pdf_options.do_ocr = self.config.parser_ocr_enabled
            pdf_options.do_table_structure = True
            pdf_options.table_structure_options.mode = TableFormerMode.ACCURATE

            self._converter = DocumentConverter(
                allowed_formats=[InputFormat.PDF],
            )

        return self._converter

    def supports(self, file_type: str) -> bool:
        """Check if this parser supports the given file type."""
        file_type_lower = file_type.lower()
        return "pdf" in file_type_lower

    async def parse(
        self,
        file_path: Path,
        file_type: str = "pdf",
    ) -> ParseResult:
        """
        Parse a PDF file and return structured content.

        Args:
            file_path: Path to the PDF file
            file_type: MIME type or extension

        Returns:
            ParseResult with chunks, tables, and metadata
        """
        start_time = time.perf_counter()
        chunks: list[ChunkData] = []
        tables: list[TableData] = []
        errors: list[str] = []
        warnings: list[str] = []

        chunk_index = 0
        total_pages = 0

        logger.info(
            "Starting PDF parse",
            file=str(file_path),
            ocr_enabled=self.config.parser_ocr_enabled,
        )

        try:
            # Convert document using Docling (CPU-bound, run in executor)
            converter = self._get_converter()
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: converter.convert(str(file_path)),
            )

            doc = result.document

            # Try to get page count
            if hasattr(doc, "pages") and doc.pages:
                total_pages = len(doc.pages)
            elif hasattr(doc, "num_pages"):
                total_pages = doc.num_pages

            # Extract content by page if possible
            if hasattr(doc, "pages") and doc.pages:
                for page_num, page in enumerate(doc.pages, start=1):
                    page_chunks, page_tables = await self._process_page(
                        page,
                        page_num,
                        chunk_index,
                        file_path.name,
                    )
                    chunks.extend(page_chunks)
                    tables.extend(page_tables)
                    chunk_index = max(c.chunk_index for c in page_chunks) + 1 if page_chunks else chunk_index
            else:
                # Fallback: export entire document as markdown
                try:
                    markdown = doc.export_to_markdown()
                    if markdown.strip():
                        doc_chunks = self.chunker.chunk_text(
                            markdown,
                            chunk_type="text",
                            base_metadata={"source_file": file_path.name},
                        )
                        for chunk in doc_chunks:
                            chunk.chunk_index = chunk_index
                            chunks.append(chunk)
                            chunk_index += 1
                except Exception as e:
                    errors.append(f"Error exporting document: {str(e)}")

            # Extract tables from document level if not already done
            if not tables and hasattr(doc, "tables"):
                for i, table in enumerate(doc.tables):
                    table_data = self._convert_table(table, None, file_path.name)
                    if table_data:
                        tables.append(table_data)

                        # Create chunk for table
                        table_chunks = self.chunker.chunk_table(
                            table_data.content,
                            chunk_index=chunk_index,
                            base_metadata={
                                "source_file": file_path.name,
                                "is_table": True,
                            },
                        )
                        for chunk in table_chunks:
                            chunks.append(chunk)
                            chunk_index += 1

            parse_time_ms = int((time.perf_counter() - start_time) * 1000)

            logger.info(
                "PDF parsed successfully",
                file=str(file_path),
                pages=total_pages,
                chunks=len(chunks),
                tables=len(tables),
                parse_time_ms=parse_time_ms,
            )

            return ParseResult(
                chunks=chunks,
                tables=tables,
                formulas=[],  # PDFs don't have formulas
                metadata={
                    "source": str(file_path),
                    "ocr_enabled": self.config.parser_ocr_enabled,
                },
                total_pages=total_pages,
                parse_time_ms=parse_time_ms,
                errors=errors,
                warnings=warnings,
            )

        except Exception as e:
            if isinstance(e, ParseError):
                raise

            logger.error(
                "PDF parsing failed",
                file=str(file_path),
                error=str(e),
                exc_info=True,
            )
            raise CorruptFileError(
                f"Failed to parse PDF: {str(e)}",
                file_path=file_path,
                details={"original_error": str(e)},
            )

    async def _process_page(
        self,
        page: Any,
        page_num: int,
        start_chunk_index: int,
        source_file: str,
    ) -> tuple[list[ChunkData], list[TableData]]:
        """
        Process a single PDF page.

        Returns:
            Tuple of (chunks, tables) from this page
        """
        chunks: list[ChunkData] = []
        tables: list[TableData] = []
        chunk_index = start_chunk_index

        # Extract text from page
        page_text = ""
        try:
            if hasattr(page, "text"):
                page_text = page.text
            elif hasattr(page, "export_to_text"):
                page_text = page.export_to_text()
            elif hasattr(page, "export_to_markdown"):
                page_text = page.export_to_markdown()
            elif hasattr(page, "content"):
                page_text = str(page.content)
        except Exception as e:
            logger.debug("Error extracting page text", page=page_num, error=str(e))

        # Create chunks from page text
        if page_text.strip():
            page_chunks = self.chunker.chunk_text(
                page_text,
                chunk_type="text",
                base_metadata={"source_file": source_file},
                page_number=page_num,
            )
            for chunk in page_chunks:
                chunk.chunk_index = chunk_index
                chunks.append(chunk)
                chunk_index += 1

        # Extract tables from page
        if hasattr(page, "tables"):
            for table in page.tables:
                table_data = self._convert_table(table, page_num, source_file)
                if table_data:
                    tables.append(table_data)

                    # Create chunk for table
                    table_chunks = self.chunker.chunk_table(
                        table_data.content,
                        chunk_index=chunk_index,
                        base_metadata={
                            "source_file": source_file,
                            "is_table": True,
                        },
                        page_number=page_num,
                    )
                    for chunk in table_chunks:
                        chunks.append(chunk)
                        chunk_index += 1

        return chunks, tables

    def _convert_table(
        self,
        table: Any,
        page_num: Optional[int],
        source_file: str,
    ) -> Optional[TableData]:
        """Convert a Docling table to our TableData format."""
        try:
            # Get markdown representation
            content = ""
            if hasattr(table, "export_to_markdown"):
                content = table.export_to_markdown()
            elif hasattr(table, "to_markdown"):
                content = table.to_markdown()
            elif hasattr(table, "data") and table.data:
                content = self._data_to_markdown(table.data)
            else:
                content = str(table)

            if not content.strip():
                return None

            # Parse structure from markdown
            rows = [r for r in content.strip().split("\n") if r.strip()]
            num_rows = len([r for r in rows if not r.strip().startswith("|---")])

            # Count columns from first row
            num_cols = 0
            headers: list[str] = []
            if rows and "|" in rows[0]:
                parts = rows[0].split("|")
                headers = [p.strip() for p in parts if p.strip()]
                num_cols = len(headers)

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

    def _data_to_markdown(self, data: list[list[Any]]) -> str:
        """Convert table data to markdown format."""
        if not data or not data[0]:
            return ""

        lines: list[str] = []

        # Header row
        headers = [str(cell) if cell else "" for cell in data[0]]
        header_line = "| " + " | ".join(headers) + " |"
        lines.append(header_line)

        # Separator
        separator = "| " + " | ".join("---" for _ in headers) + " |"
        lines.append(separator)

        # Data rows
        for row in data[1:]:
            cells = [str(cell) if cell else "" for cell in row]
            # Pad or truncate to match header count
            cells = (cells + [""] * len(headers))[:len(headers)]
            row_line = "| " + " | ".join(cells) + " |"
            lines.append(row_line)

        return "\n".join(lines)


def create_pdf_parser(
    config: Optional[Settings] = None,
    chunker: Optional[Chunker] = None,
) -> PDFParser:
    """Create a PDFParser instance."""
    return PDFParser(config=config, chunker=chunker)


__all__ = ["PDFParser", "create_pdf_parser"]
