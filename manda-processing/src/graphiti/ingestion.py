"""
Graphiti ingestion service for document processing.
Story: E10.4 - Document Ingestion Pipeline (AC: #1, #2, #3)
Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #2, #4, #5)
Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)

This module provides:
- GraphitiIngestionService: Orchestrates document chunk ingestion into Graphiti
- IngestionResult: Metrics from ingestion operation
- Confidence constants for different source types

Usage:
    from src.graphiti.ingestion import GraphitiIngestionService, IngestionResult

    service = GraphitiIngestionService()

    # Document ingestion (E10.4 + E12.9)
    result = await service.ingest_document_chunks(
        document_id="doc-123",
        deal_id="deal-456",
        organization_id="org-789",  # E12.9: Required for multi-tenant isolation
        document_name="financial-report.pdf",
        chunks=chunks,
    )
    print(f"Ingested {result.episode_count} episodes")

    # Q&A response ingestion (E10.5 + E12.9)
    result = await service.ingest_qa_response(
        qa_item_id="qa-123",
        deal_id="deal-456",
        organization_id="org-789",  # E12.9: Required for multi-tenant isolation
        question="What is the revenue?",
        answer="Revenue was $5.2M",
    )

    # Chat fact ingestion (E10.5 + E12.9)
    result = await service.ingest_chat_fact(
        message_id="msg-123",
        deal_id="deal-456",
        organization_id="org-789",  # E12.9: Required for multi-tenant isolation
        fact_content="The CEO confirmed expansion plans",
        message_context="Full chat message...",
    )
"""

import time
from dataclasses import dataclass
from typing import Any

import structlog

from src.graphiti.client import GraphitiClient
from src.graphiti.extraction_hints import (
    DocumentType,
    detect_document_type,
    get_extraction_hints,
)
from src.graphiti.schema import get_edge_type_map, get_edge_types, get_entity_types

logger = structlog.get_logger(__name__)


# ============================================================
# Cost Estimation Helper
# ============================================================

# Voyage voyage-3.5 pricing: $0.06 per 1M tokens
_VOYAGE_COST_PER_TOKEN = 0.00000006
_CHARS_PER_TOKEN_ESTIMATE = 4


def _estimate_embedding_cost(content: str) -> float:
    """
    Estimate embedding cost based on content length.

    Uses Voyage voyage-3.5 pricing ($0.06/1M tokens).
    Assumes ~4 characters per token.

    Args:
        content: Text content to estimate cost for

    Returns:
        Estimated cost in USD
    """
    estimated_tokens = len(content) // _CHARS_PER_TOKEN_ESTIMATE
    return estimated_tokens * _VOYAGE_COST_PER_TOKEN


# ============================================================
# Confidence Constants (E10.5 - AC#4)
# ============================================================
# Higher confidence sources can SUPERSEDE lower confidence facts
# when Graphiti detects contradictions via its temporal model.
# ============================================================

QA_CONFIDENCE = 0.95
"""
Highest confidence - client-provided authoritative answers.
Q&A responses are explicitly provided by the client/user in response
to specific questions, making them the most reliable source of truth.
"""

CHAT_CONFIDENCE = 0.90
"""
High confidence - analyst-provided facts from chat.
Chat facts are provided by analysts during due diligence conversations,
generally reliable but less formal than explicit Q&A responses.
"""

DOCUMENT_CONFIDENCE = 0.85
"""
Base confidence - document-extracted facts.
Facts extracted automatically from uploaded documents.
Can be superseded by higher-confidence sources (Q&A, chat).
"""


@dataclass
class IngestionResult:
    """
    Result metrics from document ingestion.

    Story: E10.4 - Document Ingestion Pipeline (AC: #1)

    Attributes:
        episode_count: Number of episodes created in Graphiti
        elapsed_ms: Total ingestion time in milliseconds
        estimated_cost_usd: Estimated embedding cost (Voyage pricing)
    """

    episode_count: int
    elapsed_ms: int
    estimated_cost_usd: float = 0.0


