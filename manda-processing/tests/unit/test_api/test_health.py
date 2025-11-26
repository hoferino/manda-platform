"""
Tests for health check endpoints.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #1, #6)
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Tests for the /health endpoint."""

    def test_health_returns_200(self, client: TestClient) -> None:
        """Test that /health returns 200 OK."""
        response = client.get("/health")

        assert response.status_code == 200

    def test_health_returns_healthy_status(self, client: TestClient) -> None:
        """Test that /health returns correct JSON structure."""
        response = client.get("/health")

        assert response.json() == {"status": "healthy"}

    def test_health_content_type_is_json(self, client: TestClient) -> None:
        """Test that /health returns JSON content type."""
        response = client.get("/health")

        assert "application/json" in response.headers["content-type"]


class TestReadyEndpoint:
    """Tests for the /ready endpoint."""

    def test_ready_returns_200_when_all_connected(
        self, client: TestClient, mock_settings: MagicMock
    ) -> None:
        """Test that /ready returns 200 when database and queue are connected."""
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        mock_conn.fetchval = AsyncMock(return_value=True)  # pg-boss tables exist
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            response = client.get("/ready")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["database"] == "connected"
        assert data["queue"] == "connected"

    def test_ready_returns_not_ready_when_db_disconnected(
        self, client: TestClient, mock_settings: MagicMock
    ) -> None:
        """Test that /ready returns not_ready when database is unavailable."""
        with patch("asyncpg.connect", side_effect=Exception("Connection refused")):
            response = client.get("/ready")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["database"] == "disconnected"

    def test_ready_returns_not_ready_when_pgboss_tables_missing(
        self, client: TestClient, mock_settings: MagicMock
    ) -> None:
        """Test that /ready returns not_ready when pg-boss tables don't exist."""
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        mock_conn.fetchval = AsyncMock(return_value=False)  # Tables don't exist
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            response = client.get("/ready")

        data = response.json()
        assert data["queue"] == "disconnected"

    def test_ready_response_structure(
        self, client: TestClient, mock_settings: MagicMock
    ) -> None:
        """Test that /ready returns correct JSON structure."""
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(return_value=None)
        mock_conn.fetchval = AsyncMock(return_value=True)
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            response = client.get("/ready")

        data = response.json()
        assert "status" in data
        assert "database" in data
        assert "queue" in data
        assert data["status"] in ["ready", "not_ready"]
        assert data["database"] in ["connected", "disconnected"]
        assert data["queue"] in ["connected", "disconnected"]
