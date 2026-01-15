"""
Document-type aware extraction hints for Graphiti.

Story: E14-S2 - Document-Type Extraction Hints

This module provides:
- DocumentType: Enum for categorizing documents
- detect_document_type(): Filename-based document classification
- get_extraction_hints(): Type-specific extraction instructions

Usage:
    from src.graphiti.extraction_hints import detect_document_type, get_extraction_hints

    doc_type = detect_document_type({'filename': 'Q3_Financial_Report.xlsx'})
    hints = get_extraction_hints(doc_type, metadata)
"""

from enum import Enum
from typing import Optional


class DocumentType(Enum):
    """Document type classification for extraction hints."""

    FINANCIAL = "financial"
    LEGAL = "legal"
    OPERATIONAL = "operational"
    MARKET = "market"
    GENERAL = "general"


EXTRACTION_HINTS: dict[DocumentType, str] = {
    DocumentType.FINANCIAL: """
Extract all financial entities including:
- Financial metrics (revenue, EBITDA, margins, growth rates)
- Time periods and their associated values
- Trends and comparisons (YoY, QoQ)
- Financial ratios and KPIs
- Currency and units
- Forecasts and projections
Pay special attention to relationships between metrics across time periods.
""",
    DocumentType.LEGAL: """
Extract all legal entities including:
- Contracting parties (full legal names)
- Contract terms (duration, renewal, termination)
- Obligations and commitments
- Financial terms (payment schedules, penalties)
- Dates (effective, expiration, milestones)
- Governing law and jurisdiction
Pay special attention to conditional clauses and exceptions.
""",
    DocumentType.OPERATIONAL: """
Extract all operational entities including:
- Business processes and workflows
- Operational KPIs and metrics
- Capacity and utilization figures
- Employee counts and organizational structure
- Locations and facilities
- Systems and technology used
- Suppliers and partners
Pay special attention to dependencies and bottlenecks.
""",
    DocumentType.MARKET: """
Extract all market entities including:
- Market size and growth rates
- Competitors and market share
- Customer segments
- Industry trends
- Regulatory factors
- Geographic markets
- Pricing and positioning
Pay special attention to competitive dynamics and market drivers.
""",
    DocumentType.GENERAL: """
Extract all relevant entities including:
- Organizations and people
- Dates and time periods
- Numerical values with context
- Relationships between entities
- Key facts and claims
Be thorough - capture any information that could be relevant for M&A analysis.
""",
}

# Keyword mappings for document type detection
_FINANCIAL_KEYWORDS = frozenset([
    "financial",
    "income",
    "balance",
    "cashflow",
    "cash flow",
    "p&l",
    "pnl",
    "forecast",
    "budget",
    "model",
    "revenue",
    "ebitda",
    "profit",
    "loss",
    "statement",
])

_LEGAL_KEYWORDS = frozenset([
    "contract",
    "agreement",
    "nda",
    "lease",
    "license",
    "terms",
    "legal",
    "amendment",
    "addendum",
    "mou",
    "memorandum",
])

_OPERATIONAL_KEYWORDS = frozenset([
    "operations",
    "process",
    "org",
    "structure",
    "capacity",
    "workflow",
    "procedure",
    "sop",
    "employee",
    "headcount",
    "facility",
])

_MARKET_KEYWORDS = frozenset([
    "market",
    "industry",
    "competitor",
    "research",
    "analysis",
    "segment",
    "customer",
    "trend",
    "landscape",
])


def detect_document_type(metadata: dict) -> DocumentType:
    """
    Detect document type from metadata and filename.

    Story: E14-S2 - Document-Type Extraction Hints (AC: #3)

    Uses filename-based keyword matching to classify documents.
    Falls back to GENERAL if no keywords match.

    Args:
        metadata: Document metadata dict with 'filename' key

    Returns:
        DocumentType enum value
    """
    filename = metadata.get("filename", "").lower()

    # Check each category's keywords
    if any(kw in filename for kw in _FINANCIAL_KEYWORDS):
        return DocumentType.FINANCIAL
    elif any(kw in filename for kw in _LEGAL_KEYWORDS):
        return DocumentType.LEGAL
    elif any(kw in filename for kw in _OPERATIONAL_KEYWORDS):
        return DocumentType.OPERATIONAL
    elif any(kw in filename for kw in _MARKET_KEYWORDS):
        return DocumentType.MARKET

    # Default to general
    return DocumentType.GENERAL


def get_extraction_hints(
    doc_type: DocumentType, metadata: Optional[dict] = None
) -> str:
    """
    Get extraction hints for document type.

    Story: E14-S2 - Document-Type Extraction Hints (AC: #4)

    Returns type-specific extraction instructions that can be passed
    to Graphiti's source_description parameter to guide entity extraction.

    Args:
        doc_type: DocumentType enum value
        metadata: Optional metadata to include source context

    Returns:
        Extraction hint string for the document type
    """
    base_hints = EXTRACTION_HINTS.get(doc_type, EXTRACTION_HINTS[DocumentType.GENERAL])

    # Add any metadata-specific context
    context_parts = [base_hints.strip()]

    if metadata:
        if filename := metadata.get("filename"):
            context_parts.append(f"\nSource document: {filename}")
        if file_type := metadata.get("file_type"):
            context_parts.append(f"File format: {file_type}")

    return "\n".join(context_parts)


__all__ = [
    "DocumentType",
    "detect_document_type",
    "get_extraction_hints",
    "EXTRACTION_HINTS",
]
