"""
Tests for the Supabase client.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #4, #6)
"""

import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.parsers import ChunkData, TableData, FormulaData
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)


@pytest.fixture
def mock_db_settings():
    """Mock settings for Supabase client."""
    mock = MagicMock()
    mock.database_url = "postgresql://test:test@localhost:5432/test"
    mock.supabase_url = "https://test.supabase.co"
    mock.supabase_service_role_key = "test-key"
    return mock


@pytest.fixture
def mock_connection():
    """Create a mock asyncpg connection."""
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value="UPDATE 1")
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)

    # Mock transaction context manager
    @asynccontextmanager
    async def mock_transaction():
        yield

    conn.transaction = mock_transaction

    return conn


@pytest.fixture
def mock_pool(mock_connection: AsyncMock):
    """Create a mock asyncpg pool."""
    pool = MagicMock()

    @asynccontextmanager
    async def mock_acquire() -> AsyncIterator[AsyncMock]:
        yield mock_connection

    pool.acquire = mock_acquire
    return pool


@pytest.fixture
def sample_chunks() -> list[ChunkData]:
    """Sample chunks for testing."""
    return [
        ChunkData(
            content="First chunk content",
            chunk_type="text",
            chunk_index=0,
            page_number=1,
            metadata={"source": "test.pdf"},
            token_count=5,
        ),
        ChunkData(
            content="Second chunk content",
            chunk_type="table",
            chunk_index=1,
            page_number=1,
            sheet_name="Sheet1",
            metadata={"is_table": True},
            token_count=6,
        ),
    ]


class TestSupabaseClientInit:
    """Tests for Supabase client initialization."""

    def test_init_stores_config(self, mock_db_settings: MagicMock) -> None:
        """Test that init stores config."""
        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            client = SupabaseClient(config=mock_db_settings)

            assert client.config == mock_db_settings


