"""
Type-safe knowledge graph tools for the Knowledge Graph agent.
Story: E13.6 - Knowledge Graph Specialist Agent (AC: #2)

This module provides tools that query Graphiti for entity resolution, relationship
traversal, and contradiction detection. Each tool uses RunContext[KGDependencies]
for type-safe dependency access.

Tools:
- traverse_relationships: Find connected entities via graph traversal
- find_contradictions: Detect conflicting facts with temporal context
- resolve_entity: Disambiguate and resolve entity references
- search_graphiti: Semantic + graph hybrid search
"""

import re
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

import structlog
from pydantic_ai import Agent, RunContext


def _escape_regex_pattern(text: str) -> str:
    """
    Escape special regex characters to prevent injection attacks.

    Args:
        text: User input to be used in a regex pattern

    Returns:
        Escaped string safe for use in regex patterns
    """
    # Escape all regex special characters
    return re.escape(text)

if TYPE_CHECKING:
    from src.agents.knowledge_graph import KGDependencies
    from src.agents.schemas.knowledge_graph import KGAnalysisResult

logger = structlog.get_logger(__name__)


# Custom exceptions for better error handling
class GraphitiQueryError(Exception):
    """Error querying the Graphiti knowledge graph."""

    pass


class EntityResolutionError(Exception):
    """Error resolving entity references."""

    pass


