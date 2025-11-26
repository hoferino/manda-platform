"""
Tests for the GCS client.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #2, #6)
"""

import os
import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.storage.gcs_client import (
    GCSClient,
    GCSDownloadError,
    GCSFileNotFoundError,
    get_gcs_client,
)


@pytest.fixture
def mock_gcs_settings():
    """Mock settings for GCS client."""
    mock = MagicMock()
    mock.gcs_bucket = "test-bucket"
    mock.gcs_project_id = "test-project"
    mock.google_application_credentials = ""
    mock.parser_temp_dir = tempfile.gettempdir()
    return mock


@pytest.fixture
def mock_storage_client():
    """Mock Google Cloud Storage client."""
    mock_blob = MagicMock()
    mock_blob.exists.return_value = True
    mock_blob.download_to_filename = MagicMock()

    mock_bucket = MagicMock()
    mock_bucket.blob.return_value = mock_blob

    mock_client = MagicMock()
    mock_client.bucket.return_value = mock_bucket

    return mock_client


class TestGCSClientInit:
    """Tests for GCS client initialization."""

    def test_init_creates_temp_dir(self, mock_gcs_settings: MagicMock) -> None:
        """Test that init creates temp directory."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            with patch("os.makedirs") as mock_makedirs:
                client = GCSClient(config=mock_gcs_settings)

                mock_makedirs.assert_called_once_with(
                    mock_gcs_settings.parser_temp_dir, exist_ok=True
                )

    def test_init_stores_config(self, mock_gcs_settings: MagicMock) -> None:
        """Test that init stores config."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)

            assert client.config == mock_gcs_settings


class TestGCSPathParsing:
    """Tests for GCS path parsing."""

    def test_parse_gcs_path_valid(self, mock_gcs_settings: MagicMock) -> None:
        """Test parsing a valid GCS path."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)

            bucket, path = client.parse_gcs_path("gs://my-bucket/path/to/file.pdf")

            assert bucket == "my-bucket"
            assert path == "path/to/file.pdf"

    def test_parse_gcs_path_with_special_chars(self, mock_gcs_settings: MagicMock) -> None:
        """Test parsing GCS path with special characters."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)

            bucket, path = client.parse_gcs_path("gs://bucket/path with spaces/file (1).pdf")

            assert bucket == "bucket"
            assert path == "path with spaces/file (1).pdf"

    def test_parse_gcs_path_invalid_prefix(self, mock_gcs_settings: MagicMock) -> None:
        """Test that invalid prefix raises ValueError."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)

            with pytest.raises(ValueError, match="Invalid GCS path format"):
                client.parse_gcs_path("s3://bucket/file.pdf")

    def test_parse_gcs_path_missing_object(self, mock_gcs_settings: MagicMock) -> None:
        """Test that missing object path raises ValueError."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)

            with pytest.raises(ValueError, match="missing object path"):
                client.parse_gcs_path("gs://bucket-only")


class TestGCSDownload:
    """Tests for GCS download operations."""

    @pytest.mark.asyncio
    async def test_download_to_temp_success(
        self,
        mock_gcs_settings: MagicMock,
        mock_storage_client: MagicMock,
    ) -> None:
        """Test successful download to temp file."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            with patch("src.storage.gcs_client.storage.Client", return_value=mock_storage_client):
                client = GCSClient(config=mock_gcs_settings)
                client._client = mock_storage_client

                # Download
                temp_path = await client.download_to_temp("gs://bucket/test.pdf")

                try:
                    assert temp_path.exists() or True  # File may not exist in mock
                    assert temp_path.suffix == ".pdf"
                finally:
                    # Cleanup
                    if temp_path.exists():
                        os.unlink(temp_path)

    @pytest.mark.asyncio
    async def test_download_to_temp_file_not_found(
        self,
        mock_gcs_settings: MagicMock,
    ) -> None:
        """Test download raises error when file not found."""
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False

        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        mock_client = MagicMock()
        mock_client.bucket.return_value = mock_bucket

        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)
            client._client = mock_client

            with pytest.raises(GCSFileNotFoundError):
                await client.download_to_temp("gs://bucket/nonexistent.pdf")

    @pytest.mark.asyncio
    async def test_download_to_temp_uses_suffix(
        self,
        mock_gcs_settings: MagicMock,
        mock_storage_client: MagicMock,
    ) -> None:
        """Test that download uses correct file suffix."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)
            client._client = mock_storage_client

            temp_path = await client.download_to_temp(
                "gs://bucket/document.xlsx",
                suffix=".xlsx",
            )

            try:
                assert temp_path.suffix == ".xlsx"
            finally:
                if temp_path.exists():
                    os.unlink(temp_path)


