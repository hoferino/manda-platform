"""
API endpoint tests for the Graphiti knowledge ingest endpoint.
Story: E11.3 - Agent-Autonomous Knowledge Write-Back (AC: #4, #6)

These tests verify the POST /api/graphiti/ingest endpoint handles
requests correctly with mocked dependencies. They test:
- Request/response handling
- Input validation
- Error handling
- Authentication flow

NOTE: These tests mock GraphitiIngestionService and Supabase client.
For true integration tests with actual Neo4j/Graphiti, see the
manual E2E verification in the story's Task 7.
"""

import os
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Set test environment variables before importing app
os.environ.setdefault("OPENAI_API_KEY", "test-openai-api-key")


# --- Fixtures ---


@pytest.fixture
def sample_deal_id() -> str:
    """Sample deal UUID."""
    return str(uuid4())


@pytest.fixture
def mock_settings() -> MagicMock:
    """Mock settings for testing."""
    mock = MagicMock()
    mock.app_env = "development"
    mock.debug = True
    mock.api_key = "test-api-key"
    return mock


@pytest.fixture
def mock_db_client(sample_deal_id: str) -> MagicMock:
    """Create a mock Supabase client that returns a valid deal."""
    mock = MagicMock()
    # Mock table().select().eq().execute() chain
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()
    mock_execute = MagicMock()
    mock_execute.data = [{"id": sample_deal_id}]
    mock_eq.execute = AsyncMock(return_value=mock_execute)
    mock_select.eq = MagicMock(return_value=mock_eq)
    mock_table.select = MagicMock(return_value=mock_select)
    mock.client.table = MagicMock(return_value=mock_table)
    return mock


@pytest.fixture
def mock_db_client_no_deal() -> MagicMock:
    """Create a mock Supabase client that returns no deal."""
    mock = MagicMock()
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()
    mock_execute = MagicMock()
    mock_execute.data = []  # Empty = deal not found
    mock_eq.execute = AsyncMock(return_value=mock_execute)
    mock_select.eq = MagicMock(return_value=mock_eq)
    mock_table.select = MagicMock(return_value=mock_select)
    mock.client.table = MagicMock(return_value=mock_table)
    return mock


@pytest.fixture
def mock_graphiti_service() -> MagicMock:
    """Create a mock Graphiti ingestion service."""
    mock = MagicMock()
    mock_result = MagicMock()
    mock_result.episode_count = 1
    mock_result.elapsed_ms = 150
    mock_result.estimated_cost_usd = 0.00001
    mock.ingest_chat_fact = AsyncMock(return_value=mock_result)
    return mock


# --- Test Classes ---


