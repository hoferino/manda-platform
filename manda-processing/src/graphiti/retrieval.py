"""
Hybrid Retrieval Service for knowledge graph search with reranking.
Story: E10.7 - Hybrid Retrieval with Reranking (AC: #1, #2, #4, #5, #6, #8)

Pipeline:
1. Graphiti hybrid search (vector + BM25 + graph) -> 50 candidates
2. Voyage reranker scores and reorders -> Top 5-10
3. Filter superseded facts (invalid_at is set)
4. Format with source citations for LLM

Target latency: < 3 seconds end-to-end
"""

import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional

import structlog
from graphiti_core.edges import EntityEdge

from src.config import get_settings
from src.graphiti.client import GraphitiClient
from src.reranking.voyage import RerankResult, VoyageReranker

logger = structlog.get_logger(__name__)


@dataclass
class SourceCitation:
    """Citation information for LLM context."""

    type: Literal["document", "qa", "chat"]
    id: str
    title: str
    excerpt: Optional[str] = None
    page: Optional[int] = None
    chunk_index: Optional[int] = None
    confidence: float = 0.85


@dataclass
class KnowledgeItem:
    """A retrieved knowledge item with metadata."""

    id: str
    content: str
    score: float  # Reranker score
    source_type: Literal["fact"]  # Currently only facts from EntityEdge; episode/entity types deferred to E11
    source_channel: str  # document, qa_response, analyst_chat
    confidence: float
    valid_at: Optional[datetime] = None
    invalid_at: Optional[datetime] = None  # If set, fact is superseded
    citation: Optional[SourceCitation] = None


@dataclass
class RetrievalResult:
    """Complete retrieval result."""

    results: list[KnowledgeItem]
    sources: list[SourceCitation]
    entities: list[str]  # Entity names extracted from edge source/target; full traversal deferred to E11
    latency_ms: int
    graphiti_latency_ms: int = 0
    rerank_latency_ms: int = 0
    candidate_count: int = 0


