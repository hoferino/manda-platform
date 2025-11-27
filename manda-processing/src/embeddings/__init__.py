"""
Embedding generation module.
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #2)

This module provides embedding generation using OpenAI's text-embedding-3-large model.
"""

from src.embeddings.openai_client import (
    OpenAIEmbeddingClient,
    EmbeddingError,
    EmbeddingRateLimitError,
    EmbeddingBatchResult,
    get_embedding_client,
)

__all__ = [
    "OpenAIEmbeddingClient",
    "EmbeddingError",
    "EmbeddingRateLimitError",
    "EmbeddingBatchResult",
    "get_embedding_client",
]