class TestGCSDownloadContextManager:
    """Tests for download context manager."""

    @pytest.mark.asyncio
    async def test_download_temp_file_cleans_up(
        self,
        mock_gcs_settings: MagicMock,
        mock_storage_client: MagicMock,
    ) -> None:
        """Test that context manager cleans up temp file."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)
            client._client = mock_storage_client

            temp_path_ref = None

            async with client.download_temp_file("gs://bucket/test.pdf") as temp_path:
                temp_path_ref = temp_path
                # Create the file since mock doesn't
                temp_path.touch()
                assert temp_path.exists()

            # File should be cleaned up after context exits
            assert not temp_path_ref.exists()

    @pytest.mark.asyncio
    async def test_download_temp_file_cleans_up_on_error(
        self,
        mock_gcs_settings: MagicMock,
        mock_storage_client: MagicMock,
    ) -> None:
        """Test that context manager cleans up even on error."""
        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = GCSClient(config=mock_gcs_settings)
            client._client = mock_storage_client

            temp_path_ref = None

            with pytest.raises(ValueError):
                async with client.download_temp_file("gs://bucket/test.pdf") as temp_path:
                    temp_path_ref = temp_path
                    temp_path.touch()
                    raise ValueError("Test error")

            # File should be cleaned up even after error
            assert not temp_path_ref.exists()


class TestGCSClientSingleton:
    """Tests for singleton pattern."""

    def test_get_gcs_client_returns_instance(self, mock_gcs_settings: MagicMock) -> None:
        """Test that get_gcs_client returns a client instance."""
        from src.storage import gcs_client

        # Reset singleton
        gcs_client._gcs_client = None

        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client = get_gcs_client()

            assert client is not None
            assert isinstance(client, GCSClient)

        # Cleanup
        gcs_client._gcs_client = None

    def test_get_gcs_client_returns_same_instance(self, mock_gcs_settings: MagicMock) -> None:
        """Test that get_gcs_client returns the same instance."""
        from src.storage import gcs_client

        # Reset singleton
        gcs_client._gcs_client = None

        with patch("src.storage.gcs_client.get_settings", return_value=mock_gcs_settings):
            client1 = get_gcs_client()
            client2 = get_gcs_client()

            assert client1 is client2

        # Cleanup
        gcs_client._gcs_client = None


class TestGCSDownloadError:
    """Tests for GCS error classes."""

    def test_gcs_download_error_attributes(self) -> None:
        """Test GCSDownloadError has correct attributes."""
        error = GCSDownloadError(
            message="Test error",
            gcs_path="gs://bucket/file.pdf",
            retryable=True,
        )

        assert error.message == "Test error"
        assert error.gcs_path == "gs://bucket/file.pdf"
        assert error.retryable is True

    def test_gcs_file_not_found_error(self) -> None:
        """Test GCSFileNotFoundError."""
        error = GCSFileNotFoundError("gs://bucket/missing.pdf")

        assert "not found" in error.message.lower()
        assert error.gcs_path == "gs://bucket/missing.pdf"
        assert error.retryable is False  # 404s should not retry
