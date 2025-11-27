"""
Tests for the OpenAI embedding client.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #6)
"""

import os
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Set test environment variables before importing
os.environ.setdefault("OPENAI_API_KEY", "test-openai-api-key")


# --- Fixtures ---


@pytest.fixture
def mock_settings() -> MagicMock:
    """Mock settings for embedding client tests."""
    mock = MagicMock()
    mock.openai_api_key = "test-openai-api-key"
    mock.embedding_model = "text-embedding-3-large"
    mock.embedding_dimensions = 3072
    mock.embedding_batch_size = 100
    return mock


@pytest.fixture
def sample_embedding() -> list[float]:
    """Sample 3072-dimension embedding vector."""
    return [0.01 * i for i in range(3072)]


@pytest.fixture
def sample_texts() -> list[str]:
    """Sample texts for embedding."""
    return [
        "This is the first text chunk.",
        "Second chunk with different content.",
        "Third chunk about financial data.",
    ]


@pytest.fixture
def mock_openai_response(sample_embedding: list[float]):
    """Mock OpenAI embedding response."""
    mock_response = MagicMock()
    mock_response.data = [
        MagicMock(embedding=sample_embedding),
        MagicMock(embedding=sample_embedding),
        MagicMock(embedding=sample_embedding),
    ]
    mock_response.usage = MagicMock(total_tokens=150)
    return mock_response


# --- Test Classes ---


class TestOpenAIEmbeddingClientInit:
    """Tests for client initialization."""

    def test_init_with_config(self, mock_settings: MagicMock) -> None:
        """Test client initialization with config."""
        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            with patch("src.embeddings.openai_client.AsyncOpenAI"):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient()

                assert client.model == "text-embedding-3-large"
                assert client.dimensions == 3072
                assert client.batch_size == 100

    def test_init_with_custom_params(self, mock_settings: MagicMock) -> None:
        """Test client initialization with custom parameters."""
        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            with patch("src.embeddings.openai_client.AsyncOpenAI"):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient(
                    api_key="custom-key",
                    model="custom-model",
                    dimensions=1536,
                    batch_size=50,
                )

                assert client.model == "custom-model"
                assert client.dimensions == 1536
                assert client.batch_size == 50

    def test_init_without_api_key_raises_error(self) -> None:
        """Test that missing API key raises error."""
        mock_settings_no_key = MagicMock()
        mock_settings_no_key.openai_api_key = ""
        mock_settings_no_key.embedding_model = "text-embedding-3-large"
        mock_settings_no_key.embedding_dimensions = 3072
        mock_settings_no_key.embedding_batch_size = 100

        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings_no_key):
            from src.embeddings.openai_client import OpenAIEmbeddingClient, EmbeddingError

            with pytest.raises(EmbeddingError) as exc_info:
                OpenAIEmbeddingClient(api_key="")

            assert "API key not configured" in str(exc_info.value)


class TestOpenAIEmbeddingClientTokenCounting:
    """Tests for token counting functionality."""

    def test_count_tokens_returns_integer(self, mock_settings: MagicMock) -> None:
        """Test that token counting returns integer."""
        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            with patch("src.embeddings.openai_client.AsyncOpenAI"):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient()
                count = client.count_tokens("Hello world, this is a test.")

                assert isinstance(count, int)
                assert count > 0

    def test_count_tokens_batch_sums_correctly(self, mock_settings: MagicMock) -> None:
        """Test that batch token counting sums correctly."""
        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            with patch("src.embeddings.openai_client.AsyncOpenAI"):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient()
                texts = ["Hello", "World", "Test"]

                batch_count = client.count_tokens_batch(texts)
                individual_sum = sum(client.count_tokens(t) for t in texts)

                assert batch_count == individual_sum


class TestOpenAIEmbeddingClientBatching:
    """Tests for batching functionality."""

    @pytest.mark.asyncio
    async def test_generate_batch_splits_large_input(
        self,
        mock_settings: MagicMock,
        sample_embedding: list[float],
    ) -> None:
        """Test that large inputs are split into batches."""
        # Create 150 texts (more than batch_size of 100)
        texts = [f"Text chunk number {i}" for i in range(150)]

        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=sample_embedding) for _ in range(100)]
        mock_response.usage = MagicMock(total_tokens=1000)

        mock_response_2 = MagicMock()
        mock_response_2.data = [MagicMock(embedding=sample_embedding) for _ in range(50)]
        mock_response_2.usage = MagicMock(total_tokens=500)

        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            mock_client = MagicMock()
            mock_client.embeddings = MagicMock()
            mock_client.embeddings.create = AsyncMock(
                side_effect=[mock_response, mock_response_2]
            )

            with patch("src.embeddings.openai_client.AsyncOpenAI", return_value=mock_client):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient()
                result = await client.generate_batch(texts)

                # Should have made 2 API calls
                assert mock_client.embeddings.create.call_count == 2
                assert len(result.embeddings) == 150
                assert result.batch_count == 2

    @pytest.mark.asyncio
    async def test_generate_batch_handles_empty_input(
        self,
        mock_settings: MagicMock,
    ) -> None:
        """Test that empty input returns empty result."""
        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            with patch("src.embeddings.openai_client.AsyncOpenAI"):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient()
                result = await client.generate_batch([])

                assert result.embeddings == []
                assert result.total_tokens == 0
                assert result.batch_count == 0


