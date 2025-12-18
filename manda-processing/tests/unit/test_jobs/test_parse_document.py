"""
Tests for the parse_document job handler.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #6)
"""

import os
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from src.jobs.queue import Job, JobState
from src.parsers import (
    ChunkData,
    ParseResult,
    TableData,
    FormulaData,
    ParseError,
    UnsupportedFileTypeError,
    CorruptFileError,
    FileTooLargeError,
)


# --- Fixtures ---


@pytest.fixture
def sample_document_id() -> UUID:
    """Sample document UUID."""
    return uuid4()


@pytest.fixture
def sample_deal_id() -> str:
    """Sample deal ID."""
    return str(uuid4())


@pytest.fixture
def sample_user_id() -> str:
    """Sample user ID."""
    return str(uuid4())


@pytest.fixture
def sample_job_payload(
    sample_document_id: UUID,
    sample_deal_id: str,
    sample_user_id: str,
) -> dict[str, Any]:
    """Sample job payload for parse_document."""
    return {
        "document_id": str(sample_document_id),
        "gcs_path": "gs://manda-documents-dev/test-project/documents/test.pdf",
        "file_type": "pdf",
        "deal_id": sample_deal_id,
        "user_id": sample_user_id,
        "file_name": "test.pdf",
    }


@pytest.fixture
def sample_job(sample_job_payload: dict[str, Any]) -> Job:
    """Create a sample Job instance."""
    return Job(
        id=str(uuid4()),
        name="document-parse",
        data=sample_job_payload,
        state=JobState.ACTIVE,
        created_on=datetime.now(),
        started_on=datetime.now(),
        retry_count=0,
    )


@pytest.fixture
def sample_chunks() -> list[ChunkData]:
    """Sample chunks returned by parser."""
    return [
        ChunkData(
            content="This is the first chunk of text content.",
            chunk_type="text",
            chunk_index=0,
            page_number=1,
            metadata={"source_file": "test.pdf"},
            token_count=10,
        ),
        ChunkData(
            content="This is the second chunk with table data.",
            chunk_type="table",
            chunk_index=1,
            page_number=1,
            metadata={"source_file": "test.pdf", "is_table": True},
            token_count=12,
        ),
        ChunkData(
            content="Third chunk on page two.",
            chunk_type="text",
            chunk_index=2,
            page_number=2,
            metadata={"source_file": "test.pdf"},
            token_count=8,
        ),
    ]


@pytest.fixture
def sample_tables() -> list[TableData]:
    """Sample tables returned by parser."""
    return [
        TableData(
            content="| Col1 | Col2 |\n|---|---|\n| A | B |",
            rows=2,
            cols=2,
            headers=["Col1", "Col2"],
            page_number=1,
        )
    ]


@pytest.fixture
def sample_parse_result(
    sample_chunks: list[ChunkData],
    sample_tables: list[TableData],
) -> ParseResult:
    """Sample parse result."""
    return ParseResult(
        chunks=sample_chunks,
        tables=sample_tables,
        formulas=[],
        metadata={"source": "test.pdf", "file_type": "pdf"},
        total_pages=2,
        parse_time_ms=1500,
    )


@pytest.fixture
def mock_gcs_client():
    """Create a mock GCS client."""
    mock = MagicMock()

    @asynccontextmanager
    async def mock_download(*args, **kwargs) -> AsyncIterator[Path]:
        # Create an actual temp file for the test
        fd, path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        try:
            yield Path(path)
        finally:
            if os.path.exists(path):
                os.unlink(path)

    mock.download_temp_file = mock_download
    return mock


@pytest.fixture
def mock_db_client():
    """Create a mock Supabase client."""
    mock = MagicMock()
    mock.update_document_status = AsyncMock(return_value=True)
    mock.store_chunks_and_update_status = AsyncMock(return_value=3)
    return mock


@pytest.fixture
def mock_parser(sample_parse_result: ParseResult):
    """Create a mock document parser."""
    mock = MagicMock()
    mock.parse = AsyncMock(return_value=sample_parse_result)
    return mock


@pytest.fixture
def mock_job_queue():
    """Create a mock job queue."""
    mock = MagicMock()
    mock.enqueue = AsyncMock(return_value=str(uuid4()))
    return mock


# --- Test Classes ---


class TestParseDocumentHandlerSuccess:
    """Tests for successful parse_document handling."""

    @pytest.mark.asyncio
    async def test_handle_success_returns_result(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
        sample_document_id: UUID,
    ) -> None:
        """Test that successful handling returns proper result."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["document_id"] == str(sample_document_id)
        assert result["chunks_created"] == 3
        assert "next_job_id" in result

    @pytest.mark.asyncio
    async def test_handle_updates_status_to_processing(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler updates status to processing at start."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            await handler.handle(sample_job)

        mock_db_client.update_document_status.assert_called_once()
        call_args = mock_db_client.update_document_status.call_args
        # Handler calls: update_document_status(document_id, "processing")
        # So args[0] is document_id, args[1] is "processing"
        assert call_args[0][1] == "processing"

    @pytest.mark.asyncio
    async def test_handle_stores_chunks_atomically(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler stores chunks and updates status atomically."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            await handler.handle(sample_job)

        mock_db_client.store_chunks_and_update_status.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_enqueues_next_job(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler enqueues ingest-graphiti job.

        Note: E10.8 changed pipeline from generate-embeddings to ingest-graphiti.
        """
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            await handler.handle(sample_job)

        mock_job_queue.enqueue.assert_called_once()
        call_args = mock_job_queue.enqueue.call_args
        # E10.8: Pipeline now goes to ingest-graphiti instead of generate-embeddings
        assert call_args[0][0] == "ingest-graphiti"


