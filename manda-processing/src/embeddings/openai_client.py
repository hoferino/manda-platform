"""
OpenAI embedding client for generating vector embeddings.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #2)

This module provides:
- Async embedding generation using OpenAI's text-embedding-3-large model
- Batch processing with configurable batch sizes (max 100 per API call)
- Retry logic with exponential backoff using tenacity
- Token counting for cost monitoring using tiktoken
"""

from dataclasses import dataclass, field
from typing import Optional

import structlog
import tiktoken
from openai import AsyncOpenAI, RateLimitError, APIError, APIConnectionError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from src.config import Settings, get_settings

logger = structlog.get_logger(__name__)


class EmbeddingError(Exception):
    """Base exception for embedding generation errors."""

    def __init__(self, message: str, retryable: bool = False):
        self.message = message
        self.retryable = retryable
        super().__init__(message)


class EmbeddingRateLimitError(EmbeddingError):
    """Raised when OpenAI rate limit is hit."""

    def __init__(self, message: str):
        super().__init__(message, retryable=True)


@dataclass
class EmbeddingBatchResult:
    """Result of a batch embedding operation."""

    embeddings: list[list[float]]
    total_tokens: int
    batch_count: int
    failed_indices: list[int] = field(default_factory=list)

    @property
    def success_count(self) -> int:
        """Number of successfully embedded texts."""
        return len(self.embeddings) - len(self.failed_indices)

    @property
    def estimated_cost_usd(self) -> float:
        """Estimated cost in USD based on OpenAI pricing.

        text-embedding-3-large pricing: $0.00013 per 1K tokens
        """
        return (self.total_tokens / 1000) * 0.00013