class TestOpenAIEmbeddingClientRetryLogic:
    """Tests for retry logic."""

    @pytest.mark.asyncio
    async def test_retry_on_rate_limit_records_failure(
        self,
        mock_settings: MagicMock,
        sample_embedding: list[float],
        sample_texts: list[str],
    ) -> None:
        """Test that rate limit errors are recorded as failures after retries."""
        from openai import RateLimitError

        # Create a mock response object for the error
        mock_error_response = MagicMock()
        mock_error_response.status_code = 429

        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            mock_client = MagicMock()
            mock_client.embeddings = MagicMock()
            # All calls fail with rate limit (simulating exhausted retries)
            mock_client.embeddings.create = AsyncMock(
                side_effect=RateLimitError(
                    message="Rate limit exceeded",
                    response=mock_error_response,
                    body=None,
                )
            )

            with patch("src.embeddings.openai_client.AsyncOpenAI", return_value=mock_client):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient()

                # generate_batch catches errors and records failures
                result = await client.generate_batch(sample_texts)

                # All texts should be marked as failed
                assert len(result.failed_indices) == len(sample_texts)
                assert result.success_count == 0


class TestOpenAIEmbeddingClientErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_api_error_non_retryable_records_failure(
        self,
        mock_settings: MagicMock,
        sample_texts: list[str],
    ) -> None:
        """Test that non-retryable API errors are recorded as failures."""
        from openai import APIError

        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            mock_client = MagicMock()
            mock_client.embeddings = MagicMock()
            mock_client.embeddings.create = AsyncMock(
                side_effect=APIError(
                    message="Bad request",
                    request=MagicMock(),
                    body=None,
                )
            )

            with patch("src.embeddings.openai_client.AsyncOpenAI", return_value=mock_client):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient()

                # generate_batch catches errors and records failures
                result = await client.generate_batch(sample_texts)

                # All texts should be marked as failed
                assert len(result.failed_indices) == len(sample_texts)
                assert result.success_count == 0


class TestOpenAIEmbeddingClientSingleGeneration:
    """Tests for single text embedding generation."""

    @pytest.mark.asyncio
    async def test_generate_single_returns_vector(
        self,
        mock_settings: MagicMock,
        sample_embedding: list[float],
    ) -> None:
        """Test that generate_single returns embedding vector."""
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=sample_embedding)]
        mock_response.usage = MagicMock(total_tokens=10)

        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            mock_client = MagicMock()
            mock_client.embeddings = MagicMock()
            mock_client.embeddings.create = AsyncMock(return_value=mock_response)

            with patch("src.embeddings.openai_client.AsyncOpenAI", return_value=mock_client):
                from src.embeddings.openai_client import OpenAIEmbeddingClient

                client = OpenAIEmbeddingClient()
                result = await client.generate_single("Test text")

                assert isinstance(result, list)
                assert len(result) == 3072


class TestEmbeddingBatchResult:
    """Tests for EmbeddingBatchResult dataclass."""

    def test_success_count_calculation(self) -> None:
        """Test success count excludes failed indices."""
        from src.embeddings.openai_client import EmbeddingBatchResult

        result = EmbeddingBatchResult(
            embeddings=[
                [0.1] * 3072,
                [0.2] * 3072,
                [],  # Failed
                [0.4] * 3072,
            ],
            total_tokens=100,
            batch_count=1,
            failed_indices=[2],
        )

        assert result.success_count == 3

    def test_estimated_cost_calculation(self) -> None:
        """Test cost estimation based on tokens."""
        from src.embeddings.openai_client import EmbeddingBatchResult

        result = EmbeddingBatchResult(
            embeddings=[[0.1] * 3072],
            total_tokens=10000,  # 10K tokens
            batch_count=1,
        )

        # text-embedding-3-large: $0.00013 per 1K tokens
        expected_cost = 10 * 0.00013  # $0.0013
        assert abs(result.estimated_cost_usd - expected_cost) < 0.0001


class TestGetEmbeddingClient:
    """Tests for the client singleton factory."""

    def test_get_embedding_client_returns_same_instance(
        self,
        mock_settings: MagicMock,
    ) -> None:
        """Test that get_embedding_client returns singleton."""
        with patch("src.embeddings.openai_client.get_settings", return_value=mock_settings):
            with patch("src.embeddings.openai_client.AsyncOpenAI"):
                from src.embeddings import openai_client

                # Reset singleton
                openai_client._embedding_client = None

                client1 = openai_client.get_embedding_client()
                client2 = openai_client.get_embedding_client()

                assert client1 is client2

                # Cleanup
                openai_client._embedding_client = None
