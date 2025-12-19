"""
Pydantic AI agent for type-safe document analysis.
Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI (AC: #2, #3, #4, #5)
Story: E11.6 - Model Configuration and Switching (AC: #3, #4)

This module provides:
- AnalysisDependencies: Type-safe dependency container for tools
- analysis_agent: Pydantic AI agent with typed dependencies and structured output
- create_analysis_agent: Factory function for model configuration with FallbackModel
- log_usage: Cost tracking function for token usage logging
- Type-safe tools with RunContext[AnalysisDependencies]

Key benefits:
- IDE autocomplete for ctx.deps.db, ctx.deps.graphiti, etc.
- Type-checked dependency injection
- Structured output via Pydantic models
- Model switching via string syntax: 'google-gla:gemini-2.5-flash', 'anthropic:claude-sonnet-4-0'
- Automatic fallback on HTTP errors, rate limits, and timeouts (E11.6)
- Per-provider cost tracking with structlog (E11.6)
"""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID

import httpx
import structlog
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import Model
from pydantic_ai.models.fallback import FallbackModel

from src.config import get_agent_model_config, get_model_costs, get_settings
from src.llm.schemas import FindingResult
from src.storage.supabase_client import SupabaseClient

# Type-only import to avoid circular dependency
# GraphitiClient is an async singleton accessed via GraphitiClient.get_instance()
if TYPE_CHECKING:
    from src.graphiti.client import GraphitiClient

logger = structlog.get_logger(__name__)


@dataclass
class AnalysisDependencies:
    """
    Type-safe dependencies for extraction tools.

    This dataclass provides typed access to all dependencies needed by tools.
    IDE autocomplete works for all fields when accessed via ctx.deps.

    Usage in tools:
        @analysis_agent.tool
        async def my_tool(ctx: RunContext[AnalysisDependencies], ...):
            # IDE autocomplete works here
            await ctx.deps.db.get_findings_by_document(...)
            if ctx.deps.graphiti:
                await ctx.deps.graphiti.search(ctx.deps.deal_id, ...)
    """

    db: SupabaseClient
    graphiti: Optional["GraphitiClient"]  # May be None if Neo4j not configured
    deal_id: str
    document_id: str
    document_name: str = ""


