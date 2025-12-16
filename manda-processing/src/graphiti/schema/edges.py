"""
Pydantic edge models for Graphiti guided extraction.
Story: E10.3 - Sell-Side Spine Schema (AC: #2)

Edge models define the types of relationships that Graphiti should extract
between entities. These are passed to add_episode() as edge_types.

Usage:
    from src.graphiti.schema.edges import WorksFor, SupersedesEdge

    # Pass to Graphiti
    edge_types = {'WORKS_FOR': WorksFor, 'SUPERSEDES': SupersedesEdge}
    await graphiti.add_episode(..., edge_types=edge_types)
"""

from typing import Literal

from pydantic import BaseModel, Field


class WorksFor(BaseModel):
    """
    Relationship between Person and Company.

    Represents employment or association between a person and company,
    with optional temporal bounds.

    Attributes:
        start_date: Employment start date (optional, ISO format)
        end_date: Employment end date (optional, ISO format)
        title: Role/title at that company (optional)
    """

    start_date: str | None = None
    end_date: str | None = None
    title: str | None = None


class SupersedesEdge(BaseModel):
    """
    When new fact supersedes old fact (truth evolution).

    Enables temporal knowledge management where newer findings
    replace outdated information.

    Attributes:
        reason: Why this supersedes (optional)
        superseded_at: When supersession occurred (optional, ISO format)
    """

    reason: str | None = None
    superseded_at: str | None = None


class ContradictsEdge(BaseModel):
    """
    Unresolved contradiction between findings.

    Represents conflicting information that hasn't been resolved,
    enabling conflict tracking and resolution workflows.

    Attributes:
        detected_at: When contradiction was detected (optional, ISO format)
        resolution_status: Current resolution status (optional)
    """

    detected_at: str | None = None
    resolution_status: str | None = None


class SupportsEdge(BaseModel):
    """
    Corroboration between findings.

    Represents when one finding supports or validates another,
    increasing confidence in the information.

    Attributes:
        correlation_strength: How strongly findings correlate (0.0-1.0, optional)
    """

    correlation_strength: float | None = Field(default=None, ge=0, le=1)


class ExtractedFrom(BaseModel):
    """
    Provenance: Entity/Finding extracted from Document.

    Tracks where entities and findings were sourced from,
    enabling full provenance tracking.

    Attributes:
        page_number: Page in document (optional)
        chunk_index: Chunk index for long documents (optional)
        confidence: Extraction confidence (0.0-1.0, optional)
    """

    page_number: int | None = None
    chunk_index: int | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)


class CompetesWith(BaseModel):
    """
    Competition relationship between companies.

    Represents competitive dynamics in the market.

    Attributes:
        market_segment: Market segment where competition occurs (optional)
        competitive_intensity: Intensity of competition (optional)
    """

    market_segment: str | None = None
    competitive_intensity: Literal["direct", "indirect", "potential"] | None = None


class InvestsIn(BaseModel):
    """
    Investment relationship.

    Represents investment from Company/Person to Company,
    capturing the type and size of investment.

    Attributes:
        investment_type: Type of investment (optional)
        amount: Investment amount (optional)
        currency: Currency code (default: USD)
    """

    investment_type: Literal["equity", "debt", "convertible", "other"] | None = None
    amount: float | None = None
    currency: str = "USD"


class MentionsEdge(BaseModel):
    """
    Finding mentions an Entity.

    Represents when a finding references or mentions any entity,
    enabling entity-finding linkage for context.

    Attributes:
        context: Surrounding context of the mention (optional)
        sentiment: Sentiment of the mention (optional)
    """

    context: str | None = None
    sentiment: Literal["positive", "negative", "neutral"] | None = None


class SuppliesEdge(BaseModel):
    """
    Supply chain relationship between companies.

    Represents supplier-customer relationships in the market.

    Attributes:
        product_category: Category of products/services supplied (optional)
        relationship_strength: Strength of the relationship (optional)
        contract_type: Type of supply contract (optional)
    """

    product_category: str | None = None
    relationship_strength: Literal["critical", "major", "minor"] | None = None
    contract_type: Literal["exclusive", "preferred", "standard"] | None = None


# Type alias for all edge types
EdgeType = (
    WorksFor
    | SupersedesEdge
    | ContradictsEdge
    | SupportsEdge
    | ExtractedFrom
    | CompetesWith
    | InvestsIn
    | MentionsEdge
    | SuppliesEdge
)