class TestGraphitiIngestEndpoint:
    """Tests for POST /api/graphiti/ingest endpoint."""

    def test_ingest_returns_success_for_valid_request(
        self,
        mock_settings: MagicMock,
        mock_db_client: MagicMock,
        mock_graphiti_service: MagicMock,
        sample_deal_id: str,
    ) -> None:
        """Test that ingest returns success for valid input (AC: #4)."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key
        from src.storage.supabase_client import get_supabase_client

        app = FastAPI()

        # Override dependencies
        app.dependency_overrides[get_supabase_client] = lambda: mock_db_client
        # Skip API key validation for tests
        app.dependency_overrides[verify_api_key] = lambda: "test-key"

        # Patch where GraphitiIngestionService is imported (lazy import inside function)
        with patch(
            "src.graphiti.ingestion.GraphitiIngestionService",
            return_value=mock_graphiti_service,
        ):
            app.include_router(graphiti.router)
            with TestClient(app) as client:
                response = client.post(
                    "/api/graphiti/ingest",
                    json={
                        "deal_id": sample_deal_id,
                        "content": "Q3 revenue was $5.2M, not $4.8M",
                        "source_type": "correction",
                    },
                )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["episode_count"] == 1
        assert "elapsed_ms" in data
        assert "estimated_cost_usd" in data

    def test_ingest_accepts_all_source_types(
        self,
        mock_settings: MagicMock,
        mock_db_client: MagicMock,
        mock_graphiti_service: MagicMock,
        sample_deal_id: str,
    ) -> None:
        """Test that ingest accepts correction, confirmation, new_info (AC: #7)."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key
        from src.storage.supabase_client import get_supabase_client

        source_types = ["correction", "confirmation", "new_info"]

        for source_type in source_types:
            app = FastAPI()
            app.dependency_overrides[get_supabase_client] = lambda: mock_db_client
            app.dependency_overrides[verify_api_key] = lambda: "test-key"

            # Patch where GraphitiIngestionService is imported (lazy import inside function)
            with patch(
                "src.graphiti.ingestion.GraphitiIngestionService",
                return_value=mock_graphiti_service,
            ):
                app.include_router(graphiti.router)
                with TestClient(app) as client:
                    response = client.post(
                        "/api/graphiti/ingest",
                        json={
                            "deal_id": sample_deal_id,
                            "content": f"Test content for {source_type}",
                            "source_type": source_type,
                        },
                    )

            assert response.status_code == 200, f"Failed for source_type: {source_type}"

    def test_ingest_returns_404_for_nonexistent_deal(
        self,
        mock_settings: MagicMock,
        mock_db_client_no_deal: MagicMock,
    ) -> None:
        """Test that ingest returns 404 for non-existent deal."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key
        from src.storage.supabase_client import get_supabase_client

        app = FastAPI()
        app.dependency_overrides[get_supabase_client] = lambda: mock_db_client_no_deal
        app.dependency_overrides[verify_api_key] = lambda: "test-key"

        app.include_router(graphiti.router)
        with TestClient(app) as client:
            response = client.post(
                "/api/graphiti/ingest",
                json={
                    "deal_id": str(uuid4()),
                    "content": "Some content to ingest",
                    "source_type": "new_info",
                },
            )

        assert response.status_code == 404
        assert "Deal not found" in response.json()["detail"]


class TestGraphitiIngestValidation:
    """Tests for input validation."""

    def test_ingest_rejects_content_too_short(
        self,
        mock_settings: MagicMock,
        sample_deal_id: str,
    ) -> None:
        """Test that content shorter than 10 chars is rejected."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key

        app = FastAPI()
        # Override the actual dependency function, not the type alias
        app.dependency_overrides[verify_api_key] = lambda: "test-key"
        app.include_router(graphiti.router)

        with TestClient(app) as client:
            response = client.post(
                "/api/graphiti/ingest",
                json={
                    "deal_id": sample_deal_id,
                    "content": "Too short",  # Exactly 9 chars
                    "source_type": "new_info",
                },
            )

        assert response.status_code == 422  # Validation error

    def test_ingest_rejects_invalid_source_type(
        self,
        mock_settings: MagicMock,
        sample_deal_id: str,
    ) -> None:
        """Test that invalid source_type is rejected."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key

        app = FastAPI()
        app.dependency_overrides[verify_api_key] = lambda: "test-key"
        app.include_router(graphiti.router)

        with TestClient(app) as client:
            response = client.post(
                "/api/graphiti/ingest",
                json={
                    "deal_id": sample_deal_id,
                    "content": "Valid content length here",
                    "source_type": "invalid_type",
                },
            )

        assert response.status_code == 422  # Validation error

    def test_ingest_rejects_invalid_uuid(
        self,
        mock_settings: MagicMock,
    ) -> None:
        """Test that invalid deal_id UUID is rejected."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key

        app = FastAPI()
        app.dependency_overrides[verify_api_key] = lambda: "test-key"
        app.include_router(graphiti.router)

        with TestClient(app) as client:
            response = client.post(
                "/api/graphiti/ingest",
                json={
                    "deal_id": "not-a-valid-uuid",
                    "content": "Valid content length here",
                    "source_type": "new_info",
                },
            )

        assert response.status_code == 422  # Validation error

    def test_ingest_requires_all_fields(
        self,
        mock_settings: MagicMock,
        sample_deal_id: str,
    ) -> None:
        """Test that all required fields must be present."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key

        app = FastAPI()
        app.dependency_overrides[verify_api_key] = lambda: "test-key"
        app.include_router(graphiti.router)

        # Missing content
        with TestClient(app) as client:
            response = client.post(
                "/api/graphiti/ingest",
                json={
                    "deal_id": sample_deal_id,
                    "source_type": "new_info",
                },
            )
        assert response.status_code == 422

        # Missing source_type
        with TestClient(app) as client:
            response = client.post(
                "/api/graphiti/ingest",
                json={
                    "deal_id": sample_deal_id,
                    "content": "Valid content here",
                },
            )
        assert response.status_code == 422

        # Missing deal_id
        with TestClient(app) as client:
            response = client.post(
                "/api/graphiti/ingest",
                json={
                    "content": "Valid content here",
                    "source_type": "new_info",
                },
            )
        assert response.status_code == 422


class TestGraphitiIngestErrorHandling:
    """Tests for error handling."""

    def test_ingest_handles_service_error(
        self,
        mock_settings: MagicMock,
        mock_db_client: MagicMock,
        sample_deal_id: str,
    ) -> None:
        """Test that service errors return 500."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key
        from src.storage.supabase_client import get_supabase_client

        mock_graphiti = MagicMock()
        mock_graphiti.ingest_chat_fact = AsyncMock(
            side_effect=Exception("Graphiti service error")
        )

        app = FastAPI()
        app.dependency_overrides[get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[verify_api_key] = lambda: "test-key"

        # Patch where GraphitiIngestionService is imported (lazy import inside function)
        with patch(
            "src.graphiti.ingestion.GraphitiIngestionService",
            return_value=mock_graphiti,
        ):
            app.include_router(graphiti.router)
            with TestClient(app) as client:
                response = client.post(
                    "/api/graphiti/ingest",
                    json={
                        "deal_id": sample_deal_id,
                        "content": "Content that will cause error",
                        "source_type": "new_info",
                    },
                )

        assert response.status_code == 500
        assert "service unavailable" in response.json()["detail"].lower()


class TestGraphitiIngestOptionalFields:
    """Tests for optional fields."""

    def test_ingest_accepts_message_context(
        self,
        mock_settings: MagicMock,
        mock_db_client: MagicMock,
        mock_graphiti_service: MagicMock,
        sample_deal_id: str,
    ) -> None:
        """Test that message_context is passed to service."""
        from fastapi import FastAPI
        from src.api.routes import graphiti
        from src.api.dependencies import verify_api_key
        from src.storage.supabase_client import get_supabase_client

        app = FastAPI()
        app.dependency_overrides[get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[verify_api_key] = lambda: "test-key"

        # Patch where GraphitiIngestionService is imported (lazy import inside function)
        with patch(
            "src.graphiti.ingestion.GraphitiIngestionService",
            return_value=mock_graphiti_service,
        ):
            app.include_router(graphiti.router)
            with TestClient(app) as client:
                response = client.post(
                    "/api/graphiti/ingest",
                    json={
                        "deal_id": sample_deal_id,
                        "content": "Q3 revenue was $5.2M",
                        "source_type": "new_info",
                        "message_context": "User said: Actually Q3 revenue was $5.2M, not $4.8M as stated in the document.",
                    },
                )

        assert response.status_code == 200
        # Verify service was called with message_context
        mock_graphiti_service.ingest_chat_fact.assert_called_once()
        call_kwargs = mock_graphiti_service.ingest_chat_fact.call_args.kwargs
        assert "message_context" in call_kwargs
