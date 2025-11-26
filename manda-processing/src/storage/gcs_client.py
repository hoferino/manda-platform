"""
Google Cloud Storage client for document operations.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #2)

This module provides async-compatible GCS operations:
- Download files to temporary locations
- Automatic cleanup of temporary files
- Retry logic for transient errors
"""

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

import structlog
from google.cloud import storage
from google.cloud.exceptions import NotFound, GoogleCloudError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from src.config import Settings, get_settings

logger = structlog.get_logger(__name__)


class GCSDownloadError(Exception):
    """Raised when GCS download fails."""

    def __init__(self, message: str, gcs_path: str, retryable: bool = True):
        self.message = message
        self.gcs_path = gcs_path
        self.retryable = retryable
        super().__init__(message)


class GCSFileNotFoundError(GCSDownloadError):
    """Raised when file does not exist in GCS."""

    def __init__(self, gcs_path: str):
        super().__init__(
            f"File not found in GCS: {gcs_path}",
            gcs_path=gcs_path,
            retryable=False,  # Don't retry 404s
        )


class GCSClient:
    """
    Google Cloud Storage client for document operations.

    Provides async-compatible methods for downloading files
    with automatic retry logic and cleanup.
    """

    def __init__(self, config: Optional[Settings] = None):
        """
        Initialize the GCS client.

        Args:
            config: Application settings (uses defaults if not provided)
        """
        self.config = config or get_settings()
        self._client: Optional[storage.Client] = None

        # Ensure temp directory exists
        os.makedirs(self.config.parser_temp_dir, exist_ok=True)

        logger.info(
            "GCSClient initialized",
            bucket=self.config.gcs_bucket,
            temp_dir=self.config.parser_temp_dir,
        )

    @property
    def client(self) -> storage.Client:
        """Get or create the GCS client (lazy initialization)."""
        if self._client is None:
            # Use credentials from environment or service account
            if self.config.google_application_credentials:
                self._client = storage.Client.from_service_account_json(
                    self.config.google_application_credentials
                )
            else:
                self._client = storage.Client()
        return self._client

    def parse_gcs_path(self, gcs_path: str) -> tuple[str, str]:
        """
        Parse a GCS path into bucket and object path.

        Args:
            gcs_path: Full GCS path (gs://bucket/object/path)

        Returns:
            Tuple of (bucket_name, object_path)

        Raises:
            ValueError: If path format is invalid
        """
        if not gcs_path.startswith("gs://"):
            raise ValueError(f"Invalid GCS path format: {gcs_path}")

        path = gcs_path[5:]  # Remove 'gs://'
        parts = path.split("/", 1)

        if len(parts) < 2:
            raise ValueError(f"Invalid GCS path (missing object path): {gcs_path}")

        return parts[0], parts[1]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=0, max=90),
        retry=retry_if_exception_type(GoogleCloudError),
        reraise=True,
    )
    def _download_blob(
        self,
        bucket_name: str,
        object_path: str,
        destination_path: str,
    ) -> None:
        """
        Download a blob from GCS (synchronous, with retry).

        Args:
            bucket_name: Name of the GCS bucket
            object_path: Path to the object within the bucket
            destination_path: Local path to save the file
        """
        try:
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(object_path)

            if not blob.exists():
                raise GCSFileNotFoundError(f"gs://{bucket_name}/{object_path}")

            blob.download_to_filename(destination_path)

            logger.debug(
                "Blob downloaded",
                bucket=bucket_name,
                object_path=object_path,
                destination=destination_path,
            )

        except NotFound:
            raise GCSFileNotFoundError(f"gs://{bucket_name}/{object_path}")
        except GoogleCloudError as e:
            logger.warning(
                "GCS download error (will retry)",
                error=str(e),
                bucket=bucket_name,
                object_path=object_path,
            )
            raise

    async def download_to_temp(
        self,
        gcs_path: str,
        suffix: Optional[str] = None,
    ) -> Path:
        """
        Download a file from GCS to a temporary location.

        Args:
            gcs_path: Full GCS path (gs://bucket/object/path)
            suffix: Optional file suffix (e.g., '.pdf')

        Returns:
            Path to the downloaded temporary file

        Raises:
            GCSFileNotFoundError: If file doesn't exist
            GCSDownloadError: For other download failures
        """
        bucket_name, object_path = self.parse_gcs_path(gcs_path)

        # Determine suffix from object path if not provided
        if suffix is None:
            suffix = Path(object_path).suffix or ""

        # Create temp file
        fd, temp_path = tempfile.mkstemp(
            suffix=suffix,
            dir=self.config.parser_temp_dir,
        )
        os.close(fd)

        logger.info(
            "Downloading file from GCS",
            gcs_path=gcs_path,
            temp_path=temp_path,
        )

        try:
            # Run download in thread pool (it's I/O bound)
            await asyncio.get_event_loop().run_in_executor(
                None,
                self._download_blob,
                bucket_name,
                object_path,
                temp_path,
            )

            file_size = os.path.getsize(temp_path)
            logger.info(
                "File downloaded successfully",
                gcs_path=gcs_path,
                temp_path=temp_path,
                size_bytes=file_size,
            )

            return Path(temp_path)

        except GCSFileNotFoundError:
            # Clean up temp file on error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise
        except Exception as e:
            # Clean up temp file on error
            if os.path.exists(temp_path):
                os.unlink(temp_path)

            if isinstance(e, GCSDownloadError):
                raise

            raise GCSDownloadError(
                f"Failed to download from GCS: {str(e)}",
                gcs_path=gcs_path,
                retryable=True,
            )

    @asynccontextmanager
    async def download_temp_file(
        self,
        gcs_path: str,
        suffix: Optional[str] = None,
    ):
        """
        Context manager for downloading and auto-cleaning temporary files.

        Usage:
            async with gcs_client.download_temp_file("gs://bucket/file.pdf") as temp_path:
                # Use temp_path
                result = await parser.parse(temp_path)
            # File is automatically cleaned up

        Args:
            gcs_path: Full GCS path (gs://bucket/object/path)
            suffix: Optional file suffix

        Yields:
            Path to the temporary file
        """
        temp_path = await self.download_to_temp(gcs_path, suffix)
        try:
            yield temp_path
        finally:
            # Always clean up
            if temp_path.exists():
                try:
                    os.unlink(temp_path)
                    logger.debug("Temp file cleaned up", path=str(temp_path))
                except OSError as e:
                    logger.warning(
                        "Failed to cleanup temp file",
                        path=str(temp_path),
                        error=str(e),
                    )


# Global client instance
_gcs_client: Optional[GCSClient] = None


def get_gcs_client() -> GCSClient:
    """Get or create the global GCS client instance."""
    global _gcs_client
    if _gcs_client is None:
        _gcs_client = GCSClient()
    return _gcs_client


__all__ = [
    "GCSClient",
    "GCSDownloadError",
    "GCSFileNotFoundError",
    "get_gcs_client",
]
