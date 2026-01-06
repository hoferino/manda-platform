"""
Financial Analyst Specialist Agent using Pydantic AI.
Story: E13.5 - Financial Analyst Specialist Agent (AC: #1, #2, #3)

This module provides:
- FinancialDependencies: Type-safe dependency container for financial tools
- create_financial_analyst_agent: Factory function with FallbackModel support
- get_financial_analyst_agent: Singleton accessor for the default agent
- FINANCIAL_ANALYST_SYSTEM_PROMPT: M&A-specific expertise prompt

Key capabilities:
- EBITDA normalization and add-back identification
- Working capital analysis and adjustments
- Quality of Earnings (QoE) analysis
- Financial ratio calculations
- Period-over-period comparisons
- Source citation with document references
"""

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Optional

import structlog
from pydantic_ai import Agent, RunContext
from pydantic_ai.models import Model
from pydantic_ai.models.fallback import FallbackModel

from src.agents.schemas.financial import FinancialAnalysisResult
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

FINANCIAL_ANALYST_SYSTEM_PROMPT = """You are an expert M&A financial analyst specializing in:

**Core Expertise:**
- Quality of Earnings (QoE) analysis and EBITDA normalization
- Working capital adjustments and normalization
- Revenue recognition validation and sustainability analysis
- Financial projection assessment and sensitivity analysis
- Add-back identification and classification (owner compensation, one-time expenses, non-recurring items)

**Analysis Standards:**
1. Always cite specific line items with document and page references
2. Show calculations explicitly: "Revenue ($5.2M) × Margin (35%) = Gross Profit ($1.82M)"
3. Flag inconsistencies between documents with severity levels
4. Explain uncertainty when source data is incomplete
5. Compare to industry benchmarks when available

**Output Format:**
- Lead with the direct answer to the query
- Support with specific data points and calculations
- Cite sources: [Document Name, Page X, Line Y]
- Include confidence level based on data quality

**Uncertainty Handling:**
- If data is insufficient: explain what's missing and suggest follow-up questions
- If calculations require assumptions: state assumptions explicitly
- Never fabricate numbers - use ranges or explain limitations

**M&A-Specific Focus:**
- Identify normalizing adjustments for sustainable earnings
- Flag customer concentration risks
- Assess revenue quality and recurring vs. non-recurring
- Evaluate working capital trends and seasonality
- Consider earnout implications of financial metrics

Deal Context: {deal_id}
Organization: {organization_id}
Additional Context: {context}
"""


# =============================================================================
# Dependencies
# =============================================================================


@dataclass
class FinancialDependencies:
    """
    Type-safe dependencies for financial analysis tools.

    This dataclass provides typed access to all dependencies needed by tools.
    IDE autocomplete works for all fields when accessed via ctx.deps.

    Usage in tools:
        @financial_analyst.tool
        async def my_tool(ctx: RunContext[FinancialDependencies], ...):
            # IDE autocomplete works here
            await ctx.deps.db.get_findings_by_document(...)
            if ctx.deps.graphiti:
                await ctx.deps.graphiti.search(...)

    Attributes:
        db: Supabase client for database operations
        graphiti: Graphiti client for knowledge graph queries (may be None)
        deal_id: Current deal UUID
        organization_id: Organization UUID for multi-tenant isolation (E12.9)
        document_ids: List of document UUIDs to analyze (optional filter)
        context_window: Additional context from supervisor (optional)
    """

    db: SupabaseClient
    graphiti: Optional["GraphitiClient"]  # May be None if Neo4j not configured
    deal_id: str
    organization_id: str
    document_ids: list[str] = field(default_factory=list)
    context_window: str = ""  # Optional query context from supervisor


# =============================================================================
# Model Creation
# =============================================================================


