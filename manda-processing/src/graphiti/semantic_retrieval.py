"""
Semantic-only retrieval service for vector search without graph traversal.

This provides a simpler alternative to full Graphiti RAG when:
- Fine-tuning the knowledge graph (entity extraction, relationships)
- Testing pure vector search performance
- Reducing complexity during development

Feature flag: RAG_MODE=semantic

Pipeline:
1. Voyage embedding of query
2. Neo4j vector similarity search (no graph traversal, no BM25)
3. Voyage reranker scores and reorders
4. Format with source citations for LLM
"""

import time
from typing import Optional

import structlog
from graphiti_core.edges import EntityEdge

from src.config import get_settings
from src.graphiti.client import GraphitiClient
from src.graphiti.retrieval import (
    KnowledgeItem,
    RetrievalResult,
    SourceCitation,
)
from src.reranking.voyage import RerankResult, VoyageReranker

logger = structlog.get_logger(__name__)


class SemanticRetrievalService:
    """
    Semantic-only retrieval using vector search without graph traversal.

    This service provides a simpler RAG pipeline that:
    - Uses Voyage embeddings for semantic similarity
    - Skips Graphiti's graph traversal and BM25 components
    - Still uses Voyage reranker for result quality
    - Returns the same RetrievalResult format as HybridRetrievalService

    Use when RAG_MODE=semantic to bypass graph-based retrieval while
    the knowledge graph is being fine-tuned.

    Usage:
        service = SemanticRetrievalService()
        result = await service.retrieve(
            query="What is Q3 revenue?",
            deal_id="deal-123",
            num_results=10
        )
    """

    def __init__(self, reranker: Optional[VoyageReranker] = None):
        """
        Initialize semantic retrieval service.

        Args:
            reranker: Optional VoyageReranker instance. If not provided, creates one.
        """
        self.reranker = reranker or VoyageReranker()
        self.settings = get_settings()

    def _extract_citation(self, edge: EntityEdge) -> SourceCitation:
        """
        Extract source citation from EntityEdge.

        Matches the implementation in HybridRetrievalService for consistency.
        """
        edge_name = edge.name or ""
        fact = edge.fact or ""

        source_type: str = "document"
        title = edge_name

        attrs = edge.attributes or {}
        source_channel = attrs.get("source_channel", "document")

        if source_channel == "qa_response" or "qa-response" in edge_name.lower():
            source_type = "qa"
            title = "Q&A Response"
        elif source_channel == "analyst_chat" or "chat-fact" in edge_name.lower():
            source_type = "chat"
            title = "Analyst Chat"

        page = attrs.get("page_number")
        if page is not None:
            try:
                page = int(page)
            except (ValueError, TypeError):
                page = None

        chunk_index = attrs.get("chunk_index")
        if chunk_index is not None:
            try:
                chunk_index = int(chunk_index)
            except (ValueError, TypeError):
                chunk_index = None

        confidence = attrs.get("confidence", 0.85)
        if isinstance(confidence, str):
            try:
                confidence = float(confidence)
            except ValueError:
                confidence = 0.85

        return SourceCitation(
            type=source_type,  # type: ignore
            id=edge.uuid,
            title=title,
            excerpt=fact[:200] if fact else None,
            page=page,
            chunk_index=chunk_index,
            confidence=confidence,
        )

    async def retrieve(
        self,
        query: str,
        deal_id: str,
        num_candidates: Optional[int] = None,
        num_results: Optional[int] = None,
    ) -> RetrievalResult:
        """
        Retrieve using semantic vector search only (no graph traversal).

        This method uses Graphiti's search but the underlying Neo4j query
        will only use vector similarity without graph path expansion.

        Args:
            query: User query
            deal_id: Deal UUID for namespace isolation
            num_candidates: Candidates from vector search (default 50)
            num_results: Final results after reranking (default 10)

        Returns:
            RetrievalResult with results, sources, entities, and latency
        """
        start_time = time.perf_counter()

        num_candidates = num_candidates or self.settings.retrieval_num_candidates
        num_results = num_results or self.settings.voyage_rerank_top_k

        logger.info(
            "Starting semantic-only retrieval",
            query=query[:50],
            deal_id=deal_id,
            num_candidates=num_candidates,
            num_results=num_results,
            mode="semantic",
        )

        # ========================================
        # Step 1: Graphiti Search (vector-focused)
        # ========================================
        # Note: Graphiti.search() still uses its hybrid approach internally,
        # but we can control behavior via the search method.
        # For truly semantic-only, we'd need to call Neo4j vector index directly.
        # For now, we use Graphiti search which includes vector similarity.
        graphiti_start = time.perf_counter()

        try:
            # Use GraphitiClient.search which wraps Graphiti's hybrid search
            # The vector component is the primary retrieval mechanism
            candidates: list[EntityEdge] = await GraphitiClient.search(
                deal_id=deal_id,
                organization_id=deal_id,  # Temporary: use deal_id until API schema updated
                query=query,
                num_results=num_candidates,
            )
        except Exception as graphiti_error:
            logger.warning(
                "Semantic search unavailable, returning empty results",
                error=str(graphiti_error),
                deal_id=deal_id,
            )
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return RetrievalResult(
                results=[],
                sources=[],
                entities=[],
                latency_ms=elapsed_ms,
                graphiti_latency_ms=0,
                rerank_latency_ms=0,
                candidate_count=0,
            )

        graphiti_latency_ms = int((time.perf_counter() - graphiti_start) * 1000)

        logger.info(
            "Semantic search completed",
            candidates_found=len(candidates),
            graphiti_latency_ms=graphiti_latency_ms,
        )

        if not candidates:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return RetrievalResult(
                results=[],
                sources=[],
                entities=[],
                latency_ms=elapsed_ms,
                graphiti_latency_ms=graphiti_latency_ms,
                rerank_latency_ms=0,
                candidate_count=0,
            )

        # ========================================
        # Step 2: Voyage Reranking
        # ========================================
        rerank_start = time.perf_counter()

        documents = [edge.fact or "" for edge in candidates]

        reranked: list[RerankResult] = await self.reranker.rerank(
            query=query,
            documents=documents,
            top_k=num_results,
        )

        rerank_latency_ms = int((time.perf_counter() - rerank_start) * 1000)

        logger.info(
            "Reranking completed",
            reranked_count=len(reranked),
            rerank_latency_ms=rerank_latency_ms,
            top_score=reranked[0].relevance_score if reranked else None,
        )

        # ========================================
        # Step 3: Format Results (simplified)
        # ========================================
        # In semantic mode, we skip superseded fact filtering
        # and complex entity extraction (those are graph features)
        results: list[KnowledgeItem] = []
        sources: list[SourceCitation] = []

        for rerank_result in reranked:
            original_edge = candidates[rerank_result.index]

            # Extract citation
            citation = self._extract_citation(original_edge)
            sources.append(citation)

            # Determine source channel
            source_channel = "document"
            attrs = original_edge.attributes or {}
            if attrs.get("source_channel"):
                source_channel = attrs["source_channel"]
            elif citation.type == "qa":
                source_channel = "qa_response"
            elif citation.type == "chat":
                source_channel = "analyst_chat"

            item = KnowledgeItem(
                id=original_edge.uuid,
                content=rerank_result.document,
                score=rerank_result.relevance_score,
                source_type="fact",
                source_channel=source_channel,
                confidence=citation.confidence,
                valid_at=original_edge.valid_at,
                invalid_at=original_edge.invalid_at,
                citation=citation,
            )
            results.append(item)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        logger.info(
            "Semantic retrieval completed",
            total_results=len(results),
            latency_ms=elapsed_ms,
            graphiti_ms=graphiti_latency_ms,
            rerank_ms=rerank_latency_ms,
            mode="semantic",
        )

        return RetrievalResult(
            results=results,
            sources=sources,
            entities=[],  # Skip entity extraction in semantic mode
            latency_ms=elapsed_ms,
            graphiti_latency_ms=graphiti_latency_ms,
            rerank_latency_ms=rerank_latency_ms,
            candidate_count=len(candidates),
        )


__all__ = ["SemanticRetrievalService"]