class TestSupabaseClientStoreChunks:
    """Tests for storing chunks."""

    @pytest.mark.asyncio
    async def test_store_chunks_inserts_all(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
        sample_chunks: list[ChunkData],
    ) -> None:
        """Test that store_chunks inserts all chunks."""
        document_id = uuid4()

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                count = await client.store_chunks(document_id, sample_chunks)

                assert count == len(sample_chunks)
                # 1 DELETE + 2 INSERTs
                assert mock_connection.execute.call_count == 3

    @pytest.mark.asyncio
    async def test_store_chunks_clears_existing(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
        sample_chunks: list[ChunkData],
    ) -> None:
        """Test that store_chunks clears existing chunks first."""
        document_id = uuid4()

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                await client.store_chunks(document_id, sample_chunks)

                # First call should be DELETE
                first_call = mock_connection.execute.call_args_list[0]
                assert "DELETE" in first_call[0][0]

    @pytest.mark.asyncio
    async def test_store_chunks_includes_metadata(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that store_chunks includes metadata as JSON."""
        document_id = uuid4()
        chunks = [
            ChunkData(
                content="Test",
                chunk_type="text",
                chunk_index=0,
                metadata={"key": "value", "number": 42},
            )
        ]

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                await client.store_chunks(document_id, chunks)

                # Check INSERT call includes JSON metadata
                insert_call = mock_connection.execute.call_args_list[1]
                # Metadata is the 9th parameter
                assert insert_call[0][9] == json.dumps({"key": "value", "number": 42})


class TestSupabaseClientUpdateStatus:
    """Tests for updating document status."""

    @pytest.mark.asyncio
    async def test_update_status_success(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
    ) -> None:
        """Test successful status update."""
        document_id = uuid4()
        mock_connection.execute.return_value = "UPDATE 1"

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                result = await client.update_document_status(document_id, "parsed")

                assert result is True
                mock_connection.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_status_no_rows_affected(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
    ) -> None:
        """Test status update when no rows affected."""
        document_id = uuid4()
        mock_connection.execute.return_value = "UPDATE 0"

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                result = await client.update_document_status(document_id, "parsed")

                assert result is False


class TestSupabaseClientGetDocument:
    """Tests for getting document details."""

    @pytest.mark.asyncio
    async def test_get_document_found(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
    ) -> None:
        """Test getting an existing document."""
        document_id = uuid4()
        mock_connection.fetchrow.return_value = {
            "id": document_id,
            "deal_id": uuid4(),
            "user_id": uuid4(),
            "name": "test.pdf",
            "file_path": "gs://bucket/test.pdf",
            "file_size": 1024,
            "mime_type": "application/pdf",
            "upload_status": "completed",
            "processing_status": "pending",
            "gcs_bucket": "bucket",
            "gcs_object_path": "test.pdf",
            "folder_path": "/documents",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                doc = await client.get_document(document_id)

                assert doc is not None
                assert doc["name"] == "test.pdf"
                assert doc["processing_status"] == "pending"

    @pytest.mark.asyncio
    async def test_get_document_not_found(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
    ) -> None:
        """Test getting a non-existent document."""
        document_id = uuid4()
        mock_connection.fetchrow.return_value = None

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                doc = await client.get_document(document_id)

                assert doc is None


class TestSupabaseClientTransactionalStorage:
    """Tests for transactional chunk storage."""

    @pytest.mark.asyncio
    async def test_store_chunks_and_update_status_atomic(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
        sample_chunks: list[ChunkData],
    ) -> None:
        """Test that chunks and status are updated atomically."""
        document_id = uuid4()

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                count = await client.store_chunks_and_update_status(
                    document_id=document_id,
                    chunks=sample_chunks,
                    new_status="parsed",
                )

                assert count == len(sample_chunks)
                # DELETE + 2 INSERTs + UPDATE status
                assert mock_connection.execute.call_count == 4

    @pytest.mark.asyncio
    async def test_store_chunks_and_update_status_correct_status(
        self,
        mock_db_settings: MagicMock,
        mock_pool: MagicMock,
        mock_connection: AsyncMock,
        sample_chunks: list[ChunkData],
    ) -> None:
        """Test that correct status is set."""
        document_id = uuid4()

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            with patch("src.storage.supabase_client.get_pool", new_callable=AsyncMock) as mock_get_pool:
                mock_get_pool.return_value = mock_pool

                client = SupabaseClient(config=mock_db_settings)
                await client.store_chunks_and_update_status(
                    document_id=document_id,
                    chunks=sample_chunks,
                    new_status="parsed",
                )

                # Last call should be the status UPDATE
                last_call = mock_connection.execute.call_args_list[-1]
                assert "UPDATE documents" in last_call[0][0]
                assert last_call[0][2] == "parsed"


class TestDatabaseError:
    """Tests for DatabaseError."""

    def test_database_error_attributes(self) -> None:
        """Test DatabaseError has correct attributes."""
        error = DatabaseError("Test error", retryable=True)

        assert error.message == "Test error"
        assert error.retryable is True

    def test_database_error_default_retryable(self) -> None:
        """Test DatabaseError defaults to retryable."""
        error = DatabaseError("Test error")

        assert error.retryable is True


class TestSupabaseClientSingleton:
    """Tests for singleton pattern."""

    def test_get_supabase_client_returns_instance(self, mock_db_settings: MagicMock) -> None:
        """Test that get_supabase_client returns a client instance."""
        from src.storage import supabase_client

        # Reset singleton
        supabase_client._supabase_client = None

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            client = get_supabase_client()

            assert client is not None
            assert isinstance(client, SupabaseClient)

        # Cleanup
        supabase_client._supabase_client = None

    def test_get_supabase_client_returns_same_instance(self, mock_db_settings: MagicMock) -> None:
        """Test that get_supabase_client returns the same instance."""
        from src.storage import supabase_client

        # Reset singleton
        supabase_client._supabase_client = None

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            client1 = get_supabase_client()
            client2 = get_supabase_client()

            assert client1 is client2

        # Cleanup
        supabase_client._supabase_client = None


class TestSupabaseClientRetryableErrors:
    """Tests for retryable error detection."""

    def test_is_retryable_connection_error(self, mock_db_settings: MagicMock) -> None:
        """Test that connection errors are retryable."""
        import asyncpg

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            client = SupabaseClient(config=mock_db_settings)

            error = asyncpg.InterfaceError("connection lost")
            assert client._is_retryable_error(error) is True

    def test_is_not_retryable_constraint_error(self, mock_db_settings: MagicMock) -> None:
        """Test that constraint errors are not retryable."""
        import asyncpg

        with patch("src.storage.supabase_client.get_settings", return_value=mock_db_settings):
            client = SupabaseClient(config=mock_db_settings)

            error = asyncpg.UniqueViolationError()
            assert client._is_retryable_error(error) is False
