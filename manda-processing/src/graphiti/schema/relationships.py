"""
Relationship constants and edge type mappings for Graphiti.
Story: E10.3 - Sell-Side Spine Schema (AC: #6)

This module defines:
- RELATIONSHIP_TYPES: List of valid relationship type names
- EDGE_TYPE_MAP: Mapping of (source_type, target_type) to allowed edges

Usage:
    from src.graphiti.schema.relationships import RELATIONSHIP_TYPES, EDGE_TYPE_MAP

    # Check if relationship type is valid
    assert "WORKS_FOR" in RELATIONSHIP_TYPES

    # Get allowed edges between Person and Company
    allowed = EDGE_TYPE_MAP[('Person', 'Company')]  # ['WORKS_FOR']
"""

# Relationship type name constants
# These correspond to the edge model class names but in SCREAMING_SNAKE_CASE
RELATIONSHIP_TYPES: list[str] = [
    "EXTRACTED_FROM",  # Entity → Document (provenance)
    "MENTIONS",  # Finding → Entity (any entity mentioned)
    "SUPERSEDES",  # Finding → Finding (new truth replaces old)
    "CONTRADICTS",  # Finding → Finding (unresolved conflict)
    "SUPPORTS",  # Finding → Finding (corroboration)
    "WORKS_FOR",  # Person → Company
    "COMPETES_WITH",  # Company → Company
    "SUPPLIES",  # Company → Company
    "INVESTS_IN",  # Company/Person → Company
]


# Edge type map: Which edges can connect which entity types
# Format: {(source_type, target_type): [allowed_edge_types]}
# Uses "Entity" as wildcard for generic entity-to-entity relationships
EDGE_TYPE_MAP: dict[tuple[str, str], list[str]] = {
    # Person relationships
    ("Person", "Company"): ["WORKS_FOR"],
    # Company relationships
    ("Company", "Company"): ["COMPETES_WITH", "SUPPLIES"],
    # Investment relationships (can come from Company or Person)
    ("Company", "Entity"): ["INVESTS_IN"],
    ("Person", "Entity"): ["INVESTS_IN"],
    # Finding relationships (truth evolution and corroboration)
    ("Finding", "Finding"): ["SUPERSEDES", "CONTRADICTS", "SUPPORTS"],
    # Provenance relationships
    ("Entity", "Document"): ["EXTRACTED_FROM"],
    # Mentions (findings can mention any entity)
    ("Finding", "Entity"): ["MENTIONS"],
}