def register_tools(
    agent: "Agent[KGDependencies, KGAnalysisResult]",
) -> None:
    """
    Register all knowledge graph tools on the agent.

    This function is called by create_knowledge_graph_agent() to
    register tools with the @agent.tool decorator.

    Args:
        agent: The Pydantic AI agent to register tools on
    """

    @agent.tool
    async def traverse_relationships(
        ctx: "RunContext[KGDependencies]",
        start_entity: str,
        relationship_types: Optional[list[str]] = None,
        max_depth: int = 3,
    ) -> dict[str, Any]:
        """
        Find connected entities via graph traversal.

        Use this tool to discover relationships between entities in the knowledge graph.
        Traverses from a starting entity through specified relationship types up to max_depth hops.

        Args:
            start_entity: Name of the entity to start traversal from
            relationship_types: Optional list of relationship types to traverse
                              (e.g., ['WORKS_AT', 'OWNS', 'SUBSIDIARY_OF'])
                              If None, traverses all relationship types.
            max_depth: Maximum number of hops to traverse (1-5, default 3)

        Returns:
            Dictionary containing:
            - paths: List of relationship paths found
            - entities: Unique entities discovered
            - total_paths: Number of paths found
            - traversal_summary: Human-readable summary of traversal

        Example:
            result = await traverse_relationships(ctx, 'John Smith', ['WORKS_AT', 'OWNS'], max_depth=2)
            # Returns: {'paths': [...], 'entities': [...], 'total_paths': 5, ...}
        """
        logger.debug(
            "traverse_relationships_called",
            deal_id=ctx.deps.deal_id,
            start_entity=start_entity,
            relationship_types=relationship_types,
            max_depth=max_depth,
        )

        # Cap max_depth at 5 to prevent runaway queries
        max_depth = min(max(1, max_depth), 5)

        result: dict[str, Any] = {
            "paths": [],
            "entities": [],
            "total_paths": 0,
            "traversal_summary": "",
        }

        if not ctx.deps.graphiti:
            logger.warning("graphiti_not_available", deal_id=ctx.deps.deal_id)
            result["error"] = "Knowledge graph not available"
            return result

        try:
            # Build composite group_id for multi-tenant isolation (E12.9)
            # Note: Graphiti requires alphanumeric, dashes, or underscores only - no colons
            group_id = f"{ctx.deps.organization_id}_{ctx.deps.deal_id}"

            # Access Neo4j driver through Graphiti
            graphiti_instance = ctx.deps.graphiti._instance
            if not graphiti_instance or not hasattr(graphiti_instance, "driver"):
                result["error"] = "Knowledge graph service unavailable"
                return result

            driver = graphiti_instance.driver

            # Build Cypher query for path traversal
            # Using variable-length relationship pattern with optional type filtering
            if relationship_types:
                rel_filter = f"[r:{':'.join(relationship_types)}*1..{max_depth}]"
            else:
                rel_filter = f"[r*1..{max_depth}]"

            cypher = f"""
            MATCH path = (start:Entity)-{rel_filter}-(end:Entity)
            WHERE start.name =~ $start_pattern
            AND start.group_id = $group_id
            RETURN path, length(path) as hops,
                   [node in nodes(path) | node.name] as node_names,
                   [node in nodes(path) | labels(node)[0]] as node_types,
                   [rel in relationships(path) | type(rel)] as rel_types
            ORDER BY hops ASC
            LIMIT 20
            """

            # Use case-insensitive pattern matching with escaped input
            # to prevent regex/Cypher injection attacks
            safe_entity = _escape_regex_pattern(start_entity)
            start_pattern = f"(?i).*{safe_entity}.*"

            async with driver.session() as session:
                query_result = await session.run(
                    cypher,
                    start_pattern=start_pattern,
                    group_id=group_id,
                )
                records = await query_result.data()

            # Process results
            paths = []
            unique_entities = set()

            for record in records:
                node_names = record.get("node_names", [])
                node_types = record.get("node_types", [])
                rel_types = record.get("rel_types", [])
                hops = record.get("hops", 0)

                # Build path representation
                path_steps = []
                for i in range(len(rel_types)):
                    step = {
                        "from_entity": node_names[i] if i < len(node_names) else "Unknown",
                        "from_entity_type": node_types[i] if i < len(node_types) else "Unknown",
                        "relationship": rel_types[i],
                        "to_entity": node_names[i + 1] if i + 1 < len(node_names) else "Unknown",
                        "to_entity_type": node_types[i + 1] if i + 1 < len(node_types) else "Unknown",
                    }
                    path_steps.append(step)

                # Build path description string
                path_desc_parts = []
                for i, name in enumerate(node_names):
                    path_desc_parts.append(name)
                    if i < len(rel_types):
                        path_desc_parts.append(f"--[{rel_types[i]}]-->")
                path_description = " ".join(path_desc_parts)

                path_info = {
                    "start_entity": node_names[0] if node_names else start_entity,
                    "start_entity_type": node_types[0] if node_types else "Unknown",
                    "end_entity": node_names[-1] if node_names else "Unknown",
                    "end_entity_type": node_types[-1] if node_types else "Unknown",
                    "path": path_steps,
                    "total_hops": hops,
                    "path_description": path_description,
                }
                paths.append(path_info)

                # Track unique entities
                for name in node_names:
                    unique_entities.add(name)

            result["paths"] = paths
            result["entities"] = list(unique_entities)
            result["total_paths"] = len(paths)

            # Build traversal summary
            if paths:
                result["traversal_summary"] = (
                    f"Found {len(paths)} paths from '{start_entity}' "
                    f"to {len(unique_entities)} unique entities "
                    f"(max {max_depth} hops)"
                )
            else:
                result["traversal_summary"] = (
                    f"No paths found from '{start_entity}' within {max_depth} hops"
                )

        except GraphitiQueryError as e:
            logger.error(
                "traverse_relationships_graphiti_error",
                error=str(e),
                deal_id=ctx.deps.deal_id,
            )
            result["error"] = f"Knowledge graph query failed: {e}"
        except Exception as e:
            logger.error(
                "traverse_relationships_error",
                error=str(e),
                error_type=type(e).__name__,
                deal_id=ctx.deps.deal_id,
            )
            result["error"] = str(e)

        return result

    @agent.tool
    async def find_contradictions(
        ctx: "RunContext[KGDependencies]",
        entity_or_topic: str,
        time_range_start: Optional[str] = None,
        time_range_end: Optional[str] = None,
        max_results: int = 50,
    ) -> dict[str, Any]:
        """
        Detect conflicting facts with temporal context.

        Use this tool to find contradictions or inconsistencies in facts about
        an entity or topic. Compares facts across documents and time periods.

        Args:
            entity_or_topic: Entity name or topic to check for contradictions
            time_range_start: Optional ISO timestamp for start of time range
            time_range_end: Optional ISO timestamp for end of time range
            max_results: Maximum number of facts to retrieve (1-100, default 50)

        Returns:
            Dictionary containing:
            - contradictions: List of detected contradictions with severity
            - facts_analyzed: Number of facts compared
            - severity_counts: Count by severity level (critical, moderate, informational)
            - analysis_summary: Human-readable summary

        Example:
            result = await find_contradictions(ctx, 'revenue', '2024-01-01', '2024-12-31')
            # Returns: {'contradictions': [...], 'facts_analyzed': 15, ...}
        """
        # Validate and cap max_results to prevent expensive queries
        max_results = max(1, min(100, max_results))
        logger.debug(
            "find_contradictions_called",
            deal_id=ctx.deps.deal_id,
            entity_or_topic=entity_or_topic,
            time_range_start=time_range_start,
            time_range_end=time_range_end,
        )

        result: dict[str, Any] = {
            "contradictions": [],
            "facts_analyzed": 0,
            "severity_counts": {"critical": 0, "moderate": 0, "informational": 0},
            "analysis_summary": "",
        }

        if not ctx.deps.graphiti:
            result["error"] = "Knowledge graph not available"
            return result

        try:
            # Build composite group_id for multi-tenant isolation
            group_id = f"{ctx.deps.organization_id}_{ctx.deps.deal_id}"

            # Search for facts about the entity/topic
            search_results = await _search_graphiti(
                ctx.deps.graphiti,
                query=entity_or_topic,
                group_ids=[group_id],
                num_results=max_results,
            )

            if not search_results:
                result["analysis_summary"] = f"No facts found about '{entity_or_topic}'"
                return result

            # Group facts by subject/entity for comparison
            fact_groups = _group_facts_by_subject(search_results)
            result["facts_analyzed"] = len(search_results)

            # Compare facts within each group to find contradictions
            contradictions = []

            for subject, facts in fact_groups.items():
                for i, fact1 in enumerate(facts):
                    for fact2 in facts[i + 1 :]:
                        conflict = _detect_conflict(fact1, fact2)
                        if conflict:
                            contradictions.append(conflict)
                            result["severity_counts"][conflict["severity"]] += 1

            result["contradictions"] = contradictions

            # Build summary
            total_contradictions = len(contradictions)
            if total_contradictions > 0:
                critical = result["severity_counts"]["critical"]
                moderate = result["severity_counts"]["moderate"]
                informational = result["severity_counts"]["informational"]
                result["analysis_summary"] = (
                    f"Found {total_contradictions} contradictions about '{entity_or_topic}': "
                    f"{critical} critical, {moderate} moderate, {informational} informational"
                )
            else:
                result["analysis_summary"] = (
                    f"No contradictions found in {len(search_results)} facts about '{entity_or_topic}'"
                )

        except Exception as e:
            logger.error(
                "find_contradictions_error",
                error=str(e),
                deal_id=ctx.deps.deal_id,
            )
            result["error"] = str(e)

        return result

    @agent.tool
    async def resolve_entity(
        ctx: "RunContext[KGDependencies]",
        entity_name: str,
        entity_type: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Disambiguate and resolve entity references.

        Use this tool to find the canonical entity matching a given name.
        Supports fuzzy matching and returns confidence-ranked candidates.

        Args:
            entity_name: Name or alias to resolve (e.g., 'ABC Inc', 'John')
            entity_type: Optional type filter (Company, Person, FinancialMetric, Document, Location)

        Returns:
            Dictionary containing:
            - matches: List of candidate entities with confidence scores
            - best_match: Highest confidence match (if any)
            - is_ambiguous: True if multiple strong candidates exist
            - resolution_notes: Explanation of resolution strategy used

        Example:
            result = await resolve_entity(ctx, 'ABC Inc', 'Company')
            # Returns: {'matches': [...], 'best_match': {...}, 'is_ambiguous': False, ...}
        """
        logger.debug(
            "resolve_entity_called",
            deal_id=ctx.deps.deal_id,
            entity_name=entity_name,
            entity_type=entity_type,
        )

        result: dict[str, Any] = {
            "matches": [],
            "best_match": None,
            "is_ambiguous": False,
            "resolution_notes": "",
        }

        if not ctx.deps.graphiti:
            result["error"] = "Knowledge graph not available"
            return result

        try:
            # Build composite group_id for multi-tenant isolation
            group_id = f"{ctx.deps.organization_id}_{ctx.deps.deal_id}"

            # Search for entities matching the name
            search_query = f"entity {entity_name}"
            if entity_type:
                search_query = f"{entity_type} {entity_name}"

            search_results = await _search_graphiti(
                ctx.deps.graphiti,
                query=search_query,
                group_ids=[group_id],
                num_results=20,
            )

            if not search_results:
                result["resolution_notes"] = f"No entities found matching '{entity_name}'"
                return result

            # Score and rank matches
            matches = []
            for sr in search_results:
                match_name = getattr(sr, "name", None) or _extract_entity_name(sr)
                match_type = _extract_entity_type(sr)

                # Skip if type filter doesn't match
                if entity_type and match_type.lower() != entity_type.lower():
                    continue

                # Calculate confidence based on name similarity
                confidence = _calculate_name_similarity(entity_name, match_name)

                # Boost confidence for exact matches
                if match_name.lower() == entity_name.lower():
                    confidence = min(1.0, confidence + 0.3)

                # Extract aliases if available
                aliases = getattr(sr, "aliases", []) or []

                match_info = {
                    "name": match_name,
                    "entity_type": match_type,
                    "confidence": round(confidence, 2),
                    "aliases": aliases,
                    "source": {
                        "fact_id": getattr(sr, "uuid", None),
                        "content": getattr(sr, "fact", None) or getattr(sr, "content", None),
                    },
                    "properties": _extract_entity_properties(sr),
                }
                matches.append(match_info)

            # Sort by confidence
            matches.sort(key=lambda x: x["confidence"], reverse=True)

            # Take top 5 matches
            result["matches"] = matches[:5]

            # Determine best match and ambiguity
            if matches:
                result["best_match"] = matches[0]

                # Check for ambiguity (multiple high-confidence matches)
                high_confidence_count = sum(1 for m in matches if m["confidence"] >= 0.7)
                if high_confidence_count > 1:
                    result["is_ambiguous"] = True
                    result["resolution_notes"] = (
                        f"Multiple strong matches found for '{entity_name}'. "
                        f"Top candidates: {', '.join(m['name'] for m in matches[:3])}"
                    )
                else:
                    result["resolution_notes"] = (
                        f"Resolved '{entity_name}' to '{matches[0]['name']}' "
                        f"with {matches[0]['confidence']:.0%} confidence"
                    )
            else:
                result["resolution_notes"] = f"No entities found matching '{entity_name}'"

        except Exception as e:
            logger.error(
                "resolve_entity_error",
                error=str(e),
                deal_id=ctx.deps.deal_id,
            )
            result["error"] = str(e)

        return result

    @agent.tool
    async def search_graphiti(
        ctx: "RunContext[KGDependencies]",
        query: str,
        entity_types: Optional[list[str]] = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """
        Semantic + graph hybrid search in the knowledge graph.

        Use this tool to search for facts, entities, and relationships using
        natural language queries. Combines vector similarity, BM25 text matching,
        and graph context for best results.

        Args:
            query: Natural language search query
            entity_types: Optional list of entity types to filter results
                         (Company, Person, FinancialMetric, Document, Location)
            limit: Maximum number of results to return (1-50, default 20)

        Returns:
            Dictionary containing:
            - results: List of search results with relevance scores
            - total_results: Number of results found
            - entity_summary: Count of results by entity type
            - search_notes: Information about search strategy used

        Example:
            result = await search_graphiti(ctx, 'CEO compensation', ['Person', 'Company'], limit=10)
            # Returns: {'results': [...], 'total_results': 10, ...}
        """
        logger.debug(
            "search_graphiti_called",
            deal_id=ctx.deps.deal_id,
            query=query,
            entity_types=entity_types,
            limit=limit,
        )

        # Cap limit at 50
        limit = min(max(1, limit), 50)

        result: dict[str, Any] = {
            "results": [],
            "total_results": 0,
            "entity_summary": {},
            "search_notes": "",
        }

        if not ctx.deps.graphiti:
            result["error"] = "Knowledge graph not available"
            return result

        try:
            # Build composite group_id for multi-tenant isolation
            group_id = f"{ctx.deps.organization_id}_{ctx.deps.deal_id}"

            # Execute search
            search_results = await _search_graphiti(
                ctx.deps.graphiti,
                query=query,
                group_ids=[group_id],
                num_results=limit,
            )

            if not search_results:
                result["search_notes"] = f"No results found for query: '{query}'"
                return result

            # Process results
            processed_results = []
            entity_type_counts: dict[str, int] = {}

            for sr in search_results:
                # Extract entity type
                entity_type = _extract_entity_type(sr)

                # Apply entity type filter if specified
                if entity_types and entity_type.lower() not in [t.lower() for t in entity_types]:
                    continue

                # Count by entity type
                entity_type_counts[entity_type] = entity_type_counts.get(entity_type, 0) + 1

                # Extract result data
                result_info = {
                    "fact_id": getattr(sr, "uuid", None),
                    "content": getattr(sr, "fact", None) or getattr(sr, "content", None),
                    "entity_name": _extract_entity_name(sr),
                    "entity_type": entity_type,
                    "valid_at": str(getattr(sr, "valid_at", None)) if getattr(sr, "valid_at", None) else None,
                    "invalid_at": str(getattr(sr, "invalid_at", None)) if getattr(sr, "invalid_at", None) else None,
                    "source_description": getattr(sr, "source_description", None),
                }
                processed_results.append(result_info)

            result["results"] = processed_results
            result["total_results"] = len(processed_results)
            result["entity_summary"] = entity_type_counts

            # Build search notes
            type_summary = ", ".join(f"{count} {typ}" for typ, count in entity_type_counts.items())
            result["search_notes"] = (
                f"Found {len(processed_results)} results for '{query}': {type_summary}"
            )

        except Exception as e:
            logger.error(
                "search_graphiti_error",
                error=str(e),
                deal_id=ctx.deps.deal_id,
            )
            result["error"] = str(e)

        return result


# =============================================================================
# Helper Functions
# =============================================================================


async def _search_graphiti(
    graphiti: Any,
    query: str,
    group_ids: list[str],
    num_results: int = 20,
) -> list[Any]:
    """
    Execute a search query against the Graphiti knowledge graph.

    This helper abstracts the Graphiti client interface to avoid direct
    access to private attributes and provide consistent error handling.

    Args:
        graphiti: The GraphitiClient instance (or None)
        query: Search query string
        group_ids: List of group IDs for multi-tenant isolation
        num_results: Maximum number of results to return

    Returns:
        List of search results from Graphiti

    Raises:
        GraphitiQueryError: If the search fails
    """
    if graphiti is None:
        return []

    try:
        # Access the underlying instance for search
        # GraphitiClient wraps the Graphiti instance
        if hasattr(graphiti, "_instance") and graphiti._instance is not None:
            return await graphiti._instance.search(
                query=query,
                group_ids=group_ids,
                num_results=num_results,
            )
        elif hasattr(graphiti, "search"):
            # Use public method if available (from search classmethod)
            # This won't work since search requires deal_id/org_id separately
            # Fall back to _instance access
            return []
        else:
            raise GraphitiQueryError("GraphitiClient has no search method available")
    except GraphitiQueryError:
        raise
    except Exception as e:
        raise GraphitiQueryError(f"Search failed: {e}") from e


def _group_facts_by_subject(search_results: list[Any]) -> dict[str, list[Any]]:
    """
    Group search results by their subject/entity.

    Args:
        search_results: List of Graphiti search results

    Returns:
        Dictionary mapping subject names to lists of facts
    """
    groups: dict[str, list[Any]] = {}

    for sr in search_results:
        # Try to extract subject from various attributes
        subject = (
            getattr(sr, "subject", None)
            or getattr(sr, "name", None)
            or _extract_entity_name(sr)
        )

        if subject:
            if subject not in groups:
                groups[subject] = []
            groups[subject].append(sr)

    return groups


def _detect_conflict(fact1: Any, fact2: Any) -> Optional[dict[str, Any]]:
    """
    Detect if two facts conflict with each other.

    Args:
        fact1: First fact to compare
        fact2: Second fact to compare

    Returns:
        Contradiction info dict if conflict detected, None otherwise
    """
    content1 = getattr(fact1, "fact", None) or getattr(fact1, "content", "")
    content2 = getattr(fact2, "fact", None) or getattr(fact2, "content", "")

    if not content1 or not content2:
        return None

    # Extract numeric values for comparison
    import re

    num_pattern = r"[\$]?([\d,]+\.?\d*)\s*(million|billion|M|B|k|K|%)?(?:\s|$)"

    nums1 = re.findall(num_pattern, str(content1))
    nums2 = re.findall(num_pattern, str(content2))

    # If both have numeric values, compare them
    if nums1 and nums2:
        try:
            # Parse first number from each
            val1 = _parse_numeric_value(nums1[0])
            val2 = _parse_numeric_value(nums2[0])

            if val1 is not None and val2 is not None and val1 != 0:
                diff_percent = abs(val1 - val2) / abs(val1) * 100

                # Determine severity
                if diff_percent > 10:
                    severity = "critical"
                elif diff_percent > 2:
                    severity = "moderate"
                else:
                    # Check if one is newer (superseded)
                    valid1 = getattr(fact1, "valid_at", None)
                    valid2 = getattr(fact2, "valid_at", None)
                    if valid1 and valid2 and valid1 != valid2:
                        severity = "informational"
                    else:
                        return None  # Values are close enough

                return {
                    "fact1": str(content1)[:200],
                    "fact1_source": {
                        "document_id": getattr(fact1, "uuid", None),
                        "document_name": getattr(fact1, "source_description", None),
                    },
                    "fact1_valid_at": str(getattr(fact1, "valid_at", None)),
                    "fact2": str(content2)[:200],
                    "fact2_source": {
                        "document_id": getattr(fact2, "uuid", None),
                        "document_name": getattr(fact2, "source_description", None),
                    },
                    "fact2_valid_at": str(getattr(fact2, "valid_at", None)),
                    "conflict_type": "value_mismatch",
                    "severity": severity,
                    "resolution_hint": f"Values differ by {diff_percent:.1f}%. Check source documents for context.",
                    "affected_entity": getattr(fact1, "subject", None) or getattr(fact1, "name", None),
                }

        except (ValueError, TypeError, ZeroDivisionError):
            pass

    return None


def _parse_numeric_value(match_tuple: tuple) -> Optional[float]:
    """
    Parse a numeric value from regex match tuple.

    Args:
        match_tuple: Tuple of (number_str, multiplier_str)

    Returns:
        Parsed float value or None
    """
    try:
        value_str, multiplier = match_tuple
        value = float(value_str.replace(",", ""))

        if multiplier:
            multiplier = multiplier.lower()
            if multiplier in ("million", "m"):
                value *= 1_000_000
            elif multiplier in ("billion", "b"):
                value *= 1_000_000_000
            elif multiplier in ("k",):
                value *= 1_000

        return value
    except (ValueError, TypeError):
        return None


def _extract_entity_name(result: Any) -> str:
    """
    Extract entity name from a search result.

    Args:
        result: A Graphiti search result object

    Returns:
        Entity name string or "Unknown"
    """
    # Try various attributes
    name = (
        getattr(result, "name", None)
        or getattr(result, "entity_name", None)
        or getattr(result, "subject", None)
    )

    if name:
        return str(name)

    # Try to extract from content
    content = getattr(result, "fact", None) or getattr(result, "content", "")
    if content:
        # Take first few words as entity reference
        words = str(content).split()[:3]
        return " ".join(words)

    return "Unknown"


def _extract_entity_type(result: Any) -> str:
    """
    Extract entity type from a search result.

    Args:
        result: A Graphiti search result object

    Returns:
        Entity type string or "Unknown"
    """
    # Try various attributes
    entity_type = (
        getattr(result, "entity_type", None)
        or getattr(result, "type", None)
        or getattr(result, "label", None)
    )

    if entity_type:
        return str(entity_type)

    # Try to infer from content
    content = str(getattr(result, "fact", None) or getattr(result, "content", "")).lower()

    # Keyword-based type inference - check financial first (more specific keywords)
    # Order matters: financial metrics should be detected before company types
    if any(kw in content for kw in ["revenue", "ebitda", "margin", "profit", "cost"]):
        return "FinancialMetric"
    elif any(kw in content for kw in ["ceo", "cfo", "president", "director", "employee"]):
        return "Person"
    elif any(kw in content for kw in ["company", "corporation", " inc.", " inc ", "llc", "ltd"]):
        return "Company"
    elif any(kw in content for kw in ["document", "report", "file", "pdf"]):
        return "Document"

    return "Unknown"


def _extract_entity_properties(result: Any) -> dict[str, str]:
    """
    Extract additional properties from a search result.

    Args:
        result: A Graphiti search result object

    Returns:
        Dictionary of property name to value
    """
    properties: dict[str, str] = {}

    # Try to get properties dict
    props = getattr(result, "properties", None)
    if isinstance(props, dict):
        for k, v in props.items():
            if v is not None:
                properties[str(k)] = str(v)

    # Add temporal info if available
    valid_at = getattr(result, "valid_at", None)
    if valid_at:
        properties["valid_at"] = str(valid_at)

    invalid_at = getattr(result, "invalid_at", None)
    if invalid_at:
        properties["invalid_at"] = str(invalid_at)

    return properties


def _calculate_name_similarity(name1: str, name2: str) -> float:
    """
    Calculate similarity score between two names.

    Uses a combination of exact match, prefix match, and Levenshtein-like distance.

    Args:
        name1: First name to compare
        name2: Second name to compare

    Returns:
        Similarity score from 0.0 to 1.0
    """
    n1 = name1.lower().strip()
    n2 = name2.lower().strip()

    # Exact match
    if n1 == n2:
        return 1.0

    # One contains the other
    if n1 in n2 or n2 in n1:
        return 0.85

    # Prefix match
    min_len = min(len(n1), len(n2))
    prefix_len = 0
    for i in range(min_len):
        if n1[i] == n2[i]:
            prefix_len += 1
        else:
            break

    if prefix_len > 0:
        prefix_score = prefix_len / max(len(n1), len(n2))
        if prefix_score > 0.5:
            return 0.6 + (prefix_score * 0.2)

    # Word overlap
    words1 = set(n1.split())
    words2 = set(n2.split())
    if words1 and words2:
        overlap = len(words1 & words2)
        total = len(words1 | words2)
        if overlap > 0:
            return 0.4 + (overlap / total * 0.4)

    # Simple character overlap as fallback
    chars1 = set(n1)
    chars2 = set(n2)
    char_overlap = len(chars1 & chars2) / len(chars1 | chars2)

    return max(0.2, char_overlap * 0.5)


__all__ = ["register_tools"]
