"""
M&A entity resolution configuration and helpers.
Story: E10.6 - Entity Resolution (AC: #1, #2, #3)

This module provides:
- Normalization functions for company and person names
- Protected metric detection to prevent auto-merging
- M&A-specific resolution context for LLM guidance
- Confidence thresholds for merge decisions

Usage:
    from src.graphiti.resolution import (
        normalize_company_name,
        normalize_person_name,
        is_protected_metric,
        should_merge_companies,
        get_manda_resolution_context,
    )

    # Normalize for comparison
    norm1 = normalize_company_name("ABC Corp")  # "abc"
    norm2 = normalize_company_name("ABC Corporation")  # "abc"

    # Check if entities should merge
    should_merge, confidence = should_merge_companies("ABC Corp", "ABC Inc")

    # Protect metrics from auto-merge
    if is_protected_metric("Net Revenue"):
        # Don't merge with "Revenue"
        pass
"""

import structlog

logger = structlog.get_logger(__name__)


# ============================================================
# Company Suffix Variations (AC: #1)
# ============================================================
# Common suffixes to strip when comparing company names.
# This enables "ABC Corp" = "ABC Corporation" = "ABC Inc."
# ============================================================

COMPANY_SUFFIX_VARIATIONS: set[str] = {
    "corp",
    "corporation",
    "inc",
    "incorporated",
    "llc",
    "llp",
    "ltd",
    "limited",
    "co",
    "company",
    "group",
    "holdings",
    "plc",
    "gmbh",
    "ag",
    "sa",
}


# ============================================================
# Protected Metrics (AC: #3)
# ============================================================
# Metrics that must NEVER be auto-merged because they represent
# distinct financial concepts with different values.
# ============================================================

DISTINCT_METRICS: dict[str, list[str] | bool] = {
    "revenue_types": [
        "revenue",
        "net revenue",
        "gross revenue",
        "recurring revenue",
        "arr",
        "mrr",
    ],
    "margin_types": [
        "gross margin",
        "operating margin",
        "net margin",
        "ebitda margin",
    ],
    "period_sensitivity": True,  # Q3 2024 ≠ Q3 2023
}


# ============================================================
# Resolution Confidence Thresholds (AC: #1, #2)
# ============================================================
# Used to determine merge confidence levels.
# ============================================================

RESOLUTION_THRESHOLDS: dict[str, float] = {
    "exact_match": 1.0,
    "high_confidence": 0.85,
    "review_threshold": 0.70,
    "low_confidence": 0.50,
}


def normalize_company_name(name: str) -> str:
    """
    Normalize company name for comparison by stripping suffixes and punctuation.

    Story: E10.6 - Entity Resolution (AC: #1)

    Enables matching "ABC Corp" = "ABC Corporation" = "ABC Inc."
    by removing common corporate suffixes and punctuation.

    Args:
        name: Raw company name

    Returns:
        Normalized lowercase name with suffixes stripped

    Examples:
        >>> normalize_company_name("ABC Corp")
        'abc'
        >>> normalize_company_name("ABC Corporation")
        'abc'
        >>> normalize_company_name("ABC, Inc.")
        'abc'
    """
    normalized = name.lower().strip()

    # Replace punctuation with spaces
    for char in [".", ",", "-", "'"]:
        normalized = normalized.replace(char, " ")

    # Split into words and filter out suffixes
    words = normalized.split()
    filtered = [w for w in words if w not in COMPANY_SUFFIX_VARIATIONS]

    return " ".join(filtered).strip()


def normalize_person_name(name: str) -> str:
    """
    Normalize person name for comparison.

    Story: E10.6 - Entity Resolution (AC: #2)

    Strips titles in parentheses and normalizes casing.
    Preserves initials (J. Smith) for pattern matching.

    Args:
        name: Raw person name

    Returns:
        Normalized lowercase name

    Examples:
        >>> normalize_person_name("John Smith (CEO)")
        'john smith'
        >>> normalize_person_name("J. Smith")
        'j. smith'
    """
    normalized = name.lower().strip()

    # Remove titles in parentheses for comparison
    if "(" in normalized:
        normalized = normalized.split("(")[0].strip()

    return normalized


def is_protected_metric(entity_name: str) -> bool:
    """
    Check if entity is a financial metric that should never be auto-merged.

    Story: E10.6 - Entity Resolution (AC: #3)

    Prevents merging distinct metrics like "Revenue" and "Net Revenue"
    which represent different financial values.

    Args:
        entity_name: Name of the entity to check

    Returns:
        True if entity is a protected metric that shouldn't be merged

    Examples:
        >>> is_protected_metric("Net Revenue")
        True
        >>> is_protected_metric("ABC Company")
        False
    """
    name_lower = entity_name.lower()

    for metric_group in DISTINCT_METRICS.values():
        if isinstance(metric_group, list):
            for metric in metric_group:
                if metric in name_lower:
                    return True

    return False


