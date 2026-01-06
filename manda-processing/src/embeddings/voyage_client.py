"""
Voyage AI embedding client for fast path document retrieval.
Story: E12.10 - Fast Path Document Retrieval (AC: #1, #3)

Standalone client for direct chunk embedding without Graphiti's LLM pipeline.
Uses same voyage-3.5 model as Graphiti for consistency.
"""

import asyncio
import threading
from typing import Optional

import structlog
import voyageai

from src.config import get_settings

logger = structlog.get_logger(__name__)

# Default max characters for text truncation (~25K tokens at 4 chars/token)
DEFAULT_MAX_CHARS = 100000

# Retry configuration
MAX_RETRIES = 3
INITIAL_BACKOFF_MS = 500
MAX_BACKOFF_MS = 5000


class VoyageEmbeddingClient:
    """
    Async Voyage AI embedding client.

    Uses voyage-3.5 (1024 dimensions) - same model configured in Graphiti.
    Supports batch embedding for efficient processing of multiple chunks.
    Includes retry logic with exponential backoff for transient failures.

    Usage:
        client = VoyageEmbeddingClient()
        embeddings = await client.embed_batch(["chunk1", "chunk2", "chunk3"])
    """

    _instance: Optional["VoyageEmbeddingClient"] = None
    _lock: threading.Lock = threading.Lock()

    def __init__(self):
        settings = get_settings()
        if not settings.voyage_api_key:
            raise ValueError("VOYAGE_API_KEY not set")

        self.client = voyageai.AsyncClient(api_key=settings.voyage_api_key)
        self.model = settings.voyage_embedding_model  # voyage-3.5
        self.dimensions = settings.voyage_embedding_dimensions  # 1024
        # Use configurable max chars, fallback to default
        self.max_chars = getattr(settings, "voyage_max_chars", DEFAULT_MAX_CHARS)

        logger.info(
            "VoyageEmbeddingClient initialized",
            model=self.model,
            dimensions=self.dimensions,
            max_chars=self.max_chars,
        )

    @classmethod
    def get_instance(cls) -> "VoyageEmbeddingClient":
        """Get singleton instance (thread-safe)."""
        if cls._instance is None:
            with cls._lock:
                # Double-check locking pattern
                if cls._instance is None:
                    cls._instance = VoyageEmbeddingClient()
        return cls._instance

    @classmethod
    def reset_for_testing(cls) -> None:
        """Reset singleton for testing."""
        with cls._lock:
            cls._instance = None

    async def embed_batch(
        self,
        texts: list[str],
        input_type: str = "document",
    ) -> list[list[float]]:
        """
        Embed a batch of texts with retry logic.

        Args:
            texts: List of text strings to embed
            input_type: "document" for chunks, "query" for search queries

        Returns:
            List of embedding vectors (1024 dimensions each)

        Note:
            Voyage API supports up to 128 texts per batch.
            For larger batches, caller should chunk appropriately.
            Includes exponential backoff retry for transient failures.
        """
        if not texts:
            return []

        # Truncate extremely long texts to avoid API errors
        truncated_texts = [t[: self.max_chars] for t in texts]

        # Retry with exponential backoff
        last_error: Optional[Exception] = None
        backoff_ms = INITIAL_BACKOFF_MS

        for attempt in range(MAX_RETRIES):
            try:
                result = await self.client.embed(
                    texts=truncated_texts,
                    model=self.model,
                    input_type=input_type,
                )

                # Estimate cost for logging: $0.06 per 1M tokens
                total_chars = sum(len(t) for t in truncated_texts)
                estimated_tokens = total_chars // 4
                estimated_cost = estimated_tokens * 0.00000006

                logger.debug(
                    "Voyage batch embedding completed",
                    texts_count=len(texts),
                    total_chars=total_chars,
                    estimated_tokens=estimated_tokens,
                    estimated_cost_usd=f"${estimated_cost:.6f}",
                    attempt=attempt + 1,
                )

                return result.embeddings

            except Exception as e:
                last_error = e
                error_str = str(e).lower()

                # Don't retry on auth errors or invalid requests
                if "unauthorized" in error_str or "invalid" in error_str:
                    logger.error(
                        "Voyage embedding failed (non-retryable)",
                        error=str(e),
                        attempt=attempt + 1,
                    )
                    raise

                # Retry on transient errors
                if attempt < MAX_RETRIES - 1:
                    logger.warning(
                        "Voyage embedding failed, retrying",
                        error=str(e),
                        attempt=attempt + 1,
                        backoff_ms=backoff_ms,
                    )
                    await asyncio.sleep(backoff_ms / 1000)
                    backoff_ms = min(backoff_ms * 2, MAX_BACKOFF_MS)

        # All retries exhausted
        logger.error(
            "Voyage embedding failed after all retries",
            error=str(last_error),
            max_retries=MAX_RETRIES,
        )
        raise last_error

    async def embed_query(self, query: str) -> list[float]:
        """
        Embed a search query.

        Args:
            query: Search query text

        Returns:
            1024-dimensional embedding vector

        Note:
            Uses input_type="query" for optimal query-document similarity.
        """
        embeddings = await self.embed_batch([query], input_type="query")
        return embeddings[0] if embeddings else []


# Export singleton getter
def get_voyage_client() -> VoyageEmbeddingClient:
    """Get or create Voyage embedding client singleton."""
    return VoyageEmbeddingClient.get_instance()


__all__ = ["VoyageEmbeddingClient", "get_voyage_client"]
