"""
Semantic text chunking for document processing.
Story: E3.2 - Integrate Docling for Document Parsing (AC: #4)

This module implements intelligent chunking that:
- Respects semantic boundaries (paragraphs, sentences)
- Maintains chunk sizes within token limits (512-1024 tokens)
- Preserves table integrity (never splits tables)
- Includes source metadata in each chunk
"""

import re
from typing import Optional

import structlog
import tiktoken

from src.config import get_settings
from src.parsers import ChunkData, ChunkType

logger = structlog.get_logger(__name__)


class Chunker:
    """
    Semantic text chunker with token-based size limits.

    Uses tiktoken for accurate token counting compatible with
    OpenAI embedding models.
    """

    def __init__(
        self,
        min_tokens: Optional[int] = None,
        max_tokens: Optional[int] = None,
        overlap_tokens: Optional[int] = None,
        encoding_name: str = "cl100k_base",  # GPT-4 / text-embedding-3 encoding
    ):
        """
        Initialize the chunker.

        Args:
            min_tokens: Minimum tokens per chunk (default from config: 512)
            max_tokens: Maximum tokens per chunk (default from config: 1024)
            overlap_tokens: Token overlap between chunks (default from config: 50)
            encoding_name: Tiktoken encoding to use
        """
        settings = get_settings()

        self.min_tokens = min_tokens or settings.chunk_min_tokens
        self.max_tokens = max_tokens or settings.chunk_max_tokens
        self.overlap_tokens = overlap_tokens or settings.chunk_overlap_tokens

        # Initialize tokenizer
        try:
            self.encoding = tiktoken.get_encoding(encoding_name)
        except Exception:
            # Fallback to cl100k_base if specified encoding not found
            self.encoding = tiktoken.get_encoding("cl100k_base")
            logger.warning(
                "Encoding not found, using fallback",
                requested=encoding_name,
                fallback="cl100k_base",
            )

    def count_tokens(self, text: str) -> int:
        """
        Count the number of tokens in a text string.

        Args:
            text: The text to tokenize

        Returns:
            Number of tokens
        """
        if not text:
            return 0
        return len(self.encoding.encode(text))

    def chunk_text(
        self,
        text: str,
        chunk_type: ChunkType = "text",
        base_metadata: Optional[dict] = None,
        page_number: Optional[int] = None,
        sheet_name: Optional[str] = None,
    ) -> list[ChunkData]:
        """
        Split text into semantic chunks within token limits.

        Args:
            text: The text to chunk
            chunk_type: Type of content being chunked
            base_metadata: Metadata to include in all chunks
            page_number: Source page number
            sheet_name: Source sheet name (for Excel)

        Returns:
            List of ChunkData objects
        """
        if not text or not text.strip():
            return []

        base_metadata = base_metadata or {}
        chunks: list[ChunkData] = []

        # Split into paragraphs first (preserve structure)
        paragraphs = self._split_into_paragraphs(text)

        current_chunk_parts: list[str] = []
        current_tokens = 0
        chunk_index = 0

        for paragraph in paragraphs:
            para_tokens = self.count_tokens(paragraph)

            # If single paragraph exceeds max, split it further
            if para_tokens > self.max_tokens:
                # Flush current chunk first
                if current_chunk_parts:
                    chunk_text = "\n\n".join(current_chunk_parts)
                    chunks.append(
                        self._create_chunk(
                            content=chunk_text,
                            chunk_type=chunk_type,
                            chunk_index=chunk_index,
                            token_count=current_tokens,
                            base_metadata=base_metadata,
                            page_number=page_number,
                            sheet_name=sheet_name,
                        )
                    )
                    chunk_index += 1
                    current_chunk_parts = []
                    current_tokens = 0

                # Split large paragraph into sentences
                sentence_chunks = self._split_large_paragraph(paragraph)
                for sentence_chunk in sentence_chunks:
                    chunks.append(
                        self._create_chunk(
                            content=sentence_chunk,
                            chunk_type=chunk_type,
                            chunk_index=chunk_index,
                            token_count=self.count_tokens(sentence_chunk),
                            base_metadata=base_metadata,
                            page_number=page_number,
                            sheet_name=sheet_name,
                        )
                    )
                    chunk_index += 1
                continue

            # Check if adding this paragraph would exceed max
            potential_tokens = current_tokens + para_tokens
            if current_chunk_parts:
                potential_tokens += 2  # Account for paragraph separator

            if potential_tokens > self.max_tokens:
                # Create chunk from current parts
                if current_chunk_parts:
                    chunk_text = "\n\n".join(current_chunk_parts)
                    chunks.append(
                        self._create_chunk(
                            content=chunk_text,
                            chunk_type=chunk_type,
                            chunk_index=chunk_index,
                            token_count=current_tokens,
                            base_metadata=base_metadata,
                            page_number=page_number,
                            sheet_name=sheet_name,
                        )
                    )
                    chunk_index += 1

                # Start new chunk with overlap if configured
                if self.overlap_tokens > 0 and current_chunk_parts:
                    overlap_text = self._get_overlap_text(
                        "\n\n".join(current_chunk_parts)
                    )
                    if overlap_text:
                        current_chunk_parts = [overlap_text, paragraph]
                        current_tokens = (
                            self.count_tokens(overlap_text) + para_tokens + 2
                        )
                    else:
                        current_chunk_parts = [paragraph]
                        current_tokens = para_tokens
                else:
                    current_chunk_parts = [paragraph]
                    current_tokens = para_tokens
            else:
                current_chunk_parts.append(paragraph)
                current_tokens = potential_tokens

        # Don't forget the last chunk
        if current_chunk_parts:
            chunk_text = "\n\n".join(current_chunk_parts)
            chunks.append(
                self._create_chunk(
                    content=chunk_text,
                    chunk_type=chunk_type,
                    chunk_index=chunk_index,
                    token_count=current_tokens,
                    base_metadata=base_metadata,
                    page_number=page_number,
                    sheet_name=sheet_name,
                )
            )

        logger.debug(
            "Text chunked",
            input_tokens=self.count_tokens(text),
            num_chunks=len(chunks),
            avg_tokens=sum(c.token_count or 0 for c in chunks) // max(len(chunks), 1),
        )

        return chunks

    def chunk_table(
        self,
        table_content: str,
        chunk_index: int,
        base_metadata: Optional[dict] = None,
        page_number: Optional[int] = None,
        sheet_name: Optional[str] = None,
    ) -> list[ChunkData]:
        """
        Chunk a table, keeping it whole if possible.

        Tables are special - we try to keep them as single chunks.
        Only split if absolutely necessary (table exceeds max tokens).

        Args:
            table_content: Markdown representation of the table
            chunk_index: Starting chunk index
            base_metadata: Metadata to include
            page_number: Source page number
            sheet_name: Source sheet name

        Returns:
            List of ChunkData objects (usually 1, unless table is huge)
        """
        base_metadata = base_metadata or {}
        table_tokens = self.count_tokens(table_content)

        # If table fits in one chunk, keep it whole
        if table_tokens <= self.max_tokens:
            return [
                self._create_chunk(
                    content=table_content,
                    chunk_type="table",
                    chunk_index=chunk_index,
                    token_count=table_tokens,
                    base_metadata={**base_metadata, "is_complete_table": True},
                    page_number=page_number,
                    sheet_name=sheet_name,
                )
            ]

        # Table is too large - split by rows while preserving header
        logger.info(
            "Splitting large table",
            tokens=table_tokens,
            max_tokens=self.max_tokens,
        )

        chunks: list[ChunkData] = []
        lines = table_content.strip().split("\n")

        # Identify header (first row + separator)
        header_lines: list[str] = []
        data_start = 0

        for i, line in enumerate(lines):
            if re.match(r"^\|[-:| ]+\|$", line):  # Separator line
                header_lines = lines[: i + 1]
                data_start = i + 1
                break

        if not header_lines:
            # No markdown table format detected, treat as plain text
            return self.chunk_text(
                table_content,
                chunk_type="table",
                base_metadata=base_metadata,
                page_number=page_number,
                sheet_name=sheet_name,
            )

        header_text = "\n".join(header_lines)
        header_tokens = self.count_tokens(header_text)

        # Split data rows
        current_rows: list[str] = []
        current_tokens = header_tokens

        for line in lines[data_start:]:
            row_tokens = self.count_tokens(line)

            if current_tokens + row_tokens + 1 > self.max_tokens:
                # Create chunk with header + current rows
                if current_rows:
                    chunk_text = header_text + "\n" + "\n".join(current_rows)
                    chunks.append(
                        self._create_chunk(
                            content=chunk_text,
                            chunk_type="table",
                            chunk_index=chunk_index,
                            token_count=current_tokens,
                            base_metadata={
                                **base_metadata,
                                "is_complete_table": False,
                                "table_part": len(chunks) + 1,
                            },
                            page_number=page_number,
                            sheet_name=sheet_name,
                        )
                    )
                    chunk_index += 1
                    current_rows = []
                    current_tokens = header_tokens

            current_rows.append(line)
            current_tokens += row_tokens + 1

        # Last chunk
        if current_rows:
            chunk_text = header_text + "\n" + "\n".join(current_rows)
            chunks.append(
                self._create_chunk(
                    content=chunk_text,
                    chunk_type="table",
                    chunk_index=chunk_index,
                    token_count=current_tokens,
                    base_metadata={
                        **base_metadata,
                        "is_complete_table": len(chunks) == 0,
                        "table_part": len(chunks) + 1,
                    },
                    page_number=page_number,
                    sheet_name=sheet_name,
                )
            )

        return chunks

    def _split_into_paragraphs(self, text: str) -> list[str]:
        """Split text into paragraphs at double newlines."""
        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Split on double newlines (paragraph boundaries)
        paragraphs = re.split(r"\n\s*\n", text)

        # Clean up and filter empty
        return [p.strip() for p in paragraphs if p.strip()]

    def _split_large_paragraph(self, paragraph: str) -> list[str]:
        """Split a large paragraph into sentence-based chunks."""
        # Split into sentences
        sentences = self._split_into_sentences(paragraph)

        chunks: list[str] = []
        current_sentences: list[str] = []
        current_tokens = 0

        for sentence in sentences:
            sentence_tokens = self.count_tokens(sentence)

            # If single sentence exceeds max, we have to split it (rare)
            if sentence_tokens > self.max_tokens:
                if current_sentences:
                    chunks.append(" ".join(current_sentences))
                    current_sentences = []
                    current_tokens = 0

                # Force-split very long sentence by tokens
                chunks.extend(self._force_split_by_tokens(sentence))
                continue

            potential_tokens = current_tokens + sentence_tokens
            if current_sentences:
                potential_tokens += 1  # Space between sentences

            if potential_tokens > self.max_tokens:
                chunks.append(" ".join(current_sentences))
                current_sentences = [sentence]
                current_tokens = sentence_tokens
            else:
                current_sentences.append(sentence)
                current_tokens = potential_tokens

        if current_sentences:
            chunks.append(" ".join(current_sentences))

        return chunks

    def _split_into_sentences(self, text: str) -> list[str]:
        """Split text into sentences."""
        # Simple sentence splitting - handles common cases
        # Pattern matches sentence-ending punctuation followed by space and capital
        pattern = r"(?<=[.!?])\s+(?=[A-Z])"
        sentences = re.split(pattern, text)
        return [s.strip() for s in sentences if s.strip()]

    def _force_split_by_tokens(self, text: str) -> list[str]:
        """Force-split text that exceeds max tokens (last resort)."""
        tokens = self.encoding.encode(text)
        chunks: list[str] = []

        # Calculate step size, ensuring it's at least 1
        step = max(1, self.max_tokens - self.overlap_tokens)

        for i in range(0, len(tokens), step):
            chunk_tokens = tokens[i : i + self.max_tokens]
            chunk_text = self.encoding.decode(chunk_tokens)
            chunks.append(chunk_text)

        return chunks

    def _get_overlap_text(self, text: str) -> str:
        """Get the last N tokens of text for overlap."""
        if self.overlap_tokens <= 0:
            return ""

        tokens = self.encoding.encode(text)
        if len(tokens) <= self.overlap_tokens:
            return text

        overlap_tokens = tokens[-self.overlap_tokens :]
        return self.encoding.decode(overlap_tokens)

    def _create_chunk(
        self,
        content: str,
        chunk_type: ChunkType,
        chunk_index: int,
        token_count: int,
        base_metadata: dict,
        page_number: Optional[int],
        sheet_name: Optional[str],
    ) -> ChunkData:
        """Create a ChunkData object with all metadata."""
        return ChunkData(
            content=content,
            chunk_type=chunk_type,
            chunk_index=chunk_index,
            token_count=token_count,
            page_number=page_number,
            sheet_name=sheet_name,
            metadata=base_metadata,
        )


# Module-level chunker instance for convenience
_default_chunker: Optional[Chunker] = None


def get_chunker() -> Chunker:
    """Get or create the default chunker instance."""
    global _default_chunker
    if _default_chunker is None:
        _default_chunker = Chunker()
    return _default_chunker


__all__ = ["Chunker", "get_chunker"]
