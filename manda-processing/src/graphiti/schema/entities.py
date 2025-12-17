"""
Pydantic entity models for Graphiti guided extraction.
Story: E10.3 - Sell-Side Spine Schema (AC: #1)

Entity models define the types of nodes that Graphiti should extract
from document content. These are passed to add_episode() as entity_types.

Usage:
    from src.graphiti.schema.entities import Company, Person, FinancialMetric

    # Pass to Graphiti
    entity_types = {'Company': Company, 'Person': Person}
    await graphiti.add_episode(..., entity_types=entity_types)
"""

from typing import Literal

from pydantic import BaseModel, Field


class Company(BaseModel):
    """
    Company entity for M&A deals.

    Represents any corporate entity involved in a deal, whether as target,
    acquirer, competitor, or other role.

    Attributes:
        name: Official company name
        role: Company's role in the M&A context
        industry: Industry sector (optional)
        aliases: Alternative names for entity resolution
    """

    name: str
    role: Literal["target", "acquirer", "competitor", "customer", "supplier", "investor"]
    industry: str | None = None
    aliases: list[str] = Field(default_factory=list)


class Person(BaseModel):
    """
    Person entity involved in a deal.

    Represents individuals connected to the transaction, including
    executives, advisors, board members, and other stakeholders.

    Attributes:
        name: Full name of the person
        title: Job title (optional)
        role: Person's role in M&A context
        company_id: Reference to associated Company entity (optional)
        aliases: Alternative names for entity resolution (e.g., "J. Smith" for "John Smith")
    """

    name: str
    title: str | None = None
    role: Literal["executive", "advisor", "board", "investor", "employee"]
    company_id: str | None = None
    aliases: list[str] = Field(default_factory=list)


class FinancialMetric(BaseModel):
    """
    Financial metric extracted from documents.

    Captures quantitative financial data with temporal and accounting context.
    Critical for M&A analysis where GAAP vs adjusted figures matter.

    Attributes:
        metric_type: Type of metric (revenue, ebitda, margin, growth_rate, etc.)
        value: Numeric value
        period: Time period (Q3 2024, FY 2023, LTM, etc.)
        currency: Currency code (default: USD)
        basis: Accounting basis (GAAP, adjusted, pro_forma)
    """

    metric_type: str  # Free-form to allow discovery of novel metrics
    value: float
    period: str
    currency: str = "USD"
    basis: str | None = None


class Finding(BaseModel):
    """
    Knowledge finding extracted from source.

    Represents discrete pieces of knowledge with provenance and confidence.
    Source channel enables truth ranking (Q&A responses > documents).

    Attributes:
        content: The finding text
        confidence: Confidence score (0.0 to 1.0)
        source_channel: Where the finding came from
        finding_type: Classification of the finding
    """

    content: str
    confidence: float = Field(ge=0, le=1)
    source_channel: Literal["document", "qa_response", "meeting_note", "analyst_chat"]
    finding_type: Literal["fact", "metric", "risk", "opportunity", "insight"]


class Risk(BaseModel):
    """
    Risk identified in deal.

    Captures deal risks with severity classification and optional mitigation.
    Category is free-form to allow discovery of novel risk types.

    Attributes:
        description: Description of the risk
        severity: Risk severity level
        category: Risk category (customer_concentration, key_person, regulatory, etc.)
        mitigation: Any identified mitigation (optional)
    """

    description: str
    severity: Literal["high", "medium", "low"]
    category: str  # Free-form for novel risk types
    mitigation: str | None = None


# Type alias for all entity types
EntityType = Company | Person | FinancialMetric | Finding | Risk