class HybridRetrievalService:
    """
    Hybrid retrieval pipeline: Graphiti search -> Voyage rerank -> LLM context.

    Story: E10.7 - Hybrid Retrieval with Reranking

    Pipeline:
    1. Graphiti hybrid search (vector + BM25 + graph) -> 50 candidates
    2. Voyage reranker scores and reorders -> Top 5-10
    3. Format with source citations for LLM

    Target latency: < 3 seconds end-to-end

    Usage:
        service = HybridRetrievalService()
        result = await service.retrieve(
            query="What is Q3 revenue?",
            deal_id="deal-123",
            num_results=10
        )
        print(f"Found {len(result.results)} results in {result.latency_ms}ms")
    """

    def __init__(self, reranker: Optional[VoyageReranker] = None):
        """
        Initialize hybrid retrieval service.

        Args:
            reranker: Optional VoyageReranker instance. If not provided, creates one.
        """
        self.reranker = reranker or VoyageReranker()
        self.settings = get_settings()

    def _extract_citation(self, edge: EntityEdge) -> SourceCitation:
        """
        Extract source citation from EntityEdge.

        Args:
            edge: EntityEdge from Graphiti search

        Returns:
            SourceCitation with document metadata

        Note:
            EntityEdge contains `name` and `episodes` list.
            For full citation (source_description), we'd need to query EpisodicNode.
            For now, we extract what's available from edge metadata.
        """
        edge_name = edge.name or ""
        fact = edge.fact or ""

        # Parse source type from edge name pattern
        # Document edges typically have patterns like "financial_report.pdf" or contain doc metadata
        # QA edges from E10.5 use qa-response-* pattern
        # Chat edges from E10.5 use chat-fact-* pattern
        source_type: Literal["document", "qa", "chat"] = "document"
        title = edge_name

        # Check edge attributes for source information
        attrs = edge.attributes or {}
        source_channel = attrs.get("source_channel", "document")

        if source_channel == "qa_response" or "qa-response" in edge_name.lower():
            source_type = "qa"
            title = "Q&A Response"
        elif source_channel == "analyst_chat" or "chat-fact" in edge_name.lower():
            source_type = "chat"
            title = "Analyst Chat"

        # Extract page number from attributes if present
        page = attrs.get("page_number")
        if page is not None:
            try:
                page = int(page)
            except (ValueError, TypeError):
                page = None

        # Extract chunk index from attributes
        chunk_index = attrs.get("chunk_index")
        if chunk_index is not None:
            try:
                chunk_index = int(chunk_index)
            except (ValueError, TypeError):
                chunk_index = None

        # Get confidence from attributes or use default
        confidence = attrs.get("confidence", 0.85)
        if isinstance(confidence, str):
            try:
                confidence = float(confidence)
            except ValueError:
                confidence = 0.85

        return SourceCitation(
            type=source_type,
            id=edge.uuid,
            title=title,
            excerpt=fact[:200] if fact else None,
            page=page,
            chunk_index=chunk_index,
            confidence=confidence,
        )

    def _is_superseded(self, edge: EntityEdge) -> bool:
        """
        Check if an edge's fact is superseded (invalid_at is set).

        Graphiti's temporal model marks facts as invalid when superseded
        by newer information (e.g., Q&A answer correcting document fact).

        Args:
            edge: EntityEdge from Graphiti search

        Returns:
            True if fact is superseded, False otherwise
        """
        return edge.invalid_at is not None

    async def retrieve(
        self,
        query: str,
        deal_id: str,
        num_candidates: Optional[int] = None,
        num_results: Optional[int] = None,
    ) -> RetrievalResult:
        """
        Retrieve relevant knowledge for a query.

        Args:
            query: User query
            deal_id: Deal UUID for namespace isolation
            num_candidates: Candidates from Graphiti search (default 50)
            num_results: Final results after reranking (default 10)

        Returns:
            RetrievalResult with:
            - results: Reranked knowledge items with scores
            - sources: Citation information (document, page, etc.)
            - entities: Related entities mentioned
            - latency_ms: Pipeline timing
        """
        start_time = time.perf_counter()

        num_candidates = num_candidates or self.settings.retrieval_num_candidates
        num_results = num_results or self.settings.voyage_rerank_top_k

        logger.info(
            "Starting hybrid retrieval",
            query=query[:50],
            deal_id=deal_id,
            num_candidates=num_candidates,
            num_results=num_results,
        )

        # ========================================
        # Step 1: Graphiti Hybrid Search (~300ms)
        # ========================================
        graphiti_start = time.perf_counter()

        # GraphitiClient.search() returns list[EntityEdge]
        # E12.6: Graceful degradation when Neo4j/Graphiti unavailable
        try:
            # TODO (E12.9): Pass organization_id from request for proper multi-tenant isolation
            # For now, using deal_id as both org and deal to maintain backwards compatibility
            candidates: list[EntityEdge] = await GraphitiClient.search(
                deal_id=deal_id,
                organization_id=deal_id,  # Temporary: use deal_id until API schema updated
                query=query,
                num_results=num_candidates,
            )
        except Exception as graphiti_error:
            # Graceful degradation: return empty results if Graphiti unavailable
            logger.warning(
                "Graphiti search unavailable, returning empty results",
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
            "Graphiti search completed",
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
        # Step 2: Voyage Reranking (~200-300ms)
        # ========================================
        rerank_start = time.perf_counter()

        # Extract content for reranking - use the `fact` field from EntityEdge
        documents = []
        for edge in candidates:
            # EntityEdge.fact is the main content field
            content = edge.fact or ""
            documents.append(content)

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
        # Step 3: Post-Processing (~10ms)
        # ========================================

        # Build results with filtering and citations
        results: list[KnowledgeItem] = []
        sources: list[SourceCitation] = []
        entities_set: set[str] = set()

        for rerank_result in reranked:
            original_edge = candidates[rerank_result.index]

            # Filter superseded facts (AC: #8)
            if self._is_superseded(original_edge):
                logger.debug(
                    "Skipping superseded fact",
                    name=original_edge.name,
                    invalid_at=str(original_edge.invalid_at),
                )
                continue

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

            # Extract entity names from edge (source and target nodes)
            # EntityEdge connects two EntityNodes; their names are entity references
            # Full graph traversal for entity details deferred to E11
            if hasattr(original_edge, "source_node_uuid") and original_edge.source_node_uuid:
                # Edge name often contains entity info; also check attributes
                source_entity = attrs.get("source_entity_name")
                if source_entity:
                    entities_set.add(source_entity)
            if hasattr(original_edge, "target_node_uuid") and original_edge.target_node_uuid:
                target_entity = attrs.get("target_entity_name")
                if target_entity:
                    entities_set.add(target_entity)
            # Also extract from edge name if it looks like an entity reference
            edge_name = original_edge.name or ""
            if edge_name and not edge_name.startswith(("qa-response", "chat-fact")):
                # Edge names like "revenue_fact" or "John_Smith_CEO" may contain entity info
                # Add to entities if it looks meaningful (not a generic pattern)
                if "_" in edge_name and len(edge_name) > 3:
                    entities_set.add(edge_name.replace("_", " ").title())

            # Build knowledge item
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
            "Hybrid retrieval completed",
            total_results=len(results),
            latency_ms=elapsed_ms,
            graphiti_ms=graphiti_latency_ms,
            rerank_ms=rerank_latency_ms,
            entities_count=len(entities_set),
        )

        # Warn if latency exceeds target
        if elapsed_ms > 3000:
            logger.warning(
                "Retrieval latency exceeded target",
                latency_ms=elapsed_ms,
                target_ms=3000,
            )

        return RetrievalResult(
            results=results,
            sources=sources,
            entities=list(entities_set),
            latency_ms=elapsed_ms,
            graphiti_latency_ms=graphiti_latency_ms,
            rerank_latency_ms=rerank_latency_ms,
            candidate_count=len(candidates),
        )


__all__ = [
    "HybridRetrievalService",
    "RetrievalResult",
    "KnowledgeItem",
    "SourceCitation",
]