def _create_model(model_str: str, timeout: int = 30) -> Model:
    """
    Create a Model instance from provider:model string.

    Story: E11.6 - Model Configuration and Switching (AC: #3)

    Args:
        model_str: Model string in format 'provider:model-name'
                   e.g., 'google-gla:gemini-2.5-flash', 'anthropic:claude-sonnet-4-0'
        timeout: HTTP timeout in seconds for immediate fallback (default: 30)

    Returns:
        Pydantic AI Model instance with configured timeout

    Raises:
        ValueError: If provider is unknown
    """
    provider, model_name = model_str.split(":", 1)

    # Create httpx client with timeout for immediate fallback behavior
    # This ensures we don't wait too long before triggering fallback
    http_client = httpx.AsyncClient(timeout=timeout)

    if provider == "google-gla":
        from pydantic_ai.models.google import GoogleModel

        return GoogleModel(model_name, http_client=http_client)
    elif provider == "google-vertex":
        from pydantic_ai.models.vertexai import VertexAIModel

        return VertexAIModel(model_name, http_client=http_client)
    elif provider == "anthropic":
        from pydantic_ai.models.anthropic import AnthropicModel

        return AnthropicModel(model_name, http_client=http_client)
    elif provider == "openai":
        from pydantic_ai.models.openai import OpenAIModel

        return OpenAIModel(model_name, http_client=http_client)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def create_analysis_agent(
    agent_type: str = "extraction",
    model: Optional[str] = None,
    result_type: type = list[FindingResult],
) -> Agent[AnalysisDependencies, list[FindingResult]]:
    """
    Factory function to create an analysis agent with configured model and fallback.

    Story: E11.6 - Model Configuration and Switching (AC: #3)

    Args:
        agent_type: 'extraction' or 'analysis' - determines model config from YAML.
        model: Model string in format 'provider:model-name'.
               Examples: 'google-gla:gemini-2.5-flash', 'anthropic:claude-sonnet-4-0'
               If None, uses config from models.yaml or env var override.
        result_type: The Pydantic model type for structured output.
                     Defaults to list[FindingResult].

    Returns:
        Configured Pydantic AI Agent with typed dependencies, result, and FallbackModel.

    Example:
        # Use default model from config with fallback
        agent = create_analysis_agent()

        # Use specific agent type (extraction, analysis)
        agent = create_analysis_agent(agent_type='analysis')

        # Override with specific model (bypasses config)
        agent = create_analysis_agent(model='anthropic:claude-sonnet-4-0')

        # Run with dependencies
        deps = AnalysisDependencies(db=..., graphiti=..., deal_id=..., document_id=...)
        result = await agent.run("Extract findings from...", deps=deps)
        findings = result.data  # list[FindingResult] - type guaranteed
    """
    # Get model config from YAML with env var override
    config = get_agent_model_config(agent_type)

    # Extract settings (temperature, max_tokens) from config
    settings = config.get("settings", {})
    model_settings = {
        "temperature": settings.get("temperature"),
        "max_tokens": settings.get("max_tokens"),
    }
    # Filter out None values
    model_settings = {k: v for k, v in model_settings.items() if v is not None}

    # Allow explicit model override (bypasses config entirely)
    if model is not None:
        primary_model_str = model
        fallback_model_str = None
    else:
        primary_model_str = config.get("primary", "google-gla:gemini-2.5-flash")
        fallback_model_str = config.get("fallback")

    # Create model instances
    primary = _create_model(primary_model_str)

    # Build model with optional fallback chain
    if fallback_model_str:
        try:
            # Import ModelHTTPError for fallback triggers
            from pydantic_ai.exceptions import ModelHTTPError

            fallback = _create_model(fallback_model_str)

            # Create custom fallback handler that logs when fallback is triggered
            def on_fallback(exc: Exception) -> None:
                logger.warning(
                    "fallback_triggered",
                    primary_model=primary_model_str,
                    fallback_model=fallback_model_str,
                    primary_error=str(exc),
                    error_type=type(exc).__name__,
                )

            # FallbackModel triggers on HTTP errors (4xx, 5xx, rate limits, timeouts)
            configured_model: Model = FallbackModel(
                primary,
                fallback,
                fallback_on=(ModelHTTPError,),
                on_fallback=on_fallback,
            )
            logger.info(
                "agent_created",
                agent_type=agent_type,
                primary=primary_model_str,
                fallback=fallback_model_str,
            )
        except (ImportError, TypeError) as init_err:
            # If ModelHTTPError not available or on_fallback not supported,
            # use simple fallback (any exception)
            fallback = _create_model(fallback_model_str)
            configured_model = FallbackModel(primary, fallback)
            logger.info(
                "agent_created",
                agent_type=agent_type,
                primary=primary_model_str,
                fallback=fallback_model_str,
                note="fallback_on_any_exception",
                init_warning=str(init_err) if isinstance(init_err, TypeError) else None,
            )
    else:
        configured_model = primary
        logger.info(
            "agent_created",
            agent_type=agent_type,
            primary=primary_model_str,
            fallback=None,
        )

    # Build agent kwargs with optional model settings
    agent_kwargs: dict[str, Any] = {
        "deps_type": AnalysisDependencies,
        "result_type": result_type,
    }

    # Apply model settings from config (temperature, max_tokens)
    if model_settings:
        agent_kwargs["model_settings"] = model_settings
        logger.debug(
            "agent_settings_applied",
            agent_type=agent_type,
            settings=model_settings,
        )

    agent: Agent[AnalysisDependencies, list[FindingResult]] = Agent(
        configured_model,
        **agent_kwargs,
    )

    # Register system prompt
    @agent.system_prompt
    async def analysis_system_prompt(ctx: RunContext[AnalysisDependencies]) -> str:
        """Dynamic system prompt with context from dependencies."""
        return f"""You are an M&A analyst extracting findings from document: {ctx.deps.document_name}

Extract structured findings with:
- content: the actual finding text
- finding_type: one of [fact, metric, risk, opportunity, assumption]
- confidence: 0.0-1.0 based on source clarity
- source_reference: include page_number if available

Be precise and avoid speculation. Focus on extracting factual information, financial metrics,
identified risks, opportunities for value creation, and explicit assumptions made in the document."""

    # Register tools on this agent instance
    _register_tools(agent)

    return agent


