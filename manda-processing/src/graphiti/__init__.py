"""
Graphiti temporal knowledge graph module.
Story: E10.1 - Graphiti Infrastructure Setup (AC: #1, #2, #3)
Story: E10.3 - Sell-Side Spine Schema (AC: #1, #2, #3, #4, #5, #6)

This module provides:
- GraphitiClient: Singleton client with deal isolation via group_id
- GraphitiConnectionError: Exception for connection failures
- Schema module: Entity and edge Pydantic models for guided extraction

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

    # Cleanup on shutdown
    await GraphitiClient.close()
"""

from graphiti_core.graphiti import EpisodeType

from src.graphiti.client import GraphitiClient, GraphitiConnectionError

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

__all__ = [
    # Client
    "GraphitiClient",
    "GraphitiConnectionError",
    "EpisodeType",
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
]
