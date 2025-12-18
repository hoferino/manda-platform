"""
Voyage AI reranker for improving retrieval accuracy.
Story: E10.7 - Hybrid Retrieval with Reranking (AC: #3)

Uses rerank-2.5 model for 20-35% accuracy improvement over pure vector search.

IMPORTANT: The Voyage SDK is SYNCHRONOUS. This module wraps sync calls
in asyncio.run_in_executor() to work properly in async code.
"""

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Optional

import structlog

from src.config import get_settings

logger = structlog.get_logger(__name__)


@dataclass
class RerankResult:
    """Result from Voyage reranking."""

    index: int  # Original index in input documents
    relevance_score: float  # Reranker score (higher = more relevant)
    document: str  # Original document text


class VoyageReranker:
    """
    Voyage AI reranker for improving retrieval accuracy.

    Uses rerank-2.5 model for 20-35% accuracy improvement.

    IMPORTANT: The Voyage SDK is SYNCHRONOUS. This class wraps the sync calls
    in asyncio.run_in_executor() to work properly in async code.

    Usage:
        reranker = VoyageReranker()
        results = await reranker.rerank(
            query="What is revenue?",
            documents=["Revenue was $5M...", "EBITDA was..."],
            top_k=10
        )
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Voyage reranker.

        Args:
            api_key: Optional Voyage API key. If not provided, uses settings.
        """
        settings = get_settings()
        self._api_key = api_key or settings.voyage_api_key
        self._model = settings.voyage_rerank_model  # "rerank-2.5"

        if not self._api_key:
            logger.warning("VOYAGE_API_KEY not set - reranking will return original order")
            self._client = None
        else:
            try:
                import voyageai

                self._client = voyageai.Client(api_key=self._api_key)
                logger.info(
                    "Voyage reranker initialized",
                    model=self._model,
                )
            except ImportError:
                logger.error("voyageai package not installed - reranking unavailable")
                self._client = None
            except Exception as e:
                logger.error("Failed to initialize Voyage client", error=str(e))
                self._client = None

    def _sync_rerank(
        self,
        query: str,
        documents: list[str],
        top_k: int,
    ) -> Any:
        """
        Synchronous rerank call - called via run_in_executor.

        The Voyage SDK is synchronous, so we wrap it here.

        Returns:
            Voyage RerankingResponse with .results attribute
        """
        return self._client.rerank(
            query=query,
            documents=documents,
            model=self._model,
            top_k=min(top_k, len(documents)),
        )

    async def rerank(
        self,
        query: str,
        documents: list[str],
        top_k: int = 10,
    ) -> list[RerankResult]:
        """
        Rerank documents by relevance to query.

        Args:
            query: Search query
            documents: List of document texts to rerank
            top_k: Number of top results to return

        Returns:
            List of RerankResult sorted by relevance (highest first)

        Note:
            Uses run_in_executor() because Voyage SDK is synchronous.
            Falls back to original order if Voyage unavailable.
        """
        if not self._client:
            # Fallback: return original order with placeholder scores
            logger.warning("Reranker unavailable - returning original order")
            return [
                RerankResult(index=i, relevance_score=max(0.0, 1.0 - (i * 0.01)), document=doc)
                for i, doc in enumerate(documents[:top_k])
            ]

        if not documents:
            return []

        start_time = time.perf_counter()

        try:
            # CRITICAL: Voyage SDK is synchronous - use run_in_executor
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,  # Use default ThreadPoolExecutor
                lambda: self._sync_rerank(query, documents, top_k),
            )

            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            # Convert to RerankResult objects
            # Voyage API returns: response.results with .index and .relevance_score
            results = [
                RerankResult(
                    index=r.index,
                    relevance_score=r.relevance_score,
                    document=documents[r.index],
                )
                for r in response.results
            ]

            # Cost tracking: Voyage rerank pricing ~$0.05 per 1000 documents
            estimated_cost_usd = len(documents) * 0.00005

            logger.info(
                "Voyage rerank completed",
                model=self._model,
                query_length=len(query),
                documents_count=len(documents),
                top_k=top_k,
                results_returned=len(results),
                elapsed_ms=elapsed_ms,
                estimated_cost_usd=f"${estimated_cost_usd:.6f}",
                top_score=results[0].relevance_score if results else None,
            )

            return results

        except Exception as e:
            logger.error("Voyage rerank failed", error=str(e))
            # Fallback: return original order
            return [
                RerankResult(index=i, relevance_score=max(0.0, 1.0 - (i * 0.01)), document=doc)
                for i, doc in enumerate(documents[:top_k])
            ]


__all__ = ["VoyageReranker", "RerankResult"]
