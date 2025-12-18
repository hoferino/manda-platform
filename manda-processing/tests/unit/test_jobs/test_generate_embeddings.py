"""
Tests for the generate_embeddings job handler.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #6)

DEPRECATED: E10.8 - PostgreSQL Cleanup
This handler is deprecated. Graphiti now handles all embeddings via Voyage AI.
The generate-embeddings job step has been removed from the processing pipeline.
These tests are kept for reference but are marked as deprecated.
"""

import os
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from src.jobs.queue import Job, JobState

# Set test environment variables
os.environ.setdefault("OPENAI_API_KEY", "test-openai-api-key")


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
    """Sample job payload for generate_embeddings."""
    return {
        "document_id": str(sample_document_id),
        "chunks_count": 5,
        "deal_id": sample_deal_id,
        "user_id": sample_user_id,
    }


@pytest.fixture
def sample_job(sample_job_payload: dict[str, Any]) -> Job:
    """Create a sample Job instance."""
    return Job(
        id=str(uuid4()),
        name="generate-embeddings",
        data=sample_job_payload,
        state=JobState.ACTIVE,
        created_on=datetime.now(),
        started_on=datetime.now(),
        retry_count=0,
    )


@pytest.fixture
def sample_chunks(sample_document_id: UUID) -> list[dict[str, Any]]:
    """Sample chunks from database."""
    return [
        {
            "id": uuid4(),
            "document_id": sample_document_id,
            "chunk_index": 0,
            "content": "First chunk of text content.",
            "chunk_type": "text",
            "page_number": 1,
            "has_embedding": False,
        },
        {
            "id": uuid4(),
            "document_id": sample_document_id,
            "chunk_index": 1,
            "content": "Second chunk with table data.",
            "chunk_type": "table",
            "page_number": 1,
            "has_embedding": False,
        },
        {
            "id": uuid4(),
            "document_id": sample_document_id,
            "chunk_index": 2,
            "content": "Third chunk on page two.",
            "chunk_type": "text",
            "page_number": 2,
            "has_embedding": False,
        },
    ]


@pytest.fixture
def sample_embedding() -> list[float]:
    """Sample 3072-dimension embedding vector."""
    return [0.01 * i for i in range(3072)]


@pytest.fixture
def mock_db_client(sample_chunks: list[dict[str, Any]]) -> MagicMock:
    """Create a mock Supabase client."""
    mock = MagicMock()
    mock.update_document_status = AsyncMock(return_value=True)
    mock.get_chunks_by_document = AsyncMock(return_value=sample_chunks)
    mock.update_embeddings_and_status = AsyncMock(return_value=3)
    return mock


@pytest.fixture
def mock_embedding_client(sample_embedding: list[float]) -> MagicMock:
    """Create a mock embedding client."""
    from src.embeddings.openai_client import EmbeddingBatchResult

    mock = MagicMock()
    mock.generate_batch = AsyncMock(
        return_value=EmbeddingBatchResult(
            embeddings=[sample_embedding, sample_embedding, sample_embedding],
            total_tokens=150,
            batch_count=1,
            failed_indices=[],
        )
    )
    return mock


@pytest.fixture
def mock_job_queue() -> MagicMock:
    """Create a mock job queue."""
    mock = MagicMock()
    mock.enqueue = AsyncMock(return_value=str(uuid4()))
    return mock


# --- Test Classes ---