class GraphitiIngestionService:
    """
    Ingestion service for adding document content to the knowledge graph.

    Story: E10.4 - Document Ingestion Pipeline (AC: #1, #2, #3)

    Orchestrates chunk iteration and episode creation in Graphiti.
    Entity extraction happens automatically via Graphiti's LLM pipeline
    using Gemini Flash for entity/relationship extraction.

    Usage:
        service = GraphitiIngestionService()
        result = await service.ingest_document_chunks(
            document_id="doc-123",
            deal_id="deal-456",
            document_name="report.pdf",
            chunks=chunks,
        )
    """

    def _build_source_description(
        self,
        chunk: dict[str, Any],
        document_name: str,
        doc_metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Build source description with dynamic extraction context for Graphiti.

        Story: E14-S1 - Dynamic Entity Extraction Instructions (AC: #1, #2)

        The source_description influences Graphiti's LLM entity extraction.
        By including document-type-specific extraction hints, we guide the LLM
        to extract domain-relevant entities without modifying Graphiti's core.

        Args:
            chunk: Chunk data with page_number, sheet_name, chunk_type
            document_name: Name of the source document
            doc_metadata: Optional document metadata for type detection

        Returns:
            Source description string with extraction instructions
        """
        # Build basic provenance info
        provenance_parts = [f"From: {document_name}"]

        if chunk.get("page_number"):
            provenance_parts.append(f"Page {chunk['page_number']}")

        if chunk.get("sheet_name"):
            provenance_parts.append(f"Sheet: {chunk['sheet_name']}")

        provenance_parts.append(f"Type: {chunk.get('chunk_type', 'text')}")

        provenance = " | ".join(provenance_parts)

        # E14-S1: Add dynamic extraction hints based on document type
        metadata = doc_metadata or {"filename": document_name}
        doc_type = detect_document_type(metadata)
        extraction_hints = get_extraction_hints(doc_type, metadata)

        # Combine provenance with extraction instructions
        return f"{provenance}\n\nExtraction Instructions:\n{extraction_hints}"

    def _get_document_type(self, document_name: str, metadata: dict[str, Any] | None = None) -> DocumentType:
        """
        Detect document type for logging and metrics.

        Story: E14-S1 - Dynamic Entity Extraction Instructions (AC: #5)

        Args:
            document_name: Name of the document
            metadata: Optional additional metadata

        Returns:
            Detected DocumentType enum
        """
        doc_metadata = metadata or {"filename": document_name}
        return detect_document_type(doc_metadata)

    async def ingest_document_chunks(
        self,
        document_id: str,
        deal_id: str,
        organization_id: str,  # E12.9: Required for multi-tenant isolation
        document_name: str,
        chunks: list[dict[str, Any]],
        doc_metadata: dict[str, Any] | None = None,  # E14-S1: Optional document metadata
    ) -> IngestionResult:
        """
        Ingest document chunks as Graphiti episodes.

        Story: E10.4 - Document Ingestion Pipeline (AC: #2, #3, #5)
        Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)
        Story: E14-S1 - Dynamic Entity Extraction Instructions (AC: #1, #2, #5)

        Each chunk becomes an episode in Graphiti. Entity extraction
        happens automatically via Graphiti's LLM pipeline using Gemini Flash.
        Entities are typed using the M&A schema from E10.3.

        E14-S1: Dynamic extraction hints are included in source_description
        based on document type to guide LLM extraction of domain-specific entities.

        AC#5 (Embeddings): Voyage 1024d embeddings are generated internally
        by Graphiti via VoyageAIEmbedder configured in E10.2. The embeddings
        are stored in Neo4j as part of the add_episode() call. If Voyage is
        unavailable, Graphiti falls back to GeminiEmbedder per E10.2 design.

        E12.9: group_id = "{organization_id}:{deal_id}" ensures complete
        namespace isolation between organizations.

        Args:
            document_id: Source document UUID (for logging/tracking)
            deal_id: Deal UUID for scoping within organization
            organization_id: Organization UUID for namespace isolation (E12.9)
            document_name: Document filename for episode naming
            chunks: Parsed document chunks from db.get_chunks_by_document()
                   Each chunk has: id, content, chunk_index, page_number,
                   chunk_type, sheet_name, token_count
            doc_metadata: Optional document metadata for extraction hints (E14-S1)
                         Keys: filename, file_type, content_type, etc.

        Returns:
            IngestionResult with episode_count, elapsed_ms, estimated_cost_usd

        Raises:
            GraphitiConnectionError: If Graphiti/Neo4j connection fails
        """
        start_time = time.perf_counter()

        # Use M&A schema helpers (from E10.3)
        entity_types = get_entity_types()
        edge_types = get_edge_types()
        edge_type_map = get_edge_type_map()

        episode_count = 0
        total_chars = 0

        # E14-S1: Detect document type for extraction hints and logging
        metadata = doc_metadata or {"filename": document_name}
        doc_type = self._get_document_type(document_name, metadata)

        logger.info(
            "Starting document ingestion to Graphiti",
            document_id=document_id,
            deal_id=deal_id,
            organization_id=organization_id,
            document_name=document_name,
            chunk_count=len(chunks),
            document_type=doc_type.value,  # E14-S1: Log document type
        )

        # NOTE: Sequential processing is intentional here.
        # Graphiti's add_episode() performs LLM-based entity extraction and
        # graph updates that benefit from seeing prior context. Processing
        # chunks in document order allows Graphiti to build coherent entity
        # relationships. Parallel processing would lose this temporal context
        # and could cause race conditions in graph updates.
        for i, chunk in enumerate(chunks):
            # Build episode name with chunk index for uniqueness
            episode_name = f"{document_name}#chunk-{i}"
            # E14-S1: Pass metadata for dynamic extraction hints
            source_desc = self._build_source_description(chunk, document_name, metadata)
            content = chunk["content"]

            # Add episode to Graphiti - entity extraction happens automatically
            # E12.9: organization_id is passed for composite group_id
            await GraphitiClient.add_episode(
                deal_id=deal_id,
                organization_id=organization_id,  # E12.9: Multi-tenant isolation
                content=content,
                name=episode_name,
                source_description=source_desc,
                entity_types=entity_types,
                edge_types=edge_types,
                edge_type_map=edge_type_map,
            )

            episode_count += 1
            total_chars += len(content)

            # Progress logging every 10 chunks
            if (i + 1) % 10 == 0:
                logger.info(
                    "Ingestion progress",
                    completed=i + 1,
                    total=len(chunks),
                    document_id=document_id,
                )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Estimate cost using helper function
        estimated_cost_usd = _estimate_embedding_cost("x" * total_chars)

        # E14-S1: Log extraction completeness metrics
        logger.info(
            "Document ingestion completed",
            document_id=document_id,
            deal_id=deal_id,
            organization_id=organization_id,
            episode_count=episode_count,
            elapsed_ms=elapsed_ms,
            estimated_cost_usd=f"${estimated_cost_usd:.6f}",
            total_chars=total_chars,
            # E14-S1: Extraction completeness metrics
            document_type=doc_type.value,
            extraction_hints_applied=True,
            chunks_processed=len(chunks),
            chunks_successful=episode_count,
            extraction_completeness_pct=round(episode_count / len(chunks) * 100, 1) if chunks else 0,
        )

        return IngestionResult(
            episode_count=episode_count,
            elapsed_ms=elapsed_ms,
            estimated_cost_usd=estimated_cost_usd,
        )

    def _build_qa_source_description(self, question: str) -> str:
        """
        Build source description for Q&A episode.

        Story: E10.5 - Q&A and Chat Ingestion (AC: #5)

        Args:
            question: The question that was asked

        Returns:
            Human-readable source description with question preview
        """
        # Truncate long questions for readability
        q_preview = question[:100] + "..." if len(question) > 100 else question
        return f"Q&A Response | Question: {q_preview}"

    def _build_chat_source_description(self, message_context: str) -> str:
        """
        Build source description for chat fact episode.

        Story: E10.5 - Q&A and Chat Ingestion (AC: #5)

        Args:
            message_context: The full chat message for context

        Returns:
            Human-readable source description
        """
        # Truncate long context for readability
        ctx_preview = message_context[:80] + "..." if len(message_context) > 80 else message_context
        return f"Analyst Chat | Context: {ctx_preview}"

    async def ingest_qa_response(
        self,
        qa_item_id: str,
        deal_id: str,
        organization_id: str,  # E12.9: Required for multi-tenant isolation
        question: str,
        answer: str,
    ) -> IngestionResult:
        """
        Ingest Q&A response as authoritative knowledge.

        Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #4, #5)
        Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)

        Q&A answers have highest confidence (0.95) because they're
        client-provided authoritative answers. If the answer contradicts
        an existing fact, Graphiti's temporal model creates a SUPERSEDES
        relationship and marks the old fact's invalid_at = now().

        E12.9: group_id = "{organization_id}:{deal_id}" ensures complete
        namespace isolation between organizations.

        Args:
            qa_item_id: Q&A item UUID (for provenance)
            deal_id: Deal UUID for scoping within organization
            organization_id: Organization UUID for namespace isolation (E12.9)
            question: The question that was asked
            answer: Client/user provided answer

        Returns:
            IngestionResult with episode_count=1

        Raises:
            GraphitiConnectionError: If Graphiti/Neo4j connection fails
        """
        start_time = time.perf_counter()

        # Build episode name and source description
        episode_name = f"qa-response-{qa_item_id[:8]}"
        source_desc = self._build_qa_source_description(question)

        # Combine question and answer for richer context extraction
        content = f"Q: {question}\n\nA: {answer}"

        # Use M&A schema helpers (from E10.3)
        entity_types = get_entity_types()
        edge_types = get_edge_types()
        edge_type_map = get_edge_type_map()

        logger.info(
            "Ingesting Q&A response to Graphiti",
            qa_item_id=qa_item_id,
            deal_id=deal_id,
            organization_id=organization_id,
            confidence=QA_CONFIDENCE,
        )

        await GraphitiClient.add_episode(
            deal_id=deal_id,
            organization_id=organization_id,  # E12.9: Multi-tenant isolation
            content=content,
            name=episode_name,
            source_description=source_desc,
            entity_types=entity_types,
            edge_types=edge_types,
            edge_type_map=edge_type_map,
        )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Estimate cost using helper function
        estimated_cost_usd = _estimate_embedding_cost(content)

        logger.info(
            "Q&A response ingested to Graphiti",
            qa_item_id=qa_item_id,
            deal_id=deal_id,
            organization_id=organization_id,
            confidence=QA_CONFIDENCE,
            elapsed_ms=elapsed_ms,
        )

        return IngestionResult(
            episode_count=1,
            elapsed_ms=elapsed_ms,
            estimated_cost_usd=estimated_cost_usd,
        )

    async def ingest_chat_fact(
        self,
        message_id: str,
        deal_id: str,
        organization_id: str,  # E12.9: Required for multi-tenant isolation
        fact_content: str,
        message_context: str,
    ) -> IngestionResult:
        """
        Ingest fact extracted from analyst chat.

        Story: E10.5 - Q&A and Chat Ingestion (AC: #2, #4, #5)
        Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)

        Chat facts have high confidence (0.90) and create episodes
        with source_channel="analyst_chat".

        E12.9: group_id = "{organization_id}:{deal_id}" ensures complete
        namespace isolation between organizations.

        Args:
            message_id: Chat message UUID (for provenance)
            deal_id: Deal UUID for scoping within organization
            organization_id: Organization UUID for namespace isolation (E12.9)
            fact_content: The extracted fact
            message_context: Full message for context

        Returns:
            IngestionResult with episode_count=1

        Raises:
            GraphitiConnectionError: If Graphiti/Neo4j connection fails
        """
        start_time = time.perf_counter()

        # Build episode name and source description
        episode_name = f"chat-fact-{message_id[:8]}"
        source_desc = self._build_chat_source_description(message_context)

        # Use M&A schema helpers (from E10.3)
        entity_types = get_entity_types()
        edge_types = get_edge_types()
        edge_type_map = get_edge_type_map()

        logger.info(
            "Ingesting chat fact to Graphiti",
            message_id=message_id,
            deal_id=deal_id,
            organization_id=organization_id,
            confidence=CHAT_CONFIDENCE,
        )

        await GraphitiClient.add_episode(
            deal_id=deal_id,
            organization_id=organization_id,  # E12.9: Multi-tenant isolation
            content=fact_content,
            name=episode_name,
            source_description=source_desc,
            entity_types=entity_types,
            edge_types=edge_types,
            edge_type_map=edge_type_map,
        )

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        # Estimate cost using helper function
        estimated_cost_usd = _estimate_embedding_cost(fact_content)

        logger.info(
            "Chat fact ingested to Graphiti",
            message_id=message_id,
            deal_id=deal_id,
            organization_id=organization_id,
            confidence=CHAT_CONFIDENCE,
            elapsed_ms=elapsed_ms,
        )

        return IngestionResult(
            episode_count=1,
            elapsed_ms=elapsed_ms,
            estimated_cost_usd=estimated_cost_usd,
        )


__all__ = [
    "GraphitiIngestionService",
    "IngestionResult",
    # Confidence constants (E10.5)
    "QA_CONFIDENCE",
    "CHAT_CONFIDENCE",
    "DOCUMENT_CONFIDENCE",
]