def _register_tools(agent: Agent[AnalysisDependencies, list[FindingResult]]) -> None:
    """
    Register type-safe tools on the agent.

    Tools are defined here to have access to the agent instance for decoration.
    Each tool receives RunContext[AnalysisDependencies] for typed dependency access.
    """

    @agent.tool
    async def classify_chunk(
        ctx: RunContext[AnalysisDependencies],
        chunk_content: str,
        chunk_type: str,
    ) -> str:
        """
        Classify a document chunk for extraction priority.

        Use this tool to determine the content type of a chunk before extraction.
        This helps prioritize financial and operational content for deeper analysis.

        Args:
            chunk_content: The text content of the chunk to classify
            chunk_type: The structural type of chunk (text, table, header, etc.)

        Returns:
            Classification result: 'financial', 'operational', 'legal', or 'other'
        """
        # IDE autocomplete works: ctx.deps.db, ctx.deps.graphiti, ctx.deps.deal_id
        logger.debug(
            "Classifying chunk",
            document_id=ctx.deps.document_id,
            chunk_type=chunk_type,
            content_preview=chunk_content[:100] if chunk_content else "",
        )

        # Simple keyword-based classification
        # In production, this could use the LLM or ML model
        content_lower = chunk_content.lower()

        if any(
            term in content_lower
            for term in ["revenue", "ebitda", "margin", "profit", "cost", "$", "million", "billion"]
        ):
            return "financial"
        elif any(
            term in content_lower
            for term in ["contract", "agreement", "liability", "warranty", "indemnif"]
        ):
            return "legal"
        elif any(
            term in content_lower
            for term in ["employee", "customer", "operation", "process", "system"]
        ):
            return "operational"
        else:
            return "other"

    @agent.tool
    async def get_existing_findings_count(
        ctx: RunContext[AnalysisDependencies],
    ) -> int:
        """
        Get the count of existing findings for this document.

        Use this to check how many findings have already been extracted,
        which can inform extraction strategy and avoid duplicates.

        Returns:
            Number of findings already stored for this document
        """
        from uuid import UUID

        logger.debug(
            "Getting existing findings count",
            document_id=ctx.deps.document_id,
        )

        findings = await ctx.deps.db.get_findings_by_document(
            UUID(ctx.deps.document_id)
        )
        return len(findings) if findings else 0


async def log_usage(
    result: Any,
    model_str: str,
    db: Optional[SupabaseClient] = None,
    organization_id: Optional[UUID] = None,
    deal_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    feature: str = "extraction",
    latency_ms: Optional[int] = None,
) -> dict[str, Any]:
    """
    Log token usage and cost after agent run.

    Story: E11.6 - Model Configuration and Switching (AC: #4)
    Story: E12.2 - Usage Logging Integration (AC: #1)

    Args:
        result: The result from agent.run() - must have .usage() method
        model_str: Model string like 'google-gla:gemini-2.5-flash'
        db: Optional Supabase client for database persistence (E12.2)
        organization_id: Organization context for multi-tenant isolation (E12.9)
        deal_id: Deal context for the LLM call
        user_id: User who initiated the call
        feature: Feature category (extraction, chat, etc.)
        latency_ms: Optional latency in milliseconds

    Returns:
        Dictionary with usage data for further processing

    Example:
        result = await agent.run("Extract findings...", deps=deps)
        usage_data = await log_usage(
            result,
            "google-gla:gemini-2.5-flash",
            db=db,
            deal_id=deps.deal_id,
            feature="document_analysis",
        )
    """
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

    usage_data = {
        "provider": provider,
        "model": model,
        "feature": feature,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost_usd, 6),
    }

    if latency_ms is not None:
        usage_data["latency_ms"] = latency_ms

    # Log to structlog (existing behavior)
    logger.info("llm_usage", **usage_data)

    # E12.2: Persist to database if client provided
    if db is not None:
        from src.observability.usage import log_llm_usage_to_db

        await log_llm_usage_to_db(
            db,
            organization_id=organization_id,
            deal_id=deal_id,
            user_id=user_id,
            provider=provider,
            model=model,
            feature=feature,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
        )

    return usage_data


# Default agent instance using config model
# Can be overridden by calling create_analysis_agent() with specific model
_default_agent: Optional[Agent[AnalysisDependencies, list[FindingResult]]] = None


def get_analysis_agent() -> Agent[AnalysisDependencies, list[FindingResult]]:
    """
    Get or create the default analysis agent.

    Uses config from models.yaml with FallbackModel support.
    For custom models, use create_analysis_agent() directly.

    Returns:
        Configured Pydantic AI Agent with fallback chain
    """
    global _default_agent
    if _default_agent is None:
        _default_agent = create_analysis_agent()
    return _default_agent


__all__ = [
    "AnalysisDependencies",
    "create_analysis_agent",
    "get_analysis_agent",
    "log_usage",
]