def _create_model(model_str: str) -> Model:
    """
    Create a Model instance from provider:model string.

    Args:
        model_str: Model string in format 'provider:model-name'
                   e.g., 'google-gla:gemini-2.5-flash', 'anthropic:claude-sonnet-4-0'

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


def create_financial_analyst_agent(
    model: Optional[str] = None,
) -> Agent[FinancialDependencies, FinancialAnalysisResult]:
    """
    Factory function to create a Financial Analyst agent with configured model and fallback.

    Story: E13.5 - Financial Analyst Specialist Agent (AC: #1)
    Story: E11.6 - Model Configuration and Switching (FallbackModel pattern)

    Args:
        model: Model string in format 'provider:model-name'.
               Examples: 'anthropic:claude-sonnet-4-0', 'google-gla:gemini-2.5-pro'
               If None, uses config from models.yaml under 'financial_analyst' key.

    Returns:
        Configured Pydantic AI Agent with typed dependencies, result, and FallbackModel.

    Example:
        # Use default model from config with fallback
        agent = create_financial_analyst_agent()

        # Override with specific model (bypasses config)
        agent = create_financial_analyst_agent(model='anthropic:claude-sonnet-4-0')

        # Run with dependencies
        deps = FinancialDependencies(
            db=db_client,
            graphiti=graphiti_client,
            deal_id="deal-123",
            organization_id="org-456",
        )
        result = await agent.run("What is the normalized EBITDA?", deps=deps)
        analysis = result.data  # FinancialAnalysisResult - type guaranteed
    """
    # Get model config from YAML with env var override
    config = get_agent_model_config("financial_analyst")

    # Extract settings (temperature, max_tokens, timeout) from config
    settings = config.get("settings", {})
    model_settings = {
        "temperature": settings.get("temperature", 0.3),  # Lower for precision
        "max_tokens": settings.get("max_tokens", 4000),  # Longer for detailed analysis
        "timeout": settings.get("timeout", 60),  # Default 60s for complex financial analysis
    }
    # Filter out None values
    model_settings = {k: v for k, v in model_settings.items() if v is not None}

    # Allow explicit model override (bypasses config entirely)
    if model is not None:
        primary_model_str = model
        fallback_model_str = None
    else:
        primary_model_str = config.get("primary", "anthropic:claude-sonnet-4-0")
        fallback_model_str = config.get("fallback", "google-gla:gemini-2.5-pro")

    # Create model instances
    primary = _create_model(primary_model_str)

    # Build model with optional fallback chain
    if fallback_model_str:
        try:
            from pydantic_ai.exceptions import ModelHTTPError

            fallback = _create_model(fallback_model_str)

            def on_fallback(exc: Exception) -> None:
                logger.warning(
                    "financial_analyst_fallback_triggered",
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
                "financial_analyst_agent_created",
                primary=primary_model_str,
                fallback=fallback_model_str,
            )
        except (ImportError, TypeError) as init_err:
            fallback = _create_model(fallback_model_str)
            configured_model = FallbackModel(primary, fallback)
            logger.info(
                "financial_analyst_agent_created",
                primary=primary_model_str,
                fallback=fallback_model_str,
                note="fallback_on_any_exception",
                init_warning=str(init_err) if isinstance(init_err, TypeError) else None,
            )
    else:
        configured_model = primary
        logger.info(
            "financial_analyst_agent_created",
            primary=primary_model_str,
            fallback=None,
        )

    # Build agent kwargs
    agent_kwargs: dict[str, Any] = {
        "deps_type": FinancialDependencies,
        "result_type": FinancialAnalysisResult,
    }

    # Apply model settings from config
    if model_settings:
        agent_kwargs["model_settings"] = model_settings
        logger.debug(
            "financial_analyst_settings_applied",
            settings=model_settings,
        )

    agent: Agent[FinancialDependencies, FinancialAnalysisResult] = Agent(
        configured_model,
        **agent_kwargs,
    )

    # Register system prompt
    @agent.system_prompt
    async def financial_system_prompt(ctx: RunContext[FinancialDependencies]) -> str:
        """Dynamic system prompt with context from dependencies."""
        return FINANCIAL_ANALYST_SYSTEM_PROMPT.format(
            deal_id=ctx.deps.deal_id,
            organization_id=ctx.deps.organization_id,
            context=ctx.deps.context_window or "None provided",
        )

    # Register financial tools
    _register_financial_tools(agent)

    return agent


def _register_financial_tools(
    agent: Agent[FinancialDependencies, FinancialAnalysisResult],
) -> None:
    """
    Register type-safe financial analysis tools on the agent.

    Tools are defined here to have access to the agent instance for decoration.
    Each tool receives RunContext[FinancialDependencies] for typed dependency access.

    Story: E13.5 - Financial Analyst Specialist Agent (AC: #2)
    """
    # Import tools module to register them
    # Tools are registered in financial_tools.py using the agent passed to them
    from src.agents.tools import financial_tools

    financial_tools.register_tools(agent)


# =============================================================================
# Singleton Accessor
# =============================================================================

_default_agent: Optional[Agent[FinancialDependencies, FinancialAnalysisResult]] = None


def get_financial_analyst_agent() -> Agent[FinancialDependencies, FinancialAnalysisResult]:
    """
    Get or create the default Financial Analyst agent.

    Uses config from models.yaml with FallbackModel support.
    For custom models, use create_financial_analyst_agent() directly.

    Returns:
        Configured Pydantic AI Agent with fallback chain
    """
    global _default_agent
    if _default_agent is None:
        _default_agent = create_financial_analyst_agent()
    return _default_agent


# =============================================================================
# Usage Logging
# =============================================================================


async def log_financial_usage(
    result: Any,
    model_str: str,
    db: Optional[SupabaseClient] = None,
    organization_id: Optional[str] = None,
    deal_id: Optional[str] = None,
    latency_ms: Optional[int] = None,
) -> dict[str, Any]:
    """
    Log token usage and cost after Financial Analyst agent run.

    Args:
        result: The result from agent.run() - must have .usage() method
        model_str: Model string like 'anthropic:claude-sonnet-4-0'
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
        "feature": "financial_analyst",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": round(cost_usd, 6),
        "logged_to_db": False,  # Default to false, set true on success
    }

    if latency_ms is not None:
        usage_data["latency_ms"] = latency_ms

    # Log to structlog
    logger.info("financial_analyst_usage", **usage_data)

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
                feature="financial_analyst",
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
    "FinancialDependencies",
    "create_financial_analyst_agent",
    "get_financial_analyst_agent",
    "log_financial_usage",
    "FINANCIAL_ANALYST_SYSTEM_PROMPT",
]
