"""
Unit tests for IngestGraphitiHandler.
Story: E10.4 - Document Ingestion Pipeline (AC: #1, #6, #7)

Tests the ingest-graphiti job handler:
- Document chunk loading
- Graphiti ingestion via service
- Status updates (graphiti_ingesting -> graphiti_ingested)
- Next job enqueueing (analyze-document)
- Error handling and retry classification
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.jobs.handlers.ingest_graphiti import (
    IngestGraphitiHandler,
    handle_ingest_graphiti,
    get_ingest_graphiti_handler,
)
from src.jobs.queue import Job, JobState
from src.graphiti.ingestion import IngestionResult


@pytest.fixture
def mock_db_client():
    """Create a mock database client."""
    client = AsyncMock()
    client.get_document = AsyncMock(
        return_value={
            "id": str(uuid4()),
            "deal_id": str(uuid4()),
            "user_id": str(uuid4()),
            "name": "test_document.pdf",
            "mime_type": "application/pdf",
        }
    )
    client.get_chunks_by_document = AsyncMock(
        return_value=[
            {
                "id": str(uuid4()),
                "content": "Revenue increased 15%.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            },
            {
                "id": str(uuid4()),
                "content": "EBITDA margin is 25%.",
                "chunk_index": 1,
                "page_number": 1,
                "chunk_type": "text",
            },
        ]
    )
    client.update_document_status = AsyncMock(return_value=True)
    client.clear_processing_error = AsyncMock(return_value=True)
    return client


@pytest.fixture
def mock_ingestion_service():
    """Create a mock Graphiti ingestion service."""
    service = MagicMock()
    service.ingest_document_chunks = AsyncMock(
        return_value=IngestionResult(
            episode_count=2,
            elapsed_ms=500,
            estimated_cost_usd=0.00001,
        )
    )
    return service


@pytest.fixture
def mock_retry_manager():
    """Create a mock retry manager."""
    manager = AsyncMock()
    manager.prepare_stage_retry = AsyncMock()
    manager.mark_stage_complete = AsyncMock()
    manager.handle_job_failure = AsyncMock()
    return manager


@pytest.fixture
def mock_job_queue():
    """Create a mock job queue."""
    queue = AsyncMock()
    queue.enqueue = AsyncMock(return_value="next-job-id-123")
    return queue


@pytest.fixture
def handler(mock_db_client, mock_ingestion_service, mock_retry_manager):
    """Create handler with mocked dependencies."""
    return IngestGraphitiHandler(
        db_client=mock_db_client,
        ingestion_service=mock_ingestion_service,
        retry_manager=mock_retry_manager,
    )


@pytest.fixture
def sample_job():
    """Create a sample ingest-graphiti job."""
    return Job(
        id=str(uuid4()),
        name="ingest-graphiti",
        data={
            "document_id": str(uuid4()),
            "deal_id": str(uuid4()),
            "user_id": str(uuid4()),
        },
        retry_count=0,
        state=JobState.ACTIVE,
        created_on=datetime.now(timezone.utc),
    )


class TestIngestGraphitiHandler:
    """Tests for IngestGraphitiHandler."""

    @pytest.mark.asyncio
    async def test_handle_success(
        self, handler, sample_job, mock_db_client, mock_ingestion_service, mock_retry_manager, mock_job_queue
    ):
        """Test successful ingestion flow."""
        with patch("src.jobs.handlers.ingest_graphiti.get_job_queue", return_value=mock_job_queue):
            result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["episodes_created"] == 2
        assert result["ingestion_time_ms"] == 500
        assert result["next_job_id"] == "next-job-id-123"

        # Verify status updates were made (uses UUID object internally)
        assert mock_db_client.update_document_status.call_count >= 2

        # Extract the status updates
        status_calls = [call.args[1] for call in mock_db_client.update_document_status.call_args_list]
        assert "graphiti_ingesting" in status_calls
        assert "graphiti_ingested" in status_calls

        # Verify stage completion
        mock_retry_manager.mark_stage_complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_empty_chunks(
        self, handler, sample_job, mock_db_client, mock_ingestion_service, mock_retry_manager, mock_job_queue
    ):
        """Test handling document with no chunks."""
        mock_db_client.get_chunks_by_document = AsyncMock(return_value=[])

        with patch("src.jobs.handlers.ingest_graphiti.get_job_queue", return_value=mock_job_queue):
            result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["episodes_created"] == 0

        # Should still update status and enqueue next job
        mock_db_client.update_document_status.assert_called()
        mock_retry_manager.mark_stage_complete.assert_called_once()

        # Ingestion service should NOT be called for empty chunks
        mock_ingestion_service.ingest_document_chunks.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_document_not_found(
        self, handler, sample_job, mock_db_client, mock_retry_manager
    ):
        """Test error when document is not found."""
        mock_db_client.get_document = AsyncMock(return_value=None)

        with pytest.raises(ValueError) as exc_info:
            await handler.handle(sample_job)

        assert "Document not found" in str(exc_info.value)

        # Verify error was classified
        mock_retry_manager.handle_job_failure.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_graphiti_error(
        self, handler, sample_job, mock_db_client, mock_ingestion_service, mock_retry_manager
    ):
        """Test handling Graphiti connection error."""
        from src.graphiti.client import GraphitiConnectionError

        mock_ingestion_service.ingest_document_chunks = AsyncMock(
            side_effect=GraphitiConnectionError("Neo4j unavailable")
        )

        with pytest.raises(GraphitiConnectionError):
            await handler.handle(sample_job)

        # Verify error was classified for retry
        mock_retry_manager.handle_job_failure.assert_called_once()
        call_args = mock_retry_manager.handle_job_failure.call_args
        assert call_args.kwargs["current_stage"] == "graphiti_ingesting"

    @pytest.mark.asyncio
    async def test_handle_retry_job(
        self, handler, mock_db_client, mock_ingestion_service, mock_retry_manager, mock_job_queue
    ):
        """Test handling a retry job (is_retry=True)."""
        retry_job = Job(
            id=str(uuid4()),
            name="ingest-graphiti",
            data={
                "document_id": str(uuid4()),
                "deal_id": str(uuid4()),
                "is_retry": True,
            },
            retry_count=1,
            state=JobState.ACTIVE,
            created_on=datetime.now(timezone.utc),
        )

        with patch("src.jobs.handlers.ingest_graphiti.get_job_queue", return_value=mock_job_queue):
            result = await handler.handle(retry_job)

        assert result["success"] is True

        # Should call prepare_stage_retry for retry jobs
        mock_retry_manager.prepare_stage_retry.assert_called_once()

    @pytest.mark.asyncio
    async def test_enqueues_analyze_document(
        self, handler, sample_job, mock_db_client, mock_ingestion_service, mock_retry_manager, mock_job_queue
    ):
        """Test that analyze-document job is enqueued after ingestion."""
        with patch("src.jobs.handlers.ingest_graphiti.get_job_queue", return_value=mock_job_queue):
            result = await handler.handle(sample_job)

        # Verify analyze-document was enqueued
        mock_job_queue.enqueue.assert_called_once()
        call_args = mock_job_queue.enqueue.call_args
        assert call_args.args[0] == "analyze-document"
        assert "document_id" in call_args.args[1]
        assert "deal_id" in call_args.args[1]

    @pytest.mark.asyncio
    async def test_passes_deal_id_to_ingestion(
        self, handler, sample_job, mock_db_client, mock_ingestion_service, mock_retry_manager, mock_job_queue
    ):
        """Test that deal_id is passed to ingestion service for namespace isolation."""
        with patch("src.jobs.handlers.ingest_graphiti.get_job_queue", return_value=mock_job_queue):
            await handler.handle(sample_job)

        # Verify deal_id was passed to ingestion service
        mock_ingestion_service.ingest_document_chunks.assert_called_once()
        call_kwargs = mock_ingestion_service.ingest_document_chunks.call_args.kwargs
        assert call_kwargs["deal_id"] == sample_job.data["deal_id"]


class TestIngestGraphitiHandlerFactory:
    """Tests for handler factory functions."""

    def test_get_ingest_graphiti_handler_returns_instance(self):
        """Factory returns handler instance."""
        with patch("src.jobs.handlers.ingest_graphiti._handler", None):
            with patch(
                "src.jobs.handlers.ingest_graphiti.get_supabase_client",
                return_value=AsyncMock(),
            ):
                with patch(
                    "src.jobs.handlers.ingest_graphiti.get_retry_manager",
                    return_value=AsyncMock(),
                ):
                    handler = get_ingest_graphiti_handler()
                    assert isinstance(handler, IngestGraphitiHandler)

    def test_get_ingest_graphiti_handler_singleton(self):
        """Factory returns same instance on repeated calls."""
        with patch("src.jobs.handlers.ingest_graphiti._handler", None):
            with patch(
                "src.jobs.handlers.ingest_graphiti.get_supabase_client",
                return_value=AsyncMock(),
            ):
                with patch(
                    "src.jobs.handlers.ingest_graphiti.get_retry_manager",
                    return_value=AsyncMock(),
                ):
                    handler1 = get_ingest_graphiti_handler()
                    handler2 = get_ingest_graphiti_handler()
                    assert handler1 is handler2


class TestRetryClassification:
    """Tests for error retry classification (E3.8 compliance)."""

    @pytest.mark.asyncio
    async def test_value_error_is_non_retryable(
        self, handler, mock_db_client, mock_retry_manager
    ):
        """ValueError (document not found) should be classified as non-retryable."""
        # Simulate document not found - triggers ValueError after DB call
        mock_db_client.get_document = AsyncMock(return_value=None)

        job = Job(
            id=str(uuid4()),
            name="ingest-graphiti",
            data={
                "document_id": str(uuid4()),
                "deal_id": str(uuid4()),
            },
            retry_count=0,
            state=JobState.ACTIVE,
            created_on=datetime.now(timezone.utc),
        )

        with pytest.raises(ValueError) as exc_info:
            await handler.handle(job)

        assert "Document not found" in str(exc_info.value)

        # Verify retry manager was called for error classification
        mock_retry_manager.handle_job_failure.assert_called_once()

    @pytest.mark.asyncio
    async def test_missing_deal_id_raises_early(
        self, handler, mock_db_client, mock_retry_manager
    ):
        """Missing deal_id should raise ValueError before any processing."""
        # Create job missing deal_id - triggers early ValueError
        job_without_deal = Job(
            id=str(uuid4()),
            name="ingest-graphiti",
            data={
                "document_id": str(uuid4()),
                # Missing deal_id
            },
            retry_count=0,
            state=JobState.ACTIVE,
            created_on=datetime.now(timezone.utc),
        )

        with pytest.raises(ValueError) as exc_info:
            await handler.handle(job_without_deal)

        assert "deal_id is required" in str(exc_info.value)

        # Early validation errors are raised before retry manager is invoked
        # This is intentional - missing deal_id is a permanent misconfiguration
        mock_db_client.get_document.assert_not_called()

    @pytest.mark.asyncio
    async def test_database_error_classification(
        self, handler, sample_job, mock_db_client, mock_retry_manager
    ):
        """DatabaseError should be classified with its retryable flag."""
        from src.storage.supabase_client import DatabaseError

        # Simulate a retryable database error
        mock_db_client.get_chunks_by_document = AsyncMock(
            side_effect=DatabaseError("Connection timeout", retryable=True)
        )

        with pytest.raises(DatabaseError):
            await handler.handle(sample_job)

        # Verify error was classified
        mock_retry_manager.handle_job_failure.assert_called_once()
        call_kwargs = mock_retry_manager.handle_job_failure.call_args.kwargs
        assert call_kwargs["current_stage"] == "graphiti_ingesting"

    @pytest.mark.asyncio
    async def test_graphiti_connection_error_is_retryable(
        self, handler, sample_job, mock_db_client, mock_ingestion_service, mock_retry_manager
    ):
        """GraphitiConnectionError should trigger retry classification."""
        from src.graphiti.client import GraphitiConnectionError

        mock_ingestion_service.ingest_document_chunks = AsyncMock(
            side_effect=GraphitiConnectionError("Neo4j connection refused")
        )

        with pytest.raises(GraphitiConnectionError):
            await handler.handle(sample_job)

        # Verify error was classified for potential retry
        mock_retry_manager.handle_job_failure.assert_called_once()
        call_kwargs = mock_retry_manager.handle_job_failure.call_args.kwargs
        assert isinstance(call_kwargs["error"], GraphitiConnectionError)


class TestIdempotency:
    """Tests for idempotency check (Task 4.4)."""

    @pytest.mark.asyncio
    async def test_skips_already_ingested_document(
        self, handler, sample_job, mock_db_client, mock_ingestion_service, mock_retry_manager, mock_job_queue
    ):
        """Should skip ingestion if document is already in graphiti_ingested status."""
        # Document already ingested
        mock_db_client.get_document = AsyncMock(
            return_value={
                "id": sample_job.data["document_id"],
                "name": "test_document.pdf",
                "processing_status": "graphiti_ingested",
            }
        )

        with patch("src.jobs.handlers.ingest_graphiti.get_job_queue", return_value=mock_job_queue):
            result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result.get("skipped") is True
        assert result.get("reason") == "already_ingested"
        assert result["episodes_created"] == 0

        # Ingestion service should NOT be called
        mock_ingestion_service.ingest_document_chunks.assert_not_called()

        # Next job should still be enqueued
        mock_job_queue.enqueue.assert_called_once()

    @pytest.mark.asyncio
    async def test_processes_retry_even_if_ingested(
        self, handler, mock_db_client, mock_ingestion_service, mock_retry_manager, mock_job_queue
    ):
        """Retry jobs should reprocess even if status is graphiti_ingested."""
        retry_job = Job(
            id=str(uuid4()),
            name="ingest-graphiti",
            data={
                "document_id": str(uuid4()),
                "deal_id": str(uuid4()),
                "is_retry": True,
            },
            retry_count=1,
            state=JobState.ACTIVE,
            created_on=datetime.now(timezone.utc),
        )

        # Document shows as already ingested
        mock_db_client.get_document = AsyncMock(
            return_value={
                "id": retry_job.data["document_id"],
                "name": "test_document.pdf",
                "processing_status": "graphiti_ingested",
            }
        )

        with patch("src.jobs.handlers.ingest_graphiti.get_job_queue", return_value=mock_job_queue):
            result = await handler.handle(retry_job)

        assert result["success"] is True

        # Retry should still process (is_retry=True bypasses idempotency check)
        mock_ingestion_service.ingest_document_chunks.assert_called_once()


class TestHandleIngestGraphitiEntry:
    """Tests for the entry point function."""

    @pytest.mark.asyncio
    async def test_handle_ingest_graphiti_delegates(self, sample_job):
        """Entry point delegates to handler instance."""
        mock_handler = MagicMock()
        mock_handler.handle = AsyncMock(return_value={"success": True})

        with patch(
            "src.jobs.handlers.ingest_graphiti.get_ingest_graphiti_handler",
            return_value=mock_handler,
        ):
            result = await handle_ingest_graphiti(sample_job)

        assert result["success"] is True
        mock_handler.handle.assert_called_once_with(sample_job)