def should_merge_companies(name1: str, name2: str) -> tuple[bool, float]:
    """
    Pre-filter check for company name matching.

    Story: E10.6 - Entity Resolution (AC: #1)

    Performs fast string comparison after normalization to determine
    if two company names likely refer to the same entity.

    Args:
        name1: First company name
        name2: Second company name

    Returns:
        Tuple of (should_merge, confidence_score)

    Examples:
        >>> should_merge_companies("ABC Corp", "ABC Inc")
        (True, 0.95)
        >>> should_merge_companies("ABC Corp", "XYZ Corp")
        (False, 0.0)
    """
    norm1 = normalize_company_name(name1)
    norm2 = normalize_company_name(name2)

    # Guard against empty strings (e.g., names that are only suffixes like "Corp")
    if not norm1 or not norm2:
        return False, 0.0

    # Exact match after normalization
    if norm1 == norm2:
        logger.debug(
            "Company name exact match",
            name1=name1,
            name2=name2,
            normalized=norm1,
        )
        return True, 0.95

    # Substring match (one contains the other)
    if norm1 and norm2 and (norm1 in norm2 or norm2 in norm1):
        logger.debug(
            "Company name substring match",
            name1=name1,
            name2=name2,
            norm1=norm1,
            norm2=norm2,
        )
        return True, 0.80

    return False, 0.0


def should_merge_persons(name1: str, name2: str, title1: str | None = None, title2: str | None = None) -> tuple[bool, float]:
    """
    Pre-filter check for person name matching.

    Story: E10.6 - Entity Resolution (AC: #2)

    Handles patterns like "J. Smith" = "John Smith" when context matches.
    Different titles/roles for same name should NOT merge.

    Args:
        name1: First person name
        name2: Second person name
        title1: Optional title/role for first person
        title2: Optional title/role for second person

    Returns:
        Tuple of (should_merge, confidence_score)

    Examples:
        >>> should_merge_persons("J. Smith", "John Smith")
        (True, 0.75)
        >>> should_merge_persons("John Smith", "John Smith", "CEO", "CFO")
        (False, 0.0)
    """
    norm1 = normalize_person_name(name1)
    norm2 = normalize_person_name(name2)

    # Guard against empty strings
    if not norm1 or not norm2:
        return False, 0.0

    # Different titles/roles = different people
    if title1 and title2 and title1.lower() != title2.lower():
        logger.debug(
            "Person different roles - not merging",
            name1=name1,
            name2=name2,
            title1=title1,
            title2=title2,
        )
        return False, 0.0

    # Exact match
    if norm1 == norm2:
        return True, 0.90

    # Initial pattern: "J. Smith" vs "John Smith"
    parts1 = norm1.split()
    parts2 = norm2.split()

    if len(parts1) >= 2 and len(parts2) >= 2:
        # Check if last names match
        if parts1[-1] == parts2[-1]:
            # Check if first name is initial
            first1, first2 = parts1[0], parts2[0]
            if len(first1) <= 2 and first1.rstrip(".") == first2[0]:
                return True, 0.75
            if len(first2) <= 2 and first2.rstrip(".") == first1[0]:
                return True, 0.75

    return False, 0.0


def get_manda_resolution_context() -> str:
    """
    Get M&A-specific guidance for LLM entity resolution.

    Story: E10.6 - Entity Resolution (AC: #1, #2, #3)

    Returns context that can be passed to Graphiti's LLM resolution
    phase to improve M&A-specific entity disambiguation.

    Returns:
        String with M&A resolution guidelines for LLM
    """
    return """
M&A Entity Resolution Guidelines:

MERGE as same entity:
- Company variations: "ABC Corp" = "ABC Corporation" = "ABC Inc."
- Person same role: "John Smith (CEO)" = "J. Smith" (if CEO context)
- Format variations: "FY 2024 Revenue" = "FY2024 Revenue"

KEEP SEPARATE:
- Different metrics: "Revenue" ≠ "Net Revenue" ≠ "Gross Revenue"
- Different roles: "John Smith (CEO)" ≠ "John Smith (CFO)"
- Different periods: "Q3 2024" ≠ "Q3 2023"
- Different accounting basis: "GAAP Revenue" ≠ "Adjusted Revenue"

When uncertain: Preserve separation, flag for manual review.
"""


def get_entity_resolution_history(
    entity_uuid: str,
    driver,
) -> list[dict]:
    """
    Get resolution history for an entity via IS_DUPLICATE_OF edges.

    Story: E10.6 - Entity Resolution (AC: #5)

    .. deprecated::
        This function is a stub. Use the API endpoint
        `GET /api/entities/resolution-history/{entity_uuid}` instead,
        which provides the full async implementation.

    Args:
        entity_uuid: UUID of the entity to check
        driver: Neo4j async driver instance (unused in stub)

    Returns:
        Empty list (stub implementation)

    See Also:
        :func:`src.api.routes.entities.get_resolution_history`
            The async API endpoint that provides the actual implementation.
    """
    logger.warning(
        "get_entity_resolution_history() is a stub - use API endpoint instead",
        entity_uuid=entity_uuid,
    )
    return []


__all__ = [
    # Constants
    "COMPANY_SUFFIX_VARIATIONS",
    "DISTINCT_METRICS",
    "RESOLUTION_THRESHOLDS",
    # Normalization functions
    "normalize_company_name",
    "normalize_person_name",
    # Merge decision functions
    "is_protected_metric",
    "should_merge_companies",
    "should_merge_persons",
    # LLM context
    "get_manda_resolution_context",
    # Audit
    "get_entity_resolution_history",
]
