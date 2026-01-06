"""
Knowledge Graph Specialist Agent using Pydantic AI.
Story: E13.6 - Knowledge Graph Specialist Agent (AC: #1, #2, #3)

This module provides:
- KGDependencies: Type-safe dependency container for knowledge graph tools
- create_knowledge_graph_agent: Factory function with FallbackModel support
- get_knowledge_graph_agent: Singleton accessor for the default agent
- KNOWLEDGE_GRAPH_SYSTEM_PROMPT: Entity resolution and graph traversal expertise

Key capabilities:
- Entity resolution across documents (companies, people, metrics)
- Temporal fact tracking with valid_at/invalid_at windows
- Contradiction detection and severity assessment
- Relationship path analysis (who works where, ownership chains, subsidiaries)
- Data lineage and provenance tracking
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

import structlog
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import Model
from pydantic_ai.models.fallback import FallbackModel

from src.agents.schemas.knowledge_graph import KGAnalysisResult
from src.config import get_agent_model_config, get_model_costs
from src.storage.supabase_client import SupabaseClient

# Type-only import to avoid circular dependency
# GraphitiClient is an async singleton accessed via GraphitiClient.get_instance()
if TYPE_CHECKING:
    from src.graphiti.client import GraphitiClient

logger = structlog.get_logger(__name__)


# =============================================================================
# System Prompt
# =============================================================================

KNOWLEDGE_GRAPH_SYSTEM_PROMPT = """You are a knowledge graph specialist for M&A intelligence.

**Core Expertise:**
- Entity resolution across documents (companies, people, metrics)
- Temporal fact tracking with valid_at/invalid_at windows
- Contradiction detection and severity assessment
- Relationship path analysis (who works where, ownership chains, subsidiaries)
- Data lineage and provenance tracking

**Analysis Standards:**
1. Always explain the graph traversal path in your responses
2. Cite entity sources with document references
3. Flag temporal context: when facts were valid, if superseded
4. Assess confidence based on source recency and reliability
5. Highlight contradictions with severity levels

**Output Format:**
- Lead with the direct answer to the query
- Show relationship paths: EntityA --[RELATIONSHIP]--> EntityB
- Include temporal context for facts
- List all matched entities with confidence scores
- Cite sources: [Document Name, Entity Type, Valid From/To]

**Contradiction Handling:**
- critical: Values differ >10% or directly conflicting statements
- moderate: Minor differences, likely rounding or timing
- informational: Data superseded by newer source (expected)

**Entity Resolution Strategy:**
1. Exact match first (case-insensitive)
2. Alias lookup (known variations)
3. Fuzzy match (Levenshtein distance)
4. Semantic similarity (embedding cosine)
5. Return top candidates if ambiguous

