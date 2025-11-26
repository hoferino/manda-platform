"""
Tests for webhook endpoints.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #1, #5, #6)
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client(mock_settings: MagicMock) -> TestClient:
    """Create a test client with mocked settings."""
    return TestClient(app)


@pytest.fixture
def valid_payload() -> dict[str, Any]:
    """Valid webhook payload."""
    return {
        "document_id": str(uuid4()),
        "deal_id": str(uuid4()),
        "user_id": str(uuid4()),
        "gcs_path": "gs://manda-documents-dev/project-123/documents/test.pdf",
        "file_type": "application/pdf",
        "file_name": "test.pdf",
    }


@pytest.fixture
def mock_job_queue():
    """Mock job queue."""
    mock = MagicMock()
    mock.enqueue = AsyncMock(return_value=str(uuid4()))
    return mock


class TestDocumentUploadedWebhook:
    """Tests for /webhooks/document-uploaded endpoint."""

    def test_requires_api_key(self, client: TestClient, valid_payload: dict) -> None:
        """Test that endpoint requires API key."""
        response = client.post("/webhooks/document-uploaded", json=valid_payload)

        assert response.status_code == 401

    def test_rejects_invalid_api_key(
        self, client: TestClient, valid_payload: dict
    ) -> None:
        """Test that invalid API key is rejected."""
        response = client.post(
            "/webhooks/document-uploaded",
            json=valid_payload,
            headers={"X-API-Key": "invalid-key"},
        )

        assert response.status_code == 401

    def test_accepts_valid_api_key(
        self,
        client: TestClient,
        valid_payload: dict,
        mock_settings: MagicMock,
        mock_job_queue: MagicMock,
    ) -> None:
        """Test that valid API key is accepted."""
        with patch("src.api.routes.webhooks.get_job_queue", new_callable=AsyncMock) as mock_get_queue:
            mock_get_queue.return_value = mock_job_queue

            response = client.post(
                "/webhooks/document-uploaded",
                json=valid_payload,
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200

    def test_enqueues_job(
        self,
        client: TestClient,
        valid_payload: dict,
        mock_settings: MagicMock,
        mock_job_queue: MagicMock,
    ) -> None:
        """Test that webhook enqueues a parsing job."""
        with patch("src.api.routes.webhooks.get_job_queue", new_callable=AsyncMock) as mock_get_queue:
            mock_get_queue.return_value = mock_job_queue

            response = client.post(
                "/webhooks/document-uploaded",
                json=valid_payload,
                headers={"X-API-Key": "test-api-key"},
            )

            mock_job_queue.enqueue.assert_called_once()
            call_args = mock_job_queue.enqueue.call_args
            assert call_args[0][0] == "document-parse"
            assert call_args[0][1]["document_id"] == valid_payload["document_id"]

    def test_returns_job_id(
        self,
        client: TestClient,
        valid_payload: dict,
        mock_settings: MagicMock,
        mock_job_queue: MagicMock,
    ) -> None:
        """Test that response includes job ID."""
        expected_job_id = str(uuid4())
        mock_job_queue.enqueue = AsyncMock(return_value=expected_job_id)

        with patch("src.api.routes.webhooks.get_job_queue", new_callable=AsyncMock) as mock_get_queue:
            mock_get_queue.return_value = mock_job_queue

            response = client.post(
                "/webhooks/document-uploaded",
                json=valid_payload,
                headers={"X-API-Key": "test-api-key"},
            )

            data = response.json()
            assert data["success"] is True
            assert data["job_id"] == expected_job_id

    def test_validates_payload(
        self, client: TestClient, mock_settings: MagicMock
    ) -> None:
        """Test that invalid payload is rejected."""
        invalid_payload = {
            "document_id": "not-a-uuid",  # Invalid UUID
        }

        response = client.post(
            "/webhooks/document-uploaded",
            json=invalid_payload,
            headers={"X-API-Key": "test-api-key"},
        )

        assert response.status_code == 422  # Validation error

    def test_handles_enqueue_failure(
        self,
        client: TestClient,
        valid_payload: dict,
        mock_settings: MagicMock,
    ) -> None:
        """Test that enqueue failures return 500."""
        mock_queue = MagicMock()
        mock_queue.enqueue = AsyncMock(side_effect=Exception("Queue error"))

        with patch("src.api.routes.webhooks.get_job_queue", new_callable=AsyncMock) as mock_get_queue:
            mock_get_queue.return_value = mock_queue

            response = client.post(
                "/webhooks/document-uploaded",
                json=valid_payload,
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 500


class TestDocumentUploadedBatchWebhook:
    """Tests for /webhooks/document-uploaded/batch endpoint."""

    def test_batch_processes_multiple(
        self,
        client: TestClient,
        valid_payload: dict,
        mock_settings: MagicMock,
        mock_job_queue: MagicMock,
    ) -> None:
        """Test that batch endpoint processes multiple documents."""
        payloads = [
            {**valid_payload, "document_id": str(uuid4())},
            {**valid_payload, "document_id": str(uuid4())},
            {**valid_payload, "document_id": str(uuid4())},
        ]

        with patch("src.api.routes.webhooks.get_job_queue", new_callable=AsyncMock) as mock_get_queue:
            mock_get_queue.return_value = mock_job_queue

            response = client.post(
                "/webhooks/document-uploaded/batch",
                json=payloads,
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 3
            assert all(r["success"] for r in data)

    def test_batch_handles_partial_failures(
        self,
        client: TestClient,
        valid_payload: dict,
        mock_settings: MagicMock,
    ) -> None:
        """Test that batch handles partial failures gracefully."""
        payloads = [
            {**valid_payload, "document_id": str(uuid4())},
            {**valid_payload, "document_id": str(uuid4())},
        ]

        # First call succeeds, second fails
        call_count = 0

        async def mock_enqueue(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise Exception("Second call fails")
            return str(uuid4())

        mock_queue = MagicMock()
        mock_queue.enqueue = mock_enqueue

        with patch("src.api.routes.webhooks.get_job_queue", new_callable=AsyncMock) as mock_get_queue:
            mock_get_queue.return_value = mock_queue

            response = client.post(
                "/webhooks/document-uploaded/batch",
                json=payloads,
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data[0]["success"] is True
            assert data[1]["success"] is False


class TestWebhookPayloadValidation:
    """Tests for webhook payload validation."""

    def test_requires_document_id(
        self, client: TestClient, valid_payload: dict, mock_settings: MagicMock
    ) -> None:
        """Test that document_id is required."""
        del valid_payload["document_id"]

        response = client.post(
            "/webhooks/document-uploaded",
            json=valid_payload,
            headers={"X-API-Key": "test-api-key"},
        )

        assert response.status_code == 422

    def test_requires_deal_id(
        self, client: TestClient, valid_payload: dict, mock_settings: MagicMock
    ) -> None:
        """Test that deal_id is required."""
        del valid_payload["deal_id"]

        response = client.post(
            "/webhooks/document-uploaded",
            json=valid_payload,
            headers={"X-API-Key": "test-api-key"},
        )

        assert response.status_code == 422

    def test_requires_gcs_path(
        self, client: TestClient, valid_payload: dict, mock_settings: MagicMock
    ) -> None:
        """Test that gcs_path is required."""
        del valid_payload["gcs_path"]

        response = client.post(
            "/webhooks/document-uploaded",
            json=valid_payload,
            headers={"X-API-Key": "test-api-key"},
        )

        assert response.status_code == 422

    def test_file_name_optional(
        self,
        client: TestClient,
        valid_payload: dict,
        mock_settings: MagicMock,
        mock_job_queue: MagicMock,
    ) -> None:
        """Test that file_name is optional."""
        del valid_payload["file_name"]

        with patch("src.api.routes.webhooks.get_job_queue", new_callable=AsyncMock) as mock_get_queue:
            mock_get_queue.return_value = mock_job_queue

            response = client.post(
                "/webhooks/document-uploaded",
                json=valid_payload,
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200
