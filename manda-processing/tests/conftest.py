"""
Pytest configuration and shared fixtures.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #6)
"""

import os
from collections.abc import AsyncGenerator, Generator
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# Set test environment variables before importing app
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("API_KEY", "test-api-key")
os.environ.setdefault("WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("GCS_BUCKET", "test-bucket")


@pytest.fixture
def mock_settings() -> Generator[MagicMock, None, None]:
    """Mock settings for testing."""
    from src.config import Settings

    mock = MagicMock(spec=Settings)
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

    with patch("src.config.get_settings", return_value=mock):
        yield mock


@pytest.fixture
def client(mock_settings: MagicMock) -> Generator[TestClient, None, None]:
    """Create a test client for the FastAPI app."""
    from src.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
async def async_client(mock_settings: MagicMock) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client for the FastAPI app."""
    from src.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_asyncpg_connection() -> Generator[AsyncMock, None, None]:
    """Mock asyncpg connection for database operations."""
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock(return_value=None)
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_conn.fetchval = AsyncMock(return_value=True)
    mock_conn.close = AsyncMock()

    with patch("asyncpg.connect", return_value=mock_conn):
        yield mock_conn


@pytest.fixture
def mock_db_pool() -> Generator[AsyncMock, None, None]:
    """Mock asyncpg pool for database operations."""
    mock_pool = AsyncMock()
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock(return_value=None)
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_conn.fetchval = AsyncMock(return_value=True)

    mock_pool.acquire = AsyncMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    mock_pool.close = AsyncMock()

    with patch("src.jobs.queue.get_pool", return_value=mock_pool):
        yield mock_pool


@pytest.fixture
def sample_job_data() -> dict[str, Any]:
    """Sample job data for testing."""
    return {
        "document_id": "test-doc-123",
        "deal_id": "test-deal-456",
        "user_id": "test-user-789",
        "file_path": "gs://test-bucket/test-file.pdf",
        "file_type": "pdf",
    }


# Parser fixtures (E3.2)
@pytest.fixture
def mock_parser_settings() -> Generator[MagicMock, None, None]:
    """Mock settings for parser testing."""
    from src.config import Settings

    mock = MagicMock(spec=Settings)
    mock.parser_temp_dir = "/tmp/manda-processing-test"
    mock.parser_ocr_enabled = True
    mock.parser_max_file_size_mb = 100
    mock.chunk_min_tokens = 512
    mock.chunk_max_tokens = 1024
    mock.chunk_overlap_tokens = 50
    mock.app_env = "development"
    mock.is_development = True

    with patch("src.config.get_settings", return_value=mock):
        yield mock


@pytest.fixture
def fixtures_dir() -> Path:
    """Path to test fixtures directory."""
    from pathlib import Path
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_text() -> str:
    """Sample text for chunking tests."""
    return """
    The company reported strong Q3 2024 results with revenue of $150 million,
    representing a 25% year-over-year growth. EBITDA margin improved to 18%
    from 15% in the prior year period.

    Key highlights include:
    - Customer acquisition increased by 30%
    - Operating expenses reduced by 10%
    - Cash flow from operations reached $45 million

    Management raised full-year guidance citing strong demand trends and
    operational efficiencies. The company expects to maintain momentum
    through Q4 with several new product launches planned.
    """


@pytest.fixture
def sample_table_markdown() -> str:
    """Sample markdown table for testing."""
    return """| Metric | Q3 2024 | Q3 2023 | Change |
| --- | --- | --- | --- |
| Revenue | $150M | $120M | +25% |
| EBITDA | $27M | $18M | +50% |
| Net Income | $15M | $10M | +50% |
| Customers | 10,000 | 7,700 | +30% |"""


@pytest.fixture
def sample_formulas() -> list[tuple[str, str, str]]:
    """Sample Excel formulas for testing: (formula, cell_ref, sheet)."""
    return [
        ("=SUM(A1:A10)", "A11", "Sheet1"),
        ("=B5*C5", "D5", "Revenue"),
        ("=VLOOKUP(A1,Sheet2!A:B,2,FALSE)", "B1", "Lookup"),
        ("=IF(A1>100,\"High\",\"Low\")", "B1", "Analysis"),
        ("=AVERAGE(B2:B100)", "B101", "Metrics"),
    ]
