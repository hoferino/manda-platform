"""
Graphiti temporal knowledge graph module.
Story: E10.1 - Graphiti Infrastructure Setup (AC: #1, #2, #3)
Story: E10.3 - Sell-Side Spine Schema (AC: #1, #2, #3, #4, #5, #6)
Story: E10.4 - Document Ingestion Pipeline (AC: #1, #2, #3)
Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #2, #4, #5)

This module provides:
- GraphitiClient: Singleton client with deal isolation via group_id
- GraphitiConnectionError: Exception for connection failures
- Schema module: Entity and edge Pydantic models for guided extraction
- Ingestion module: Document chunk ingestion service

Usage:
    from src.graphiti import GraphitiClient, GraphitiConnectionError

    # Get Graphiti instance
    client = await GraphitiClient.get_instance()

    # Add episode with deal isolation (uses default M&A schema)
    await GraphitiClient.add_episode(
        deal_id="deal-123",
        content="Company revenue increased 15%...",
        name="financial-report.pdf",
        source_description="Annual financial report 2024"
    )

    # Add episode with custom entity/edge types
    from src.graphiti.schema import get_entity_types, get_edge_types, get_edge_type_map

    await GraphitiClient.add_episode(
        deal_id="deal-123",
        content="...",
        name="document.pdf",
        source_description="Document",
        entity_types=get_entity_types(),
        edge_types=get_edge_types(),
        edge_type_map=get_edge_type_map(),
    )

    # Ingest document chunks (E10.4)
    from src.graphiti import GraphitiIngestionService

    service = GraphitiIngestionService()
    result = await service.ingest_document_chunks(
        document_id="doc-123",
        deal_id="deal-456",
        document_name="report.pdf",
        chunks=chunks,
    )

    # Cleanup on shutdown
    await GraphitiClient.close()
"""

from graphiti_core.graphiti import EpisodeType

from src.graphiti.client import GraphitiClient, GraphitiConnectionError
from src.graphiti.ingestion import (
    CHAT_CONFIDENCE,
    DOCUMENT_CONFIDENCE,
    QA_CONFIDENCE,
    GraphitiIngestionService,
    IngestionResult,
)

# E10.7: Hybrid retrieval module
from src.graphiti.retrieval import (
    HybridRetrievalService,
    KnowledgeItem,
    RetrievalResult,
    SourceCitation,
)

# Semantic-only retrieval (feature flag: RAG_MODE=semantic)
from src.graphiti.semantic_retrieval import SemanticRetrievalService

# E10.6: Entity resolution module
from src.graphiti.resolution import (
    COMPANY_SUFFIX_VARIATIONS,
    DISTINCT_METRICS,
    RESOLUTION_THRESHOLDS,
    get_entity_resolution_history,
    get_manda_resolution_context,
    is_protected_metric,
    normalize_company_name,
    normalize_person_name,
    should_merge_companies,
    should_merge_persons,
)

# E14-S2: Document-type extraction hints
from src.graphiti.extraction_hints import (
    DocumentType,
    EXTRACTION_HINTS,
    detect_document_type,
    get_extraction_hints,
)

# Re-export schema module for convenience
from src.graphiti.schema import (
    EDGE_TYPE_MAP,
    EDGE_TYPES,
    ENTITY_TYPES,
    RELATIONSHIP_TYPES,
    Company,
    CompetesWith,
    ContradictsEdge,
    EdgeType,
    EntityType,
    ExtractedFrom,
    Finding,
    FinancialMetric,
    InvestsIn,
    MentionsEdge,
    Person,
    Risk,
    SupersedesEdge,
    SuppliesEdge,
    SupportsEdge,
    WorksFor,
    get_edge_type_map,
    get_edge_types,
    get_entity_types,
)

def get_retrieval_service() -> HybridRetrievalService | SemanticRetrievalService:
    """
    Factory function to get the appropriate retrieval service based on RAG_MODE.

    Feature flag controlled via environment variable or settings:
    - RAG_MODE=graphiti (default): Full Graphiti RAG with graph traversal
    - RAG_MODE=semantic: Semantic-only vector search (simpler, for testing)
    - RAG_MODE=google_file_search: Google File Search API (future)

    Returns:
        HybridRetrievalService or SemanticRetrievalService based on config

    Usage:
        from src.graphiti import get_retrieval_service

        service = get_retrieval_service()
        result = await service.retrieve(query="...", deal_id="...")
    """
    from src.config import get_settings

    settings = get_settings()
    mode = settings.rag_mode

    if mode == "semantic":
        return SemanticRetrievalService()
    elif mode == "google_file_search":
        # Future: Return GoogleFileSearchService
        raise NotImplementedError(
            "Google File Search mode not yet implemented. Use 'graphiti' or 'semantic'."
        )
    else:
        # Default to graphiti (full RAG)
        return HybridRetrievalService()


__all__ = [
    # Client
    "GraphitiClient",
    "GraphitiConnectionError",
    "EpisodeType",
    # Ingestion (E10.4)
    "GraphitiIngestionService",
    "IngestionResult",
    # Retrieval (E10.7)
    "HybridRetrievalService",
    "SemanticRetrievalService",
    "get_retrieval_service",
    "RetrievalResult",
    "KnowledgeItem",
    "SourceCitation",
    # Confidence constants (E10.5)
    "QA_CONFIDENCE",
    "CHAT_CONFIDENCE",
    "DOCUMENT_CONFIDENCE",
    # Entity models
    "Company",
    "Person",
    "FinancialMetric",
    "Finding",
    "Risk",
    "EntityType",
    # Edge models
    "WorksFor",
    "SupersedesEdge",
    "ContradictsEdge",
    "SupportsEdge",
    "ExtractedFrom",
    "CompetesWith",
    "InvestsIn",
    "MentionsEdge",
    "SuppliesEdge",
    "EdgeType",
    # Helper functions
    "get_entity_types",
    "get_edge_types",
    "get_edge_type_map",
    # Constants
    "ENTITY_TYPES",
    "EDGE_TYPES",
    "EDGE_TYPE_MAP",
    "RELATIONSHIP_TYPES",
    # Resolution module (E10.6)
    "normalize_company_name",
    "normalize_person_name",
    "is_protected_metric",
    "should_merge_companies",
    "should_merge_persons",
    "get_manda_resolution_context",
    "get_entity_resolution_history",
    "COMPANY_SUFFIX_VARIATIONS",
    "DISTINCT_METRICS",
    "RESOLUTION_THRESHOLDS",
    # Extraction hints module (E14-S2)
    "DocumentType",
    "EXTRACTION_HINTS",
    "detect_document_type",
    "get_extraction_hints",
]
