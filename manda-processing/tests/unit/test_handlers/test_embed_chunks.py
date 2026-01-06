"""
Unit tests for embed_chunks job handler.
Story: E12.10 - Fast Path Document Retrieval (AC: #3, #5, #7)
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.jobs.handlers.embed_chunks import (
    EmbedChunksHandler,
    handle_embed_chunks,
    get_embed_chunks_handler,
    EMBEDDING_BATCH_SIZE,
)
from src.jobs.queue import Job, JobState


@pytest.fixture
def mock_db_client():
    """Create a mock SupabaseClient."""
    client = MagicMock()
    client.get_chunks_by_document = AsyncMock()
    client.get_deal = AsyncMock()
    return client


@pytest.fixture
def mock_voyage_client():
    """Create a mock VoyageEmbeddingClient."""
    client = MagicMock()
    client.embed_batch = AsyncMock(return_value=[
        [0.1] * 1024,  # 1024-dim embedding
        [0.2] * 1024,
        [0.3] * 1024,
    ])
    return client


@pytest.fixture
def mock_graphiti_client():
    """Create a mock GraphitiClient."""
    client = MagicMock()
    driver = MagicMock()
    session = MagicMock()
    session.run = AsyncMock()
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock()
    driver.session = MagicMock(return_value=session)
    client.driver = driver
    return client


@pytest.fixture
def sample_chunks():
    """Return sample chunks from database."""
    return [
        {
            "id": str(uuid4()),
            "content": "Revenue increased 15% year-over-year.",
            "chunk_index": 0,
            "page_number": 1,
            "chunk_type": "text",
            "token_count": 10,
        },
        {
            "id": str(uuid4()),
            "content": "The company has 50 employees.",
            "chunk_index": 1,
            "page_number": 1,
            "chunk_type": "text",
            "token_count": 8,
        },
        {
            "id": str(uuid4()),
            "content": "EBITDA margin improved to 18%.",
            "chunk_index": 2,
            "page_number": 2,
            "chunk_type": "text",
            "token_count": 9,
        },
    ]


@pytest.fixture
def sample_job():
    """Create a sample embed-chunks job."""
    return Job(
        id="test-job-123",
        name="embed-chunks",
        data={
            "document_id": str(uuid4()),
            "deal_id": str(uuid4()),
            "organization_id": str(uuid4()),
            "user_id": str(uuid4()),
        },
        state=JobState.ACTIVE,
        created_on=datetime.now(),
        retry_count=0,
    )


class TestEmbedChunksHandler:
    """Unit tests for EmbedChunksHandler."""

    @pytest.mark.asyncio
    async def test_handle_success(
        self,
        mock_db_client,
        mock_voyage_client,
        mock_graphiti_client,
        sample_chunks,
        sample_job,
    ):
        """Test successful chunk embedding."""
        # Setup mocks
        mock_db_client.get_chunks_by_document.return_value = sample_chunks
        mock_db_client.get_deal.return_value = {"organization_id": sample_job.data["organization_id"]}

        with patch("src.jobs.handlers.embed_chunks.get_voyage_client", return_value=mock_voyage_client), \
             patch("src.jobs.handlers.embed_chunks.GraphitiClient.get_instance", new=AsyncMock(return_value=mock_graphiti_client)), \
             patch("src.jobs.handlers.embed_chunks.log_feature_usage_to_db", new=AsyncMock()):

            handler = EmbedChunksHandler(db_client=mock_db_client)
            result = await handler.handle(sample_job)

        # Verify result
        assert result["success"] is True
        assert result["chunks_embedded"] == 3
        assert "embed_time_ms" in result
        assert "store_time_ms" in result
        assert "total_time_ms" in result

        # Verify voyage client was called
        mock_voyage_client.embed_batch.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_no_chunks(self, mock_db_client, sample_job):
        """Test handling when document has no chunks."""
        mock_db_client.get_chunks_by_document.return_value = []

        handler = EmbedChunksHandler(db_client=mock_db_client)
        result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["chunks_embedded"] == 0
        assert result["reason"] == "no_chunks"

    @pytest.mark.asyncio
    async def test_handle_missing_organization_id(self, mock_db_client, sample_chunks):
        """Test error when organization_id cannot be determined."""
        mock_db_client.get_chunks_by_document.return_value = sample_chunks
        mock_db_client.get_deal.return_value = None  # No deal found

        job = Job(
            id="test-job-123",
            name="embed-chunks",
            data={
                "document_id": str(uuid4()),
                "deal_id": str(uuid4()),
                # No organization_id
            },
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            retry_count=0,
        )

        with patch("src.jobs.handlers.embed_chunks.log_feature_usage_to_db", new=AsyncMock()):
            handler = EmbedChunksHandler(db_client=mock_db_client)

            with pytest.raises(ValueError, match="organization_id required"):
                await handler.handle(job)

    @pytest.mark.asyncio
    async def test_batch_embedding(
        self,
        mock_db_client,
        mock_voyage_client,
        mock_graphiti_client,
        sample_job,
    ):
        """Test that large chunk sets are batched correctly."""
        # Create more chunks than batch size
        large_chunks = [
            {
                "id": str(uuid4()),
                "content": f"Chunk content {i}",
                "chunk_index": i,
                "page_number": 1,
                "chunk_type": "text",
                "token_count": 5,
            }
            for i in range(100)  # More than EMBEDDING_BATCH_SIZE (64)
        ]

        mock_db_client.get_chunks_by_document.return_value = large_chunks
        mock_db_client.get_deal.return_value = {"organization_id": sample_job.data["organization_id"]}

        # Mock returns batch-sized embeddings
        mock_voyage_client.embed_batch = AsyncMock(
            side_effect=[
                [[0.1] * 1024] * 64,  # First batch
                [[0.2] * 1024] * 36,  # Second batch (remaining)
            ]
        )

        with patch("src.jobs.handlers.embed_chunks.get_voyage_client", return_value=mock_voyage_client), \
             patch("src.jobs.handlers.embed_chunks.GraphitiClient.get_instance", new=AsyncMock(return_value=mock_graphiti_client)), \
             patch("src.jobs.handlers.embed_chunks.log_feature_usage_to_db", new=AsyncMock()):

            handler = EmbedChunksHandler(db_client=mock_db_client)
            result = await handler.handle(sample_job)

        assert result["chunks_embedded"] == 100
        # Should have been called twice (64 + 36)
        assert mock_voyage_client.embed_batch.call_count == 2

    @pytest.mark.asyncio
    async def test_group_id_format(
        self,
        mock_db_client,
        mock_voyage_client,
        mock_graphiti_client,
        sample_chunks,
    ):
        """Test that group_id follows E12.9 format: {org_id}_{deal_id}."""
        org_id = str(uuid4())
        deal_id = str(uuid4())

        job = Job(
            id="test-job-123",
            name="embed-chunks",
            data={
                "document_id": str(uuid4()),
                "deal_id": deal_id,
                "organization_id": org_id,
            },
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            retry_count=0,
        )

        mock_db_client.get_chunks_by_document.return_value = sample_chunks

        captured_params = []

        async def capture_run(query, **params):
            captured_params.append(params)

        session = mock_graphiti_client.driver.session()
        session.run = capture_run

        with patch("src.jobs.handlers.embed_chunks.get_voyage_client", return_value=mock_voyage_client), \
             patch("src.jobs.handlers.embed_chunks.GraphitiClient.get_instance", new=AsyncMock(return_value=mock_graphiti_client)), \
             patch("src.jobs.handlers.embed_chunks.log_feature_usage_to_db", new=AsyncMock()):

            handler = EmbedChunksHandler(db_client=mock_db_client)
            await handler.handle(job)

        # Verify group_id format in stored chunks
        expected_group_id = f"{org_id}_{deal_id}"
        for params in captured_params:
            if "group_id" in params:
                assert params["group_id"] == expected_group_id


class TestEmbedChunksModuleFunctions:
    """Test module-level functions."""

    def test_get_embed_chunks_handler_singleton(self):
        """Test that get_embed_chunks_handler returns same instance."""
        import src.jobs.handlers.embed_chunks as module

        # Reset singleton before test
        module._handler = None

        with patch("src.jobs.handlers.embed_chunks.get_supabase_client"):
            handler1 = get_embed_chunks_handler()
            handler2 = get_embed_chunks_handler()

            # Verify same instance returned (singleton behavior)
            assert handler1 is handler2
            assert handler1 is not None

        # Cleanup
        module._handler = None

    @pytest.mark.asyncio
    async def test_handle_embed_chunks_entry_point(self, sample_job):
        """Test the handle_embed_chunks entry point."""
        with patch("src.jobs.handlers.embed_chunks.get_embed_chunks_handler") as mock_get_handler:
            mock_handler = MagicMock()
            mock_handler.handle = AsyncMock(return_value={"success": True})
            mock_get_handler.return_value = mock_handler

            result = await handle_embed_chunks(sample_job)

            assert result["success"] is True
            mock_handler.handle.assert_called_once_with(sample_job)
