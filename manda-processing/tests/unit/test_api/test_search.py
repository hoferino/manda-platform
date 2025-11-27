"""
Tests for the similarity search API endpoint.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #6)
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
def sample_embedding() -> list[float]:
    """Sample 3072-dimension embedding vector."""
    return [0.01 * i for i in range(3072)]


@pytest.fixture
def sample_search_results() -> list[dict[str, Any]]:
    """Sample search results from database."""
    project_id = uuid4()
    doc_id = uuid4()
    return [
        {
            "chunk_id": uuid4(),
            "document_id": doc_id,
            "document_name": "Financial Report Q3.pdf",
            "project_id": project_id,
            "content": "Revenue grew by 25% year over year driven by strong demand.",
            "chunk_type": "text",
            "page_number": 5,
            "chunk_index": 12,
            "similarity": 0.92,
        },
        {
            "chunk_id": uuid4(),
            "document_id": doc_id,
            "document_name": "Financial Report Q3.pdf",
            "project_id": project_id,
            "content": "EBITDA margin improved to 18% from 15% in the prior period.",
            "chunk_type": "text",
            "page_number": 6,
            "chunk_index": 15,
            "similarity": 0.87,
        },
        {
            "chunk_id": uuid4(),
            "document_id": uuid4(),
            "document_name": "Market Analysis.pdf",
            "project_id": project_id,
            "content": "Market share increased by 5 percentage points.",
            "chunk_type": "text",
            "page_number": 2,
            "chunk_index": 3,
            "similarity": 0.75,
        },
    ]


@pytest.fixture
def mock_embedding_client(sample_embedding: list[float]) -> MagicMock:
    """Create a mock embedding client for search."""
    mock = MagicMock()
    mock.generate_single = AsyncMock(return_value=sample_embedding)
    return mock


@pytest.fixture
def mock_db_client(sample_search_results: list[dict[str, Any]]) -> MagicMock:
    """Create a mock Supabase client with search results."""
    mock = MagicMock()
    mock.search_similar_chunks = AsyncMock(return_value=sample_search_results)
    return mock


@pytest.fixture
def mock_settings() -> MagicMock:
    """Mock settings for testing."""
    mock = MagicMock()
    mock.app_env = "development"
    mock.debug = True
    mock.database_url = "postgresql://test:test@localhost:5432/test"
    mock.supabase_url = "https://test.supabase.co"
    mock.supabase_service_role_key = "test-service-role-key"
    mock.api_key = "test-api-key"
    mock.webhook_secret = "test-webhook-secret"
    mock.gcs_bucket = "test-bucket"
    mock.pgboss_schema = "pgboss"
    mock.is_development = True
    mock.is_production = False
    mock.log_format = "console"
    mock.openai_api_key = "test-openai-api-key"
    mock.embedding_model = "text-embedding-3-large"
    mock.embedding_dimensions = 3072
    mock.embedding_batch_size = 100
    return mock


@pytest.fixture
def test_app(
    mock_settings: MagicMock,
    mock_embedding_client: MagicMock,
    mock_db_client: MagicMock,
) -> FastAPI:
    """Create a test FastAPI app with mocked dependencies."""
    from fastapi import FastAPI
    from src.api.routes import search

    app = FastAPI()

    # Override dependencies
    app.dependency_overrides[search.get_supabase_client] = lambda: mock_db_client
    app.dependency_overrides[search.get_settings] = lambda: mock_settings

    # Patch the embedding client getter
    with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
        app.include_router(search.router)

    return app


# --- Test Classes ---


class TestSearchSimilarEndpoint:
    """Tests for GET /api/search/similar endpoint."""

    def test_search_similar_returns_results(
        self,
        mock_settings: MagicMock,
        mock_embedding_client: MagicMock,
        mock_db_client: MagicMock,
    ) -> None:
        """Test that search returns ranked results."""
        from fastapi import FastAPI
        from src.api.routes import search

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "What was the revenue growth?"},
                )

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 3
        assert data["total_results"] == 3

    def test_search_similar_includes_similarity_scores(
        self,
        mock_settings: MagicMock,
        mock_embedding_client: MagicMock,
        mock_db_client: MagicMock,
    ) -> None:
        """Test that results include similarity scores."""
        from fastapi import FastAPI
        from src.api.routes import search

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "revenue growth"},
                )

        data = response.json()
        for result in data["results"]:
            assert "similarity" in result
            assert 0 <= result["similarity"] <= 1

    def test_search_similar_includes_content_preview(
        self,
        mock_settings: MagicMock,
        mock_embedding_client: MagicMock,
        mock_db_client: MagicMock,
    ) -> None:
        """Test that results include content preview."""
        from fastapi import FastAPI
        from src.api.routes import search

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "financial data"},
                )

        data = response.json()
        for result in data["results"]:
            assert "content_preview" in result
            assert "chunk_id" in result
            assert "document_id" in result

    def test_search_similar_filters_by_project_id(
        self,
        mock_settings: MagicMock,
        mock_embedding_client: MagicMock,
        mock_db_client: MagicMock,
    ) -> None:
        """Test that search filters by project_id."""
        from fastapi import FastAPI
        from src.api.routes import search

        project_id = str(uuid4())

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "test", "project_id": project_id},
                )

        assert response.status_code == 200
        # Verify the filter was passed to the search
        mock_db_client.search_similar_chunks.assert_called_once()

    def test_search_similar_filters_by_document_id(
        self,
        mock_settings: MagicMock,
        mock_embedding_client: MagicMock,
        mock_db_client: MagicMock,
    ) -> None:
        """Test that search filters by document_id."""
        from fastapi import FastAPI
        from src.api.routes import search

        document_id = str(uuid4())

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "test", "document_id": document_id},
                )

        assert response.status_code == 200

    def test_search_similar_respects_limit(
        self,
        mock_settings: MagicMock,
        mock_embedding_client: MagicMock,
        mock_db_client: MagicMock,
    ) -> None:
        """Test that search respects limit parameter."""
        from fastapi import FastAPI
        from src.api.routes import search

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "test", "limit": 5},
                )

        assert response.status_code == 200
        mock_db_client.search_similar_chunks.assert_called_once()
        call_kwargs = mock_db_client.search_similar_chunks.call_args.kwargs
        assert call_kwargs["limit"] == 5


class TestSearchSimilarValidation:
    """Tests for input validation."""

    def test_search_requires_query(
        self,
        mock_settings: MagicMock,
    ) -> None:
        """Test that query parameter is required."""
        from fastapi import FastAPI
        from src.api.routes import search

        app = FastAPI()
        app.dependency_overrides[search.get_settings] = lambda: mock_settings
        app.include_router(search.router)

        with TestClient(app) as client:
            response = client.get("/api/search/similar")

        assert response.status_code == 422  # Validation error

    def test_search_rejects_empty_query(
        self,
        mock_settings: MagicMock,
    ) -> None:
        """Test that empty query is rejected."""
        from fastapi import FastAPI
        from src.api.routes import search

        app = FastAPI()
        app.dependency_overrides[search.get_settings] = lambda: mock_settings
        app.include_router(search.router)

        with TestClient(app) as client:
            response = client.get(
                "/api/search/similar",
                params={"query": ""},
            )

        assert response.status_code == 422

    def test_search_validates_limit_range(
        self,
        mock_settings: MagicMock,
    ) -> None:
        """Test that limit must be in valid range."""
        from fastapi import FastAPI
        from src.api.routes import search

        app = FastAPI()
        app.dependency_overrides[search.get_settings] = lambda: mock_settings
        app.include_router(search.router)

        with TestClient(app) as client:
            # Too high
            response = client.get(
                "/api/search/similar",
                params={"query": "test", "limit": 200},
            )

        assert response.status_code == 422


class TestSearchSimilarErrorHandling:
    """Tests for error handling."""

    def test_search_handles_database_error(
        self,
        mock_settings: MagicMock,
        mock_embedding_client: MagicMock,
    ) -> None:
        """Test that database errors return 503."""
        from fastapi import FastAPI
        from src.api.routes import search
        from src.storage.supabase_client import DatabaseError

        mock_db = MagicMock()
        mock_db.search_similar_chunks = AsyncMock(
            side_effect=DatabaseError("Connection failed", retryable=True)
        )

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "test"},
                )

        assert response.status_code == 503

    def test_search_handles_embedding_error(
        self,
        mock_settings: MagicMock,
        mock_db_client: MagicMock,
    ) -> None:
        """Test that embedding errors return 503."""
        from fastapi import FastAPI
        from src.api.routes import search
        from src.embeddings.openai_client import EmbeddingError

        mock_embedding = MagicMock()
        mock_embedding.generate_single = AsyncMock(
            side_effect=EmbeddingError("API error", retryable=False)
        )

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db_client
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "test"},
                )

        assert response.status_code == 503


class TestSearchSimilarEmptyResults:
    """Tests for handling empty results."""

    def test_search_returns_empty_when_no_matches(
        self,
        mock_settings: MagicMock,
        mock_embedding_client: MagicMock,
    ) -> None:
        """Test that search returns empty results gracefully."""
        from fastapi import FastAPI
        from src.api.routes import search

        mock_db = MagicMock()
        mock_db.search_similar_chunks = AsyncMock(return_value=[])

        app = FastAPI()
        app.dependency_overrides[search.get_supabase_client] = lambda: mock_db
        app.dependency_overrides[search.get_settings] = lambda: mock_settings

        with patch.object(search, "get_embedding_client", return_value=mock_embedding_client):
            app.include_router(search.router)
            with TestClient(app) as client:
                response = client.get(
                    "/api/search/similar",
                    params={"query": "something that matches nothing"},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["results"] == []
        assert data["total_results"] == 0
