"""
Tests for processing queue API endpoints.
Story: E3.7 - Implement Processing Queue Visibility (AC: #3, #4)
"""

import json
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
def project_id() -> str:
    """Generate a project ID."""
    return str(uuid4())


@pytest.fixture
def mock_pool():
    """Mock database pool."""
    pool = MagicMock()
    conn = MagicMock()

    # Setup async context manager
    pool.acquire = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)

    return pool, conn


class TestGetQueueJobs:
    """Tests for GET /api/processing/queue endpoint."""

    def test_requires_api_key(self, client: TestClient, project_id: str) -> None:
        """Test that endpoint requires API key."""
        response = client.get(f"/api/processing/queue?project_id={project_id}")
        assert response.status_code == 401

    def test_rejects_invalid_api_key(
        self, client: TestClient, project_id: str
    ) -> None:
        """Test that invalid API key is rejected."""
        response = client.get(
            f"/api/processing/queue?project_id={project_id}",
            headers={"X-API-Key": "invalid-key"},
        )
        assert response.status_code == 401

    def test_requires_project_id(
        self, client: TestClient, mock_settings: MagicMock
    ) -> None:
        """Test that project_id is required."""
        response = client.get(
            "/api/processing/queue",
            headers={"X-API-Key": "test-api-key"},
        )
        assert response.status_code == 422  # Validation error

    def test_returns_queue_jobs(
        self,
        client: TestClient,
        project_id: str,
        mock_settings: MagicMock,
        mock_pool: tuple,
    ) -> None:
        """Test that queue jobs are returned."""
        pool, conn = mock_pool

        # Setup mock job data
        job_id = str(uuid4())
        doc_id = str(uuid4())
        job_data = json.dumps({"document_id": doc_id})

        conn.fetch = AsyncMock(return_value=[
            {
                "id": job_id,
                "name": "document-parse",
                "state": "created",
                "data": job_data,
                "createdon": MagicMock(isoformat=lambda: "2024-01-01T00:00:00"),
                "startedon": None,
                "retrycount": 0,
                "output": None,
                "doc_id": doc_id,
                "file_name": "test.pdf",
                "file_type": "application/pdf",
                "processing_status": "pending",
            }
        ])
        conn.fetchrow = AsyncMock(return_value={"total": 1})

        with patch("src.api.routes.processing.get_pool", new_callable=AsyncMock) as mock_get_pool:
            mock_get_pool.return_value = pool

            response = client.get(
                f"/api/processing/queue?project_id={project_id}",
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "jobs" in data
            assert data["total"] == 1
            assert len(data["jobs"]) == 1
            assert data["jobs"][0]["documentId"] == doc_id

    def test_pagination(
        self,
        client: TestClient,
        project_id: str,
        mock_settings: MagicMock,
        mock_pool: tuple,
    ) -> None:
        """Test pagination parameters."""
        pool, conn = mock_pool
        conn.fetch = AsyncMock(return_value=[])
        conn.fetchrow = AsyncMock(return_value={"total": 0})

        with patch("src.api.routes.processing.get_pool", new_callable=AsyncMock) as mock_get_pool:
            mock_get_pool.return_value = pool

            response = client.get(
                f"/api/processing/queue?project_id={project_id}&limit=10&offset=5",
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200
            # Verify limit and offset were used
            call_args = conn.fetch.call_args
            assert call_args[0][1] == project_id  # First arg after query
            assert call_args[0][2] == 11  # limit + 1 for hasMore check
            assert call_args[0][3] == 5  # offset

    def test_maps_job_states(
        self,
        client: TestClient,
        project_id: str,
        mock_settings: MagicMock,
        mock_pool: tuple,
    ) -> None:
        """Test that job states are mapped correctly."""
        pool, conn = mock_pool

        doc_id = str(uuid4())
        conn.fetch = AsyncMock(return_value=[
            {
                "id": str(uuid4()),
                "name": "document-parse",
                "state": "created",
                "data": json.dumps({"document_id": doc_id}),
                "createdon": MagicMock(isoformat=lambda: "2024-01-01T00:00:00"),
                "startedon": None,
                "retrycount": 0,
                "output": None,
                "doc_id": doc_id,
                "file_name": "test1.pdf",
                "file_type": "application/pdf",
                "processing_status": "pending",
            },
            {
                "id": str(uuid4()),
                "name": "document-parse",
                "state": "active",
                "data": json.dumps({"document_id": doc_id}),
                "createdon": MagicMock(isoformat=lambda: "2024-01-01T00:00:00"),
                "startedon": MagicMock(isoformat=lambda: "2024-01-01T00:01:00"),
                "retrycount": 0,
                "output": None,
                "doc_id": doc_id,
                "file_name": "test2.pdf",
                "file_type": "application/pdf",
                "processing_status": "parsing",
            },
        ])
        conn.fetchrow = AsyncMock(return_value={"total": 2})

        with patch("src.api.routes.processing.get_pool", new_callable=AsyncMock) as mock_get_pool:
            mock_get_pool.return_value = pool

            response = client.get(
                f"/api/processing/queue?project_id={project_id}",
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["jobs"][0]["status"] == "queued"
            assert data["jobs"][1]["status"] == "processing"
            assert data["jobs"][1]["processingStage"] == "parsing"


class TestCancelJob:
    """Tests for DELETE /api/processing/queue/{job_id} endpoint."""

    def test_requires_api_key(
        self, client: TestClient, project_id: str
    ) -> None:
        """Test that endpoint requires API key."""
        job_id = str(uuid4())
        response = client.delete(
            f"/api/processing/queue/{job_id}?project_id={project_id}"
        )
        assert response.status_code == 401

    def test_requires_project_id(
        self, client: TestClient, mock_settings: MagicMock
    ) -> None:
        """Test that project_id is required."""
        job_id = str(uuid4())
        response = client.delete(
            f"/api/processing/queue/{job_id}",
            headers={"X-API-Key": "test-api-key"},
        )
        assert response.status_code == 422

    def test_returns_404_for_unknown_job(
        self,
        client: TestClient,
        project_id: str,
        mock_settings: MagicMock,
        mock_pool: tuple,
    ) -> None:
        """Test that 404 is returned for unknown job."""
        pool, conn = mock_pool
        conn.fetchrow = AsyncMock(return_value=None)

        with patch("src.api.routes.processing.get_pool", new_callable=AsyncMock) as mock_get_pool:
            mock_get_pool.return_value = pool

            job_id = str(uuid4())
            response = client.delete(
                f"/api/processing/queue/{job_id}?project_id={project_id}",
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 404

    def test_returns_403_for_wrong_project(
        self,
        client: TestClient,
        project_id: str,
        mock_settings: MagicMock,
        mock_pool: tuple,
    ) -> None:
        """Test that 403 is returned for job from different project."""
        pool, conn = mock_pool
        different_project = uuid4()

        conn.fetchrow = AsyncMock(return_value={
            "id": str(uuid4()),
            "state": "created",
            "data": json.dumps({"document_id": str(uuid4())}),
            "project_id": different_project,
        })

        with patch("src.api.routes.processing.get_pool", new_callable=AsyncMock) as mock_get_pool:
            mock_get_pool.return_value = pool

            job_id = str(uuid4())
            response = client.delete(
                f"/api/processing/queue/{job_id}?project_id={project_id}",
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 403

    def test_returns_400_for_active_job(
        self,
        client: TestClient,
        project_id: str,
        mock_settings: MagicMock,
        mock_pool: tuple,
    ) -> None:
        """Test that 400 is returned for active (processing) jobs."""
        pool, conn = mock_pool
        project_uuid = uuid4()

        conn.fetchrow = AsyncMock(return_value={
            "id": str(uuid4()),
            "state": "active",  # Job is processing, not cancellable
            "data": json.dumps({"document_id": str(uuid4())}),
            "project_id": project_uuid,
        })

        with patch("src.api.routes.processing.get_pool", new_callable=AsyncMock) as mock_get_pool:
            mock_get_pool.return_value = pool

            job_id = str(uuid4())
            response = client.delete(
                f"/api/processing/queue/{job_id}?project_id={project_uuid}",
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 400
            assert "active" in response.json()["detail"].lower()

    def test_cancels_queued_job(
        self,
        client: TestClient,
        project_id: str,
        mock_settings: MagicMock,
        mock_pool: tuple,
    ) -> None:
        """Test that queued job can be cancelled."""
        pool, conn = mock_pool
        project_uuid = uuid4()
        doc_id = str(uuid4())
        job_id = str(uuid4())

        # First call returns job info
        # Second call (update) returns the job ID
        conn.fetchrow = AsyncMock(side_effect=[
            {
                "id": job_id,
                "state": "created",
                "data": json.dumps({"document_id": doc_id}),
                "project_id": project_uuid,
            },
            {"id": job_id},  # Update result
        ])

        mock_db = MagicMock()
        mock_db.update_document_status = AsyncMock()

        with (
            patch("src.api.routes.processing.get_pool", new_callable=AsyncMock) as mock_get_pool,
            patch("src.api.routes.processing.get_supabase_client") as mock_get_db,
        ):
            mock_get_pool.return_value = pool
            mock_get_db.return_value = mock_db

            response = client.delete(
                f"/api/processing/queue/{job_id}?project_id={project_uuid}",
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_updates_document_status_on_cancel(
        self,
        client: TestClient,
        project_id: str,
        mock_settings: MagicMock,
        mock_pool: tuple,
    ) -> None:
        """Test that document status is updated when job is cancelled."""
        pool, conn = mock_pool
        project_uuid = uuid4()
        doc_id = str(uuid4())
        job_id = str(uuid4())

        conn.fetchrow = AsyncMock(side_effect=[
            {
                "id": job_id,
                "state": "created",
                "data": json.dumps({"document_id": doc_id}),
                "project_id": project_uuid,
            },
            {"id": job_id},
        ])

        mock_db = MagicMock()
        mock_db.update_document_status = AsyncMock()

        with (
            patch("src.api.routes.processing.get_pool", new_callable=AsyncMock) as mock_get_pool,
            patch("src.api.routes.processing.get_supabase_client") as mock_get_db,
        ):
            mock_get_pool.return_value = pool
            mock_get_db.return_value = mock_db

            response = client.delete(
                f"/api/processing/queue/{job_id}?project_id={project_uuid}",
                headers={"X-API-Key": "test-api-key"},
            )

            assert response.status_code == 200
            # Verify document status was updated
            mock_db.update_document_status.assert_called_once()
