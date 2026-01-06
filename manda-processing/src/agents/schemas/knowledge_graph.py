"""
Pydantic models for knowledge graph analysis structured outputs.
Story: E13.6 - Knowledge Graph Specialist Agent (AC: #1, #3)

These models guarantee validated, typed responses from the Knowledge Graph agent.
Using Pydantic models as result_type ensures the LLM output matches the schema.

Key models:
- EntityMatch: Resolved entity with confidence and aliases
- RelationshipPath: Graph traversal path with individual steps
- ContradictionResult: Conflicting facts with severity assessment
- KGAnalysisResult: Complete result from knowledge graph analysis
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field

# Re-export SourceReference from financial schemas for consistency
from src.agents.schemas.financial import SourceReference


class EntityMatch(BaseModel):
    """
    A resolved entity match from entity resolution.

    Represents a matched entity with confidence score and known aliases.
    """

    name: str = Field(
        description="Canonical name of the matched entity",
    )
    entity_type: str = Field(
        description="Type of entity (Company, Person, FinancialMetric, Document, Location)",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score from 0.0 to 1.0 based on match quality",
    )
    aliases: list[str] = Field(
        default_factory=list,
        description="Known alternative names or aliases for this entity",
    )
    source: Optional[SourceReference] = Field(
        default=None,
        description="Reference to where this entity was found",
    )
    properties: dict[str, str] = Field(
        default_factory=dict,
        description="Additional entity properties (e.g., industry, role, location)",
    )


class RelationshipStep(BaseModel):
    """
    A single step in a relationship path traversal.

    Represents one hop in the graph from one entity to another.
    """

    from_entity: str = Field(
        description="Name of the source entity in this step",
    )
    from_entity_type: str = Field(
        description="Type of the source entity",
    )
    relationship: str = Field(
        description="Type of relationship (WORKS_AT, OWNS, SUBSIDIARY_OF, etc.)",
    )
    to_entity: str = Field(
        description="Name of the target entity in this step",
    )
    to_entity_type: str = Field(
        description="Type of the target entity",
    )
    properties: dict[str, str] = Field(
        default_factory=dict,
        description="Relationship properties (e.g., start_date, role, percentage)",
    )


class RelationshipPath(BaseModel):
    """
    A complete path through the knowledge graph.

    Represents a chain of relationships connecting two entities.
    """

    start_entity: str = Field(
        description="Name of the starting entity",
    )
    start_entity_type: str = Field(
        description="Type of the starting entity",
    )
    end_entity: str = Field(
        description="Name of the ending entity",
    )
    end_entity_type: str = Field(
        description="Type of the ending entity",
    )
    path: list[RelationshipStep] = Field(
        default_factory=list,
        description="List of relationship steps forming the path",
    )
    total_hops: int = Field(
        ge=0,
        description="Total number of hops (relationships) in the path",
    )
    path_description: str = Field(
        default="",
        description="Human-readable description of the path (e.g., 'John Smith --[WORKS_AT]--> Acme Corp')",
    )


class ContradictionResult(BaseModel):
    """
    A detected contradiction between facts in the knowledge graph.

    Represents conflicting information that needs attention.
    """

    fact1: str = Field(
        description="First fact statement",
    )
    fact1_source: Optional[SourceReference] = Field(
        default=None,
        description="Source of the first fact",
    )
    fact1_valid_at: Optional[str] = Field(
        default=None,
        description="When fact1 was valid (ISO timestamp or period)",
    )
    fact2: str = Field(
        description="Second fact statement (conflicting with fact1)",
    )
    fact2_source: Optional[SourceReference] = Field(
        default=None,
        description="Source of the second fact",
    )
    fact2_valid_at: Optional[str] = Field(
        default=None,
        description="When fact2 was valid (ISO timestamp or period)",
    )
    conflict_type: str = Field(
        description="Type of conflict (value_mismatch, relationship_changed, superseded, etc.)",
    )
    severity: Literal["critical", "moderate", "informational"] = Field(
        description="Severity level: critical (>10% diff), moderate (minor diff), informational (superseded data)",
    )
    resolution_hint: str = Field(
        default="",
        description="Suggested approach to resolve the contradiction",
    )
    affected_entity: Optional[str] = Field(
        default=None,
        description="Primary entity affected by this contradiction",
    )


class TemporalFact(BaseModel):
    """
    A fact with temporal context (valid_at / invalid_at).

    Used for tracking when facts were true and if they've been superseded.

    TODO (E13.6 Enhancement): The find_contradictions tool currently returns
    contradictions as ContradictionResult objects but doesn't populate the
    KGAnalysisResult.temporal_facts field. Future enhancement could extract
    temporal facts during contradiction detection and return them for richer
    timeline analysis and visualization in the UI.
    """

    fact: str = Field(
        description="The fact statement",
    )
    entity: str = Field(
        description="Entity this fact relates to",
    )
    valid_at: Optional[str] = Field(
        default=None,
        description="When this fact became valid (ISO timestamp)",
    )
    invalid_at: Optional[str] = Field(
        default=None,
        description="When this fact became invalid/superseded (ISO timestamp)",
    )
    is_current: bool = Field(
        default=True,
        description="Whether this fact is currently valid",
    )
    source: Optional[SourceReference] = Field(
        default=None,
        description="Source of this fact",
    )


class KGAnalysisResult(BaseModel):
    """
    Complete result from knowledge graph analysis.

    This is the result_type for the Knowledge Graph agent, ensuring
    all responses have consistent structure.
    """

    summary: str = Field(
        description="Executive summary answering the user's query directly",
    )
    entities: list[EntityMatch] = Field(
        default_factory=list,
        description="Entities identified and resolved during analysis",
    )
    paths: list[RelationshipPath] = Field(
        default_factory=list,
        description="Relationship paths discovered (if traversal was performed)",
    )
    contradictions: list[ContradictionResult] = Field(
        default_factory=list,
        description="Contradictions detected (if any)",
    )
    temporal_facts: list[TemporalFact] = Field(
        default_factory=list,
        description="Facts with temporal context (if timeline analysis was performed)",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall confidence in the analysis based on data quality and match scores",
    )
    sources: list[SourceReference] = Field(
        default_factory=list,
        description="All sources referenced in this analysis",
    )
    traversal_explanation: Optional[str] = Field(
        default=None,
        description="Explanation of graph traversal strategy used (if applicable)",
    )
    limitations: Optional[str] = Field(
        default=None,
        description="Data limitations or caveats that affect the analysis",
    )
    follow_up_questions: list[str] = Field(
        default_factory=list,
        description="Suggested follow-up questions if data was insufficient",
    )


__all__ = [
    "SourceReference",
    "EntityMatch",
    "RelationshipStep",
    "RelationshipPath",
    "ContradictionResult",
    "TemporalFact",
    "KGAnalysisResult",
]