class OpenAIEmbeddingClient:
    """
    Async client for generating embeddings using OpenAI's API.

    Features:
    - Batch processing (max 100 texts per request, configurable)
    - Automatic retry with exponential backoff (3 attempts)
    - Token counting for cost monitoring
    - Structured logging for observability
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        dimensions: Optional[int] = None,
        batch_size: Optional[int] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the OpenAI embedding client.

        Args:
            api_key: OpenAI API key (uses config if not provided)
            model: Model name (default: text-embedding-3-large)
            dimensions: Embedding dimensions (default: 3072)
            batch_size: Max texts per API call (default: 100)
            config: Application settings
        """
        self.config = config or get_settings()

        self.api_key = api_key or self.config.openai_api_key
        self.model = model or self.config.embedding_model
        self.dimensions = dimensions or self.config.embedding_dimensions
        self.batch_size = batch_size or self.config.embedding_batch_size

        if not self.api_key:
            raise EmbeddingError(
                "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.",
                retryable=False,
            )

        self.client = AsyncOpenAI(api_key=self.api_key)

        # Initialize tiktoken encoder for token counting
        try:
            # cl100k_base is used by text-embedding-3-* models
            self._encoder = tiktoken.get_encoding("cl100k_base")
        except Exception:
            # Fallback if encoding not available
            self._encoder = None
            logger.warning("tiktoken encoding not available, token counting disabled")

        logger.info(
            "OpenAIEmbeddingClient initialized",
            model=self.model,
            dimensions=self.dimensions,
            batch_size=self.batch_size,
        )

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in a text string.

        Args:
            text: Text to count tokens for

        Returns:
            Token count (0 if encoder not available)
        """
        if self._encoder is None:
            return 0
        return len(self._encoder.encode(text))

    def count_tokens_batch(self, texts: list[str]) -> int:
        """
        Count total tokens for a batch of texts.

        Args:
            texts: List of texts to count tokens for

        Returns:
            Total token count
        """
        return sum(self.count_tokens(text) for text in texts)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type((RateLimitError, APIConnectionError)),
        reraise=True,
    )
    async def _generate_single_batch(
        self, texts: list[str]
    ) -> tuple[list[list[float]], int]:
        """
        Generate embeddings for a single batch of texts.

        This method is decorated with retry logic for transient errors.

        Args:
            texts: List of texts to embed (max batch_size)

        Returns:
            Tuple of (embeddings list, token count)

        Raises:
            EmbeddingError: If embedding generation fails
            EmbeddingRateLimitError: If rate limit is hit after retries
        """
        if not texts:
            return [], 0

        token_count = self.count_tokens_batch(texts)

        logger.debug(
            "Generating embeddings for batch",
            batch_size=len(texts),
            estimated_tokens=token_count,
        )

        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=texts,
                dimensions=self.dimensions,
            )

            embeddings = [item.embedding for item in response.data]
            actual_tokens = response.usage.total_tokens if response.usage else token_count

            logger.debug(
                "Batch embeddings generated",
                batch_size=len(texts),
                actual_tokens=actual_tokens,
            )

            return embeddings, actual_tokens

        except RateLimitError as e:
            logger.warning(
                "OpenAI rate limit hit",
                error=str(e),
            )
            raise EmbeddingRateLimitError(f"Rate limit exceeded: {str(e)}")

        except APIError as e:
            # Check if it's a retryable server error
            status_code = getattr(e, "status_code", None)
            if status_code and status_code >= 500:
                logger.warning(
                    "OpenAI server error (retrying)",
                    status_code=status_code,
                    error=str(e),
                )
                raise  # Will be retried

            # Non-retryable API error (e.g., 400 bad request)
            logger.error(
                "OpenAI API error (non-retryable)",
                status_code=status_code,
                error=str(e),
            )
            raise EmbeddingError(
                f"OpenAI API error: {str(e)}",
                retryable=False,
            )

        except APIConnectionError as e:
            logger.warning(
                "OpenAI connection error (retrying)",
                error=str(e),
            )
            raise  # Will be retried

        except Exception as e:
            logger.error(
                "Unexpected error generating embeddings",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise EmbeddingError(
                f"Unexpected error: {str(e)}",
                retryable=False,
            )

    async def generate_batch(
        self, texts: list[str]
    ) -> EmbeddingBatchResult:
        """
        Generate embeddings for a list of texts with automatic batching.

        Splits large lists into batches respecting the batch_size limit,
        processes each batch, and combines results.

        Args:
            texts: List of texts to embed

        Returns:
            EmbeddingBatchResult with embeddings and metadata

        Raises:
            EmbeddingError: If embedding generation fails for all batches
        """
        if not texts:
            return EmbeddingBatchResult(
                embeddings=[],
                total_tokens=0,
                batch_count=0,
            )

        logger.info(
            "Starting batch embedding generation",
            total_texts=len(texts),
            batch_size=self.batch_size,
        )

        all_embeddings: list[list[float]] = []
        total_tokens = 0
        batch_count = 0
        failed_indices: list[int] = []

        # Process in batches
        for i in range(0, len(texts), self.batch_size):
            batch_texts = texts[i : i + self.batch_size]
            batch_start_idx = i

            try:
                embeddings, tokens = await self._generate_single_batch(batch_texts)
                all_embeddings.extend(embeddings)
                total_tokens += tokens
                batch_count += 1

                logger.debug(
                    "Batch completed",
                    batch_number=batch_count,
                    batch_size=len(batch_texts),
                    tokens=tokens,
                )

            except EmbeddingError as e:
                logger.error(
                    "Batch embedding failed",
                    batch_start_idx=batch_start_idx,
                    batch_size=len(batch_texts),
                    error=str(e),
                )

                # Track failed indices
                for j in range(len(batch_texts)):
                    failed_indices.append(batch_start_idx + j)

                # Add empty embeddings for failed texts to maintain alignment
                all_embeddings.extend([[] for _ in batch_texts])

                if not e.retryable:
                    # Non-retryable error - might want to raise immediately
                    # For now, we continue and report failures
                    pass

        result = EmbeddingBatchResult(
            embeddings=all_embeddings,
            total_tokens=total_tokens,
            batch_count=batch_count,
            failed_indices=failed_indices,
        )

        logger.info(
            "Batch embedding generation complete",
            total_texts=len(texts),
            success_count=result.success_count,
            failed_count=len(failed_indices),
            total_tokens=total_tokens,
            estimated_cost_usd=f"${result.estimated_cost_usd:.6f}",
            batch_count=batch_count,
        )

        return result

    async def generate_single(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Convenience method for single text embedding.

        Args:
            text: Text to embed

        Returns:
            Embedding vector (list of floats)

        Raises:
            EmbeddingError: If embedding generation fails
        """
        result = await self.generate_batch([text])

        if result.failed_indices:
            raise EmbeddingError(
                "Failed to generate embedding for text",
                retryable=False,
            )

        return result.embeddings[0]


# Global client instance
_embedding_client: Optional[OpenAIEmbeddingClient] = None


def get_embedding_client() -> OpenAIEmbeddingClient:
    """
    Get or create the global embedding client instance.

    Returns:
        OpenAIEmbeddingClient instance

    Raises:
        EmbeddingError: If client cannot be initialized (e.g., missing API key)
    """
    global _embedding_client
    if _embedding_client is None:
        _embedding_client = OpenAIEmbeddingClient()
    return _embedding_client


__all__ = [
    "OpenAIEmbeddingClient",
    "EmbeddingError",
    "EmbeddingRateLimitError",
    "EmbeddingBatchResult",
    "get_embedding_client",
]