class TestGenerateEmbeddingsHandlerSuccess:
    """Tests for successful generate_embeddings handling."""

    @pytest.mark.asyncio
    async def test_handle_success_returns_result(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
        sample_document_id: UUID,
    ) -> None:
        """Test that successful handling returns proper result."""
        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding_client,
            )

            result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["document_id"] == str(sample_document_id)
        assert result["chunks_embedded"] == 3
        assert result["total_tokens"] == 150
        assert "next_job_id" in result

    @pytest.mark.asyncio
    async def test_handle_updates_status_to_embedding(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler updates status to embedding at start."""
        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding_client,
            )

            await handler.handle(sample_job)

        mock_db_client.update_document_status.assert_called_once()
        call_args = mock_db_client.update_document_status.call_args
        assert call_args[0][1] == "embedding"

    @pytest.mark.asyncio
    async def test_handle_loads_chunks_from_database(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
        sample_document_id: UUID,
    ) -> None:
        """Test that handler loads chunks from database."""
        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding_client,
            )

            await handler.handle(sample_job)

        mock_db_client.get_chunks_by_document.assert_called_once_with(sample_document_id)

    @pytest.mark.asyncio
    async def test_handle_generates_embeddings_for_all_chunks(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler generates embeddings for all chunks."""
        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding_client,
            )

            await handler.handle(sample_job)

        mock_embedding_client.generate_batch.assert_called_once()
        call_args = mock_embedding_client.generate_batch.call_args
        texts = call_args[0][0]
        assert len(texts) == 3

    @pytest.mark.asyncio
    async def test_handle_stores_embeddings_atomically(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler stores embeddings and updates status atomically."""
        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding_client,
            )

            await handler.handle(sample_job)

        mock_db_client.update_embeddings_and_status.assert_called_once()
        call_args = mock_db_client.update_embeddings_and_status.call_args
        assert call_args.kwargs.get("new_status") == "embedded"

    @pytest.mark.asyncio
    async def test_handle_enqueues_analyze_document_job(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler enqueues analyze-document job."""
        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding_client,
            )

            await handler.handle(sample_job)

        mock_job_queue.enqueue.assert_called_once()
        call_args = mock_job_queue.enqueue.call_args
        assert call_args[0][0] == "analyze-document"


class TestGenerateEmbeddingsHandlerEmptyDocument:
    """Tests for handling documents with no chunks."""

    @pytest.mark.asyncio
    async def test_handle_empty_chunks_marks_embedded(
        self,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that empty document is still marked as embedded."""
        mock_db = MagicMock()
        mock_db.update_document_status = AsyncMock(return_value=True)
        mock_db.get_chunks_by_document = AsyncMock(return_value=[])

        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db,
                embedding_client=mock_embedding_client,
            )

            result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["chunks_embedded"] == 0
        # Should update status to embedded
        mock_db.update_document_status.assert_called()


class TestGenerateEmbeddingsHandlerErrors:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handle_database_error_raises(
        self,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that database errors are raised for retry."""
        from src.storage.supabase_client import DatabaseError

        mock_db = MagicMock()
        mock_db.update_document_status = AsyncMock(return_value=True)
        mock_db.get_chunks_by_document = AsyncMock(
            side_effect=DatabaseError("Connection failed", retryable=True)
        )

        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db,
                embedding_client=mock_embedding_client,
            )

            with pytest.raises(DatabaseError):
                await handler.handle(sample_job)

    @pytest.mark.asyncio
    async def test_handle_embedding_error_marks_failed(
        self,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that embedding errors mark document as failed."""
        from src.embeddings.openai_client import EmbeddingError

        mock_embedding = MagicMock()
        mock_embedding.generate_batch = AsyncMock(
            side_effect=EmbeddingError("API error", retryable=False)
        )

        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding,
            )

            with pytest.raises(EmbeddingError):
                await handler.handle(sample_job)


class TestGenerateEmbeddingsHandlerMetrics:
    """Tests for handler metrics."""

    @pytest.mark.asyncio
    async def test_handle_returns_timing_metrics(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler returns timing metrics."""
        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding_client,
            )

            result = await handler.handle(sample_job)

        assert "total_time_ms" in result
        assert result["total_time_ms"] >= 0

    @pytest.mark.asyncio
    async def test_handle_returns_token_and_cost_metrics(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler returns token and cost metrics."""
        from src.jobs.handlers.generate_embeddings import GenerateEmbeddingsHandler

        with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
            handler = GenerateEmbeddingsHandler(
                db_client=mock_db_client,
                embedding_client=mock_embedding_client,
            )

            result = await handler.handle(sample_job)

        assert "total_tokens" in result
        assert "estimated_cost_usd" in result


class TestHandleGenerateEmbeddingsFunction:
    """Tests for the module-level handler function."""

    @pytest.mark.asyncio
    async def test_handle_generate_embeddings_uses_global_handler(
        self,
        mock_db_client: MagicMock,
        mock_embedding_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handle_generate_embeddings uses singleton handler."""
        from src.jobs.handlers import generate_embeddings

        # Reset global handler
        generate_embeddings._handler = None

        with patch("src.jobs.handlers.generate_embeddings.get_supabase_client", return_value=mock_db_client):
            with patch("src.jobs.handlers.generate_embeddings._create_embedding_client", return_value=mock_embedding_client):
                with patch("src.jobs.handlers.generate_embeddings.get_job_queue", return_value=mock_job_queue):
                    result = await generate_embeddings.handle_generate_embeddings(sample_job)

        assert result["success"] is True

        # Cleanup
        generate_embeddings._handler = None