Deal Context: {deal_id}
Organization: {organization_id}
Entity Types Filter: {entity_types}
Time Range: {time_range}
Additional Context: {context}
"""


# =============================================================================
# Dependencies
# =============================================================================


@dataclass
class KGDependencies:
    """
    Type-safe dependencies for knowledge graph analysis tools.

    This dataclass provides typed access to all dependencies needed by tools.
    IDE autocomplete works for all fields when accessed via ctx.deps.

    Usage in tools:
        @knowledge_graph_agent.tool
        async def my_tool(ctx: RunContext[KGDependencies], ...):
            # IDE autocomplete works here
            if ctx.deps.graphiti:
                results = await _search_graphiti(ctx.deps.graphiti, ...)
            # Access DB for supplementary data
            await ctx.deps.db.get_findings_by_document(...)

    Attributes:
        db: Supabase client for database operations
        graphiti: Graphiti client for knowledge graph queries (may be None)
        deal_id: Current deal UUID
        organization_id: Organization UUID for multi-tenant isolation (E12.9)
        entity_types_filter: Optional list of entity types to focus on
        time_range: Optional temporal filter (start, end) for fact queries
        context_window: Additional context from supervisor (optional)
    """

    db: SupabaseClient
    graphiti: Optional["GraphitiClient"]  # May be None if Neo4j not configured
    deal_id: str
    organization_id: str
    entity_types_filter: list[str] = field(default_factory=list)
    time_range: Optional[tuple[datetime, datetime]] = None
    context_window: str = ""  # Optional query context from supervisor


# =============================================================================
# Model Creation
# =============================================================================


def _create_model(model_str: str) -> Model:
    """
    Create a Model instance from provider:model string.

    Args:
        model_str: Model string in format 'provider:model-name'
                   e.g., 'google-gla:gemini-2.5-pro', 'anthropic:claude-sonnet-4-0'

    Returns:
        Pydantic AI Model instance (uses library-managed HTTP clients for proper lifecycle)

    Raises:
        ValueError: If provider is unknown

    Note:
        HTTP client lifecycle is managed by Pydantic AI internally.
        Timeout configuration should be done via model_settings on the Agent.
    """
    provider, model_name = model_str.split(":", 1)

    # Let Pydantic AI manage HTTP client lifecycle internally
    # This avoids resource leaks from unclosed httpx.AsyncClient instances
    if provider == "google-gla":
        from pydantic_ai.models.google import GoogleModel

        return GoogleModel(model_name)
    elif provider == "google-vertex":
        from pydantic_ai.models.vertexai import VertexAIModel

        return VertexAIModel(model_name)
    elif provider == "anthropic":
        from pydantic_ai.models.anthropic import AnthropicModel

        return AnthropicModel(model_name)
    elif provider == "openai":
        from pydantic_ai.models.openai import OpenAIModel

        return OpenAIModel(model_name)
    else:
        raise ValueError(f"Unknown provider: {provider}")


# =============================================================================
# Agent Factory
# =============================================================================


def create_knowledge_graph_agent(
    model: Optional[str] = None,
) -> Agent[KGDependencies, KGAnalysisResult]:
    """
    Factory function to create a Knowledge Graph agent with configured model and fallback.

    Story: E13.6 - Knowledge Graph Specialist Agent (AC: #1)
    Story: E11.6 - Model Configuration and Switching (FallbackModel pattern)

    Args:
        model: Model string in format 'provider:model-name'.
               Examples: 'google-gla:gemini-2.5-pro', 'anthropic:claude-sonnet-4-0'
               If None, uses config from models.yaml under 'knowledge_graph' key.

    Returns:
        Configured Pydantic AI Agent with typed dependencies, result, and FallbackModel.

    Example:
        # Use default model from config with fallback
        agent = create_knowledge_graph_agent()

        # Override with specific model (bypasses config)
        agent = create_knowledge_graph_agent(model='google-gla:gemini-2.5-pro')

        # Run with dependencies
        deps = KGDependencies(
            db=db_client,
            graphiti=graphiti_client,
            deal_id="deal-123",
            organization_id="org-456",
        )
        result = await agent.run("Who is the CEO of Acme Corp?", deps=deps)
        analysis = result.data  # KGAnalysisResult - type guaranteed
    """
    # Get model config from YAML with env var override
    config = get_agent_model_config("knowledge_graph")

    # Extract settings (temperature, max_tokens, timeout) from config
    settings = config.get("settings", {})
    model_settings = {
        "temperature": settings.get("temperature", 0.3),  # Lower for precision
        "max_tokens": settings.get("max_tokens", 4000),  # Longer for complex traversals
        "timeout": settings.get("timeout", 45),  # Graph queries can take time
    }
    # Filter out None values
    model_settings = {k: v for k, v in model_settings.items() if v is not None}

    # Allow explicit model override (bypasses config entirely)
    if model is not None:
        primary_model_str = model
        fallback_model_str = None
    else:
        primary_model_str = config.get("primary", "google-gla:gemini-2.5-pro")
        fallback_model_str = config.get("fallback", "anthropic:claude-sonnet-4-0")

    # Create model instances
    primary = _create_model(primary_model_str)

    # Build model with optional fallback chain
    if fallback_model_str:
        try:
            from pydantic_ai.exceptions import ModelHTTPError

            fallback = _create_model(fallback_model_str)

            def on_fallback(exc: Exception) -> None:
                logger.warning(
                    "knowledge_graph_fallback_triggered",
                    primary_model=primary_model_str,
                    fallback_model=fallback_model_str,
                    primary_error=str(exc),
                    error_type=type(exc).__name__,
                )

            configured_model: Model = FallbackModel(
                primary,
                fallback,
                fallback_on=(ModelHTTPError,),
                on_fallback=on_fallback,
            )
            logger.info(
                "knowledge_graph_agent_created",
                primary=primary_model_str,
                fallback=fallback_model_str,
            )
        except (ImportError, TypeError) as init_err:
            fallback = _create_model(fallback_model_str)
            configured_model = FallbackModel(primary, fallback)
            logger.info(
                "knowledge_graph_agent_created",
                primary=primary_model_str,
                fallback=fallback_model_str,
                note="fallback_on_any_exception",
                init_warning=str(init_err) if isinstance(init_err, TypeError) else None,
            )
    else:
        configured_model = primary
        logger.info(
            "knowledge_graph_agent_created",
            primary=primary_model_str,
            fallback=None,
        )

    # Build agent kwargs
    agent_kwargs: dict[str, Any] = {
        "deps_type": KGDependencies,
        "result_type": KGAnalysisResult,
    }

    # Apply model settings from config
    if model_settings:
        agent_kwargs["model_settings"] = model_settings
        logger.debug(
            "knowledge_graph_settings_applied",
            settings=model_settings,
        )

    agent: Agent[KGDependencies, KGAnalysisResult] = Agent(
        configured_model,
        **agent_kwargs,
    )

    # Register system prompt
    @agent.system_prompt
    async def kg_system_prompt(ctx: RunContext[KGDependencies]) -> str:
        """Dynamic system prompt with context from dependencies."""
        # Format time range if present
        time_range_str = "None"
        if ctx.deps.time_range:
            start, end = ctx.deps.time_range
            time_range_str = f"{start.isoformat()} to {end.isoformat()}"

        # Format entity types filter if present
        entity_types_str = ", ".join(ctx.deps.entity_types_filter) if ctx.deps.entity_types_filter else "All types"

        return KNOWLEDGE_GRAPH_SYSTEM_PROMPT.format(
            deal_id=ctx.deps.deal_id,
            organization_id=ctx.deps.organization_id,
            entity_types=entity_types_str,
            time_range=time_range_str,
            context=ctx.deps.context_window or "None provided",
        )

    # Register knowledge graph tools
    _register_kg_tools(agent)

    return agent


def _register_kg_tools(
    agent: Agent[KGDependencies, KGAnalysisResult],
) -> None:
    """
    Register type-safe knowledge graph tools on the agent.

    Tools are defined here to have access to the agent instance for decoration.
    Each tool receives RunContext[KGDependencies] for typed dependency access.

    Story: E13.6 - Knowledge Graph Specialist Agent (AC: #2)
    """
    # Import tools module to register them
    # Tools are registered in kg_tools.py using the agent passed to them
    from src.agents.tools import kg_tools

    kg_tools.register_tools(agent)


# =============================================================================
# Singleton Accessor
# =============================================================================

_default_agent: Optional[Agent[KGDependencies, KGAnalysisResult]] = None


def get_knowledge_graph_agent() -> Agent[KGDependencies, KGAnalysisResult]:
    """
    Get or create the default Knowledge Graph agent.

    Uses config from models.yaml with FallbackModel support.
    For custom models, use create_knowledge_graph_agent() directly.

    Returns:
        Configured Pydantic AI Agent with fallback chain
    """
    global _default_agent
    if _default_agent is None:
        _default_agent = create_knowledge_graph_agent()
    return _default_agent


# =============================================================================
# Usage Logging
# =============================================================================


async def log_kg_usage(
    result: Any,
    model_str: str,
    db: Optional[SupabaseClient] = None,
    organization_id: Optional[str] = None,
    deal_id: Optional[str] = None,
    latency_ms: Optional[int] = None,
) -> dict[str, Any]:
    """
    Log token usage and cost after Knowledge Graph agent run.

    Args:
        result: The result from agent.run() - must have .usage() method
        model_str: Model string like 'google-gla:gemini-2.5-pro'
        db: Optional Supabase client for database persistence
        organization_id: Organization context for multi-tenant isolation
        deal_id: Deal context for the LLM call
        latency_ms: Optional latency in milliseconds

    Returns:
        Dictionary with usage data for further processing, including:
        - provider, model, feature: identification fields
        - input_tokens, output_tokens, cost_usd: usage metrics
        - latency_ms: optional latency
        - logged_to_db: bool indicating if database persistence succeeded
        - db_error: error message if database logging failed (only present on failure)
    """
    from uuid import UUID

    usage = result.usage()
    provider, model = model_str.split(":", 1)

    # Get cost rates from config
    rates = get_model_costs(model_str)

    # Calculate cost (rates are per 1M tokens)
    input_tokens = usage.request_tokens or 0
    output_tokens = usage.response_tokens or 0
    cost_usd = (
        input_tokens * rates.get("input", 0) / 1_000_000
        + output_tokens * rates.get("output", 0) / 1_000_000
    )

    usage_data: dict[str, Any] = {
        "provider": provider,
        "model": model,
        "feature": "knowledge_graph",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost_usd, 6),
        "logged_to_db": False,  # Default to false, set true on success
    }

    if latency_ms is not None:
        usage_data["latency_ms"] = latency_ms

    # Log to structlog
    logger.info("knowledge_graph_usage", **usage_data)

    # Persist to database if client provided
    if db is not None:
        try:
            from src.observability.usage import log_llm_usage_to_db

            await log_llm_usage_to_db(
                db,
                organization_id=UUID(organization_id) if organization_id else None,
                deal_id=UUID(deal_id) if deal_id else None,
                user_id=None,
                provider=provider,
                model=model,
                feature="knowledge_graph",
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
            )
            usage_data["logged_to_db"] = True
        except Exception as e:
            logger.warning("failed_to_log_usage_to_db", error=str(e))
            usage_data["db_error"] = str(e)

    return usage_data


__all__ = [
    "KGDependencies",
    "create_knowledge_graph_agent",
    "get_knowledge_graph_agent",
    "log_kg_usage",
    "KNOWLEDGE_GRAPH_SYSTEM_PROMPT",
]
