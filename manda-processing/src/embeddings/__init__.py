"""
Embedding generation module.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #2)
Story: E12.10 - Fast Path Document Retrieval (AC: #1, #3)

This module provides embedding generation using:
- OpenAI text-embedding-3-large (legacy, for pgvector - deprecated)
- Voyage voyage-3.5 (1024d) for fast path and Graphiti
"""

from src.embeddings.openai_client import (
    OpenAIEmbeddingClient,
    EmbeddingError,
    EmbeddingRateLimitError,
    EmbeddingBatchResult,
    get_embedding_client,
)
from src.embeddings.voyage_client import (
    VoyageEmbeddingClient,
    get_voyage_client,
)

__all__ = [
    # OpenAI (legacy)
    "OpenAIEmbeddingClient",
    "EmbeddingError",
    "EmbeddingRateLimitError",
    "EmbeddingBatchResult",
    "get_embedding_client",
    # Voyage (E12.10)
    "VoyageEmbeddingClient",
    "get_voyage_client",
]