class TestParseDocumentHandlerGCSErrors:
    """Tests for GCS error handling."""

    @pytest.mark.asyncio
    async def test_handle_gcs_not_found_marks_failed(
        self,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that GCS file not found marks document as failed."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler
        from src.storage.gcs_client import GCSFileNotFoundError

        mock_gcs = MagicMock()

        @asynccontextmanager
        async def mock_download_error(*args, **kwargs):
            raise GCSFileNotFoundError("gs://bucket/file.pdf")
            yield  # Never reached

        mock_gcs.download_temp_file = mock_download_error

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            with pytest.raises(GCSFileNotFoundError):
                await handler.handle(sample_job)

    @pytest.mark.asyncio
    async def test_handle_gcs_transient_error_raises(
        self,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that GCS transient errors are raised for retry."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler
        from src.storage.gcs_client import GCSDownloadError

        mock_gcs = MagicMock()

        @asynccontextmanager
        async def mock_download_error(*args, **kwargs):
            raise GCSDownloadError("Network error", gcs_path="gs://bucket/file.pdf", retryable=True)
            yield  # Never reached

        mock_gcs.download_temp_file = mock_download_error

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            with pytest.raises(GCSDownloadError):
                await handler.handle(sample_job)


class TestParseDocumentHandlerParseErrors:
    """Tests for parser error handling."""

    @pytest.mark.asyncio
    async def test_handle_unsupported_file_type_marks_failed(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that unsupported file type marks document as failed."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        mock_parser = MagicMock()
        mock_parser.parse = AsyncMock(
            side_effect=UnsupportedFileTypeError("Unsupported: .xyz", file_path=Path("/tmp/test.xyz"))
        )

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            with pytest.raises(UnsupportedFileTypeError):
                await handler.handle(sample_job)

    @pytest.mark.asyncio
    async def test_handle_corrupt_file_marks_failed(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that corrupt file marks document as failed."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        mock_parser = MagicMock()
        mock_parser.parse = AsyncMock(
            side_effect=CorruptFileError("File corrupt", file_path=Path("/tmp/test.pdf"))
        )

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            with pytest.raises(CorruptFileError):
                await handler.handle(sample_job)

    @pytest.mark.asyncio
    async def test_handle_file_too_large_marks_failed(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that file too large marks document as failed."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        mock_parser = MagicMock()
        mock_parser.parse = AsyncMock(
            side_effect=FileTooLargeError("File exceeds 100MB", file_path=Path("/tmp/test.pdf"))
        )

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            with pytest.raises(FileTooLargeError):
                await handler.handle(sample_job)


class TestParseDocumentHandlerDatabaseErrors:
    """Tests for database error handling."""

    @pytest.mark.asyncio
    async def test_handle_db_error_raises_for_retry(
        self,
        mock_gcs_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that database errors are raised for potential retry."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler
        from src.storage.supabase_client import DatabaseError

        mock_db = MagicMock()
        mock_db.update_document_status = AsyncMock(return_value=True)
        mock_db.store_chunks_and_update_status = AsyncMock(
            side_effect=DatabaseError("Connection failed", retryable=True)
        )

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db,
                parser=mock_parser,
            )

            with pytest.raises(DatabaseError):
                await handler.handle(sample_job)


class TestParseDocumentHandlerMetrics:
    """Tests for handler metrics and logging."""

    @pytest.mark.asyncio
    async def test_handle_returns_timing_metrics(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler returns timing metrics."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            result = await handler.handle(sample_job)

        assert "parse_time_ms" in result
        assert "total_time_ms" in result
        assert result["parse_time_ms"] >= 0
        assert result["total_time_ms"] >= 0

    @pytest.mark.asyncio
    async def test_handle_returns_content_metrics(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler returns content metrics."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            result = await handler.handle(sample_job)

        assert "chunks_created" in result
        assert "tables_extracted" in result
        assert "formulas_extracted" in result


class TestHandleParseDocumentFunction:
    """Tests for the module-level handler function."""

    @pytest.mark.asyncio
    async def test_handle_parse_document_uses_global_handler(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handle_parse_document uses singleton handler."""
        from src.jobs.handlers import parse_document

        # Reset global handler
        parse_document._handler = None

        with patch("src.jobs.handlers.parse_document.get_gcs_client", return_value=mock_gcs_client):
            with patch("src.jobs.handlers.parse_document.get_supabase_client", return_value=mock_db_client):
                with patch("src.jobs.handlers.parse_document._create_docling_parser", return_value=mock_parser):
                    with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
                        result = await parse_document.handle_parse_document(sample_job)

        assert result["success"] is True

        # Cleanup
        parse_document._handler = None


class TestParseDocumentPayloadValidation:
    """Tests for job payload validation."""

    @pytest.mark.asyncio
    async def test_handle_with_missing_file_type_uses_extension(
        self,
        mock_gcs_client: MagicMock,
        mock_db_client: MagicMock,
        mock_parser: MagicMock,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that missing file_type is inferred from path."""
        from src.jobs.handlers.parse_document import ParseDocumentHandler

        job = Job(
            id=str(uuid4()),
            name="document-parse",
            data={
                "document_id": str(sample_document_id),
                "gcs_path": "gs://bucket/path/document.xlsx",
                # file_type intentionally missing
            },
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            retry_count=0,
        )

        with patch("src.jobs.handlers.parse_document.get_job_queue", return_value=mock_job_queue):
            handler = ParseDocumentHandler(
                gcs_client=mock_gcs_client,
                db_client=mock_db_client,
                parser=mock_parser,
            )

            result = await handler.handle(job)

        # Parser should have been called
        mock_parser.parse.assert_called_once()
        assert result["success"] is True
