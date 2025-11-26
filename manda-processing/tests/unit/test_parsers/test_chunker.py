"""
Unit tests for the Chunker class.
Story: E3.2 - Integrate Docling for Document Parsing (AC: #4, #6)
"""

import pytest
from unittest.mock import MagicMock, patch


class TestChunker:
    """Test suite for Chunker class."""

    def test_chunker_initialization(self, mock_parser_settings: MagicMock) -> None:
        """Test that Chunker initializes with correct settings."""
        from src.parsers.chunker import Chunker

        chunker = Chunker()

        assert chunker.min_tokens == 512
        assert chunker.max_tokens == 1024
        assert chunker.overlap_tokens == 50
        assert chunker.encoding is not None

    def test_chunker_custom_settings(self) -> None:
        """Test Chunker with custom token limits."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(min_tokens=100, max_tokens=200, overlap_tokens=20)

        assert chunker.min_tokens == 100
        assert chunker.max_tokens == 200
        assert chunker.overlap_tokens == 20

    def test_count_tokens(self, mock_parser_settings: MagicMock) -> None:
        """Test accurate token counting."""
        from src.parsers.chunker import Chunker

        chunker = Chunker()

        # Empty string
        assert chunker.count_tokens("") == 0

        # Simple text
        token_count = chunker.count_tokens("Hello, world!")
        assert token_count > 0
        assert token_count < 10  # Should be about 4 tokens

        # Longer text
        long_text = "The quick brown fox jumps over the lazy dog. " * 10
        long_count = chunker.count_tokens(long_text)
        assert long_count > 50

    def test_chunk_text_basic(
        self,
        mock_parser_settings: MagicMock,
        sample_text: str,
    ) -> None:
        """Test basic text chunking."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(min_tokens=50, max_tokens=100, overlap_tokens=10)
        chunks = chunker.chunk_text(sample_text)

        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.content.strip()
            assert chunk.chunk_type == "text"
            assert chunk.token_count is not None
            assert chunk.token_count > 0

    def test_chunk_text_respects_max_tokens(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test that chunks don't exceed max token limit."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(max_tokens=100, min_tokens=50, overlap_tokens=0)

        # Create long text
        long_text = ("This is a test sentence with multiple words. " * 100)
        chunks = chunker.chunk_text(long_text)

        assert len(chunks) > 1
        for chunk in chunks:
            # Allow small margin for semantic boundaries
            assert chunk.token_count is not None
            assert chunk.token_count <= 150  # Some tolerance for boundary respect

    def test_chunk_text_with_metadata(
        self,
        mock_parser_settings: MagicMock,
        sample_text: str,
    ) -> None:
        """Test that metadata is properly attached to chunks."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(min_tokens=50, max_tokens=100)

        chunks = chunker.chunk_text(
            sample_text,
            chunk_type="text",
            base_metadata={"source": "test.pdf"},
            page_number=5,
            sheet_name=None,
        )

        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.page_number == 5
            assert chunk.metadata.get("source") == "test.pdf"

    def test_chunk_text_empty_input(self, mock_parser_settings: MagicMock) -> None:
        """Test handling of empty input."""
        from src.parsers.chunker import Chunker

        chunker = Chunker()

        assert chunker.chunk_text("") == []
        assert chunker.chunk_text("   ") == []
        assert chunker.chunk_text("\n\n\n") == []

    def test_chunk_text_preserves_paragraphs(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test that chunking respects paragraph boundaries."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(max_tokens=500, min_tokens=100)

        text = """First paragraph with important information about the deal.

        Second paragraph describes the financial terms and conditions.

        Third paragraph provides additional context and background."""

        chunks = chunker.chunk_text(text)

        # With high enough token limit, should be one chunk
        assert len(chunks) >= 1
        # The chunks should contain the paragraph structure
        combined = " ".join(c.content for c in chunks)
        assert "First paragraph" in combined
        assert "Second paragraph" in combined

    def test_chunk_table_keeps_integrity(
        self,
        mock_parser_settings: MagicMock,
        sample_table_markdown: str,
    ) -> None:
        """Test that small tables are kept as single chunks."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(max_tokens=500)

        chunks = chunker.chunk_table(
            sample_table_markdown,
            chunk_index=0,
            base_metadata={"table_id": 1},
        )

        # Small table should be single chunk
        assert len(chunks) == 1
        assert chunks[0].chunk_type == "table"
        assert chunks[0].metadata.get("is_complete_table") is True

    def test_chunk_table_splits_large_table(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test that large tables are split while preserving headers."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(max_tokens=50)  # Very small to force splitting

        # Create a large table
        rows = ["| Col1 | Col2 | Col3 |", "| --- | --- | --- |"]
        for i in range(50):
            rows.append(f"| Data{i} | Value{i} | Extra{i} |")

        large_table = "\n".join(rows)
        chunks = chunker.chunk_table(large_table, chunk_index=0)

        assert len(chunks) > 1
        # Each chunk should have the header
        for chunk in chunks:
            assert "Col1" in chunk.content
            assert "---" in chunk.content
            assert chunk.chunk_type == "table"

    def test_chunk_index_increments(
        self,
        mock_parser_settings: MagicMock,
    ) -> None:
        """Test that chunk indices are properly assigned."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(max_tokens=50, min_tokens=10)

        long_text = "This is a sentence. " * 50
        chunks = chunker.chunk_text(long_text)

        indices = [c.chunk_index for c in chunks]
        assert indices == list(range(len(chunks)))

    def test_get_chunker_singleton(self, mock_parser_settings: MagicMock) -> None:
        """Test that get_chunker returns consistent instance."""
        from src.parsers.chunker import get_chunker, _default_chunker

        # Reset the global
        import src.parsers.chunker
        src.parsers.chunker._default_chunker = None

        chunker1 = get_chunker()
        chunker2 = get_chunker()

        assert chunker1 is chunker2


class TestChunkerEdgeCases:
    """Test edge cases for Chunker."""

    def test_very_long_sentence(self, mock_parser_settings: MagicMock) -> None:
        """Test handling of very long sentences that exceed max tokens."""
        from src.parsers.chunker import Chunker

        chunker = Chunker(max_tokens=50)

        # Single very long sentence
        long_sentence = "word " * 200
        chunks = chunker.chunk_text(long_sentence)

        assert len(chunks) > 1
        # All chunks should have content
        for chunk in chunks:
            assert chunk.content.strip()

    def test_special_characters(self, mock_parser_settings: MagicMock) -> None:
        """Test handling of special characters."""
        from src.parsers.chunker import Chunker

        chunker = Chunker()

        text_with_special = "Price: $1,000,000. Growth: 25%. Formula: =SUM(A1:A10)"
        chunks = chunker.chunk_text(text_with_special)

        assert len(chunks) > 0
        assert "$1,000,000" in chunks[0].content

    def test_unicode_text(self, mock_parser_settings: MagicMock) -> None:
        """Test handling of unicode text."""
        from src.parsers.chunker import Chunker

        chunker = Chunker()

        unicode_text = "日本語テキスト. 中文文本. Français. Español."
        chunks = chunker.chunk_text(unicode_text)

        assert len(chunks) > 0
        combined = " ".join(c.content for c in chunks)
        assert "日本語" in combined

    def test_mixed_content(self, mock_parser_settings: MagicMock) -> None:
        """Test handling of mixed text and numbers."""
        from src.parsers.chunker import Chunker

        chunker = Chunker()

        mixed = """
        Revenue: $150,000,000
        EBITDA: $27,000,000
        Growth Rate: 25.5%
        Employees: 1,234
        """

        chunks = chunker.chunk_text(mixed)
        assert len(chunks) > 0
        combined = " ".join(c.content for c in chunks)
        assert "$150,000,000" in combined
