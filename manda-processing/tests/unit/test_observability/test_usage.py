"""
Unit tests for observability usage logging.
Story: E12.2 - Usage Logging Integration (AC: #1, #4, #5)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4
from contextlib import asynccontextmanager

import asyncpg


def create_mock_db_client(fetchrow_return_value):
    """Create a properly mocked database client."""
    mock_db = MagicMock()
    mock_pool = AsyncMock()
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=fetchrow_return_value)

    @asynccontextmanager
    async def mock_acquire():
        yield mock_conn

    mock_pool.acquire = mock_acquire
    mock_db._get_pool = AsyncMock(return_value=mock_pool)

    return mock_db, mock_conn


class TestLogLLMUsageToDb:
    """Tests for log_llm_usage_to_db function."""

    @pytest.mark.asyncio
    async def test_log_llm_usage_success(self):
        """AC #1: LLM usage is logged to database with all required fields."""
        from src.observability.usage import log_llm_usage_to_db

        # Create mock database client
        mock_db, mock_conn = create_mock_db_client({"id": "test-uuid"})

        org_id = uuid4()
        deal_id = uuid4()
        user_id = uuid4()

        result = await log_llm_usage_to_db(
            mock_db,
            organization_id=org_id,
            deal_id=deal_id,
            user_id=user_id,
            provider="google-gla",
            model="gemini-2.5-flash",
            feature="chat",
            input_tokens=100,
            output_tokens=50,
            cost_usd=0.0003,
            latency_ms=250,
        )

        assert result == "test-uuid"
        mock_conn.fetchrow.assert_called_once()
        # Verify all parameters were passed
        call_args = mock_conn.fetchrow.call_args
        assert "google-gla" in str(call_args)
        assert "gemini-2.5-flash" in str(call_args)

    @pytest.mark.asyncio
    async def test_log_llm_usage_db_error(self):
        """AC #5: LLM usage logging handles database errors gracefully."""
        from src.observability.usage import log_llm_usage_to_db

        mock_db = MagicMock()
        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(side_effect=asyncpg.PostgresError("Connection error"))

        @asynccontextmanager
        async def mock_acquire():
            yield mock_conn

        mock_pool.acquire = mock_acquire
        mock_db._get_pool = AsyncMock(return_value=mock_pool)

        result = await log_llm_usage_to_db(
            mock_db,
            provider="anthropic",
            model="claude-sonnet-4-0",
            feature="extraction",
            input_tokens=1000,
            output_tokens=500,
            cost_usd=0.01,
        )

        # Should return None on error, not raise
        assert result is None

    @pytest.mark.asyncio
    async def test_log_llm_usage_minimal_params(self):
        """AC #4: LLM usage can be logged with only required fields."""
        from src.observability.usage import log_llm_usage_to_db

        mock_db, mock_conn = create_mock_db_client({"id": "minimal-uuid"})

        result = await log_llm_usage_to_db(
            mock_db,
            provider="voyage",
            model="voyage-3.5",
            feature="embeddings",
            input_tokens=500,
            output_tokens=0,
            cost_usd=0.00003,
        )

        assert result == "minimal-uuid"


class TestLogFeatureUsageToDb:
    """Tests for log_feature_usage_to_db function."""

    @pytest.mark.asyncio
    async def test_log_feature_usage_success(self):
        """AC #4: Feature usage is logged to database with all fields."""
        from src.observability.usage import log_feature_usage_to_db

        mock_db, mock_conn = create_mock_db_client({"id": "feature-uuid"})

        deal_id = uuid4()
        user_id = uuid4()

        result = await log_feature_usage_to_db(
            mock_db,
            deal_id=deal_id,
            user_id=user_id,
            feature_name="document_analysis",
            status="success",
            duration_ms=5000,
            metadata={"document_id": "doc-123", "findings_count": 15},
        )

        assert result == "feature-uuid"
        mock_conn.fetchrow.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_feature_usage_error_status(self):
        """AC #5: Feature usage error status is logged correctly."""
        from src.observability.usage import log_feature_usage_to_db

        mock_db, mock_conn = create_mock_db_client({"id": "error-uuid"})

        result = await log_feature_usage_to_db(
            mock_db,
            feature_name="chat",
            status="error",
            duration_ms=100,
            error_message="Connection timeout",
            metadata={"retry_count": 3},
        )

        assert result == "error-uuid"

    @pytest.mark.asyncio
    async def test_log_feature_usage_db_error(self):
        """AC #5: Feature usage logging handles database errors gracefully."""
        from src.observability.usage import log_feature_usage_to_db

        mock_db = MagicMock()
        mock_pool = AsyncMock()
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(side_effect=asyncpg.PostgresError("Insert failed"))

        @asynccontextmanager
        async def mock_acquire():
            yield mock_conn

        mock_pool.acquire = mock_acquire
        mock_db._get_pool = AsyncMock(return_value=mock_pool)

        result = await log_feature_usage_to_db(
            mock_db,
            feature_name="upload_document",
            status="success",
            duration_ms=2000,
        )

        # Should return None on error, not raise
        assert result is None
