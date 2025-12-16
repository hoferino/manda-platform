"""
Graphiti schema module for M&A entity and edge definitions.
Story: E10.3 - Sell-Side Spine Schema (AC: #1, #2, #3, #6)

This module provides:
- Entity models: Company, Person, FinancialMetric, Finding, Risk
- Edge models: WorksFor, SupersedesEdge, ContradictsEdge, etc.
- Helper functions: get_entity_types(), get_edge_types(), get_edge_type_map()
- Constants: ENTITY_TYPES, EDGE_TYPES, EDGE_TYPE_MAP, RELATIONSHIP_TYPES

Usage:
    from src.graphiti.schema import (
        # Entity models
        Company, Person, FinancialMetric, Finding, Risk,
        # Edge models
        WorksFor, SupersedesEdge,
        # Helper functions
        get_entity_types, get_edge_types, get_edge_type_map,
        # Constants
        ENTITY_TYPES, EDGE_TYPES, EDGE_TYPE_MAP,
    )

    # Use helpers with GraphitiClient.add_episode()
    await GraphitiClient.add_episode(
        deal_id="deal-123",
        content="...",
        name="document.pdf",
        source_description="Financial report",
        entity_types=get_entity_types(),
        edge_types=get_edge_types(),
        edge_type_map=get_edge_type_map(),
    )
"""

from pydantic import BaseModel

from src.graphiti.schema.edges import (
    CompetesWith,
    ContradictsEdge,
    EdgeType,
    ExtractedFrom,
    InvestsIn,
    MentionsEdge,
    SupersedesEdge,
    SuppliesEdge,
    SupportsEdge,
    WorksFor,
)
from src.graphiti.schema.entities import (
    Company,
    EntityType,
    Finding,
    FinancialMetric,
    Person,
    Risk,
)
from src.graphiti.schema.relationships import EDGE_TYPE_MAP, RELATIONSHIP_TYPES

# Module-level constants (AC: #3, #6)
# These are pre-built dictionaries for common use cases

ENTITY_TYPES: dict[str, type[BaseModel]] = {
    "Company": Company,
    "Person": Person,
    "FinancialMetric": FinancialMetric,
    "Finding": Finding,
    "Risk": Risk,
}

EDGE_TYPES: dict[str, type[BaseModel]] = {
    "WORKS_FOR": WorksFor,
    "SUPERSEDES": SupersedesEdge,
    "CONTRADICTS": ContradictsEdge,
    "SUPPORTS": SupportsEdge,
    "EXTRACTED_FROM": ExtractedFrom,
    "COMPETES_WITH": CompetesWith,
    "INVESTS_IN": InvestsIn,
    "MENTIONS": MentionsEdge,
    "SUPPLIES": SuppliesEdge,
}


def get_entity_types() -> dict[str, type[BaseModel]]:
    """
    Get the entity types dictionary for Graphiti add_episode().

    Returns:
        Dictionary mapping entity type names to Pydantic model classes.
        Format: {'Company': Company, 'Person': Person, ...}

    Example:
        >>> entity_types = get_entity_types()
        >>> await graphiti.add_episode(..., entity_types=entity_types)
    """
    return ENTITY_TYPES.copy()


def get_edge_types() -> dict[str, type[BaseModel]]:
    """
    Get the edge types dictionary for Graphiti add_episode().

    Returns:
        Dictionary mapping edge type names to Pydantic model classes.
        Format: {'WORKS_FOR': WorksFor, 'SUPERSEDES': SupersedesEdge, ...}

    Example:
        >>> edge_types = get_edge_types()
        >>> await graphiti.add_episode(..., edge_types=edge_types)
    """
    return EDGE_TYPES.copy()


def get_edge_type_map() -> dict[tuple[str, str], list[str]]:
    """
    Get the edge type map for Graphiti add_episode().

    Returns:
        Dictionary mapping (source_type, target_type) tuples to lists of
        allowed edge types between those entity types.
        Format: {('Person', 'Company'): ['WORKS_FOR'], ...}

    Example:
        >>> edge_type_map = get_edge_type_map()
        >>> await graphiti.add_episode(..., edge_type_map=edge_type_map)
    """
    return EDGE_TYPE_MAP.copy()


__all__ = [
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
