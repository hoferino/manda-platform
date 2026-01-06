"""
Type-safe financial analysis tools for the Financial Analyst agent.
Story: E13.5 - Financial Analyst Specialist Agent (AC: #2)

This module provides tools that query Graphiti for financial data and
perform calculations. Each tool uses RunContext[FinancialDependencies]
for type-safe dependency access.

Tools:
- analyze_financials: Extract and analyze financial metrics from documents
- compare_periods: YoY/QoQ/MoM comparisons of metrics
- calculate_ratios: Financial ratio calculations
- get_financial_metrics: Retrieve stored metrics from knowledge graph
"""

from typing import TYPE_CHECKING, Any, Optional

import structlog
from pydantic_ai import Agent, RunContext

if TYPE_CHECKING:
    from src.agents.financial_analyst import FinancialDependencies
    from src.agents.schemas.financial import FinancialAnalysisResult

logger = structlog.get_logger(__name__)


# Custom exceptions for better error handling
class GraphitiQueryError(Exception):
    """Error querying the Graphiti knowledge graph."""
    pass


class MetricExtractionError(Exception):
    """Error extracting metric values from search results."""
    pass


def register_tools(
    agent: "Agent[FinancialDependencies, FinancialAnalysisResult]",
) -> None:
    """
    Register all financial analysis tools on the agent.

    This function is called by create_financial_analyst_agent() to
    register tools with the @agent.tool decorator.

    Args:
        agent: The Pydantic AI agent to register tools on
    """

    @agent.tool
    async def analyze_financials(
        ctx: "RunContext[FinancialDependencies]",
        metrics: list[str],
        document_ids: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        Extract and analyze financial metrics from documents.

        Use this tool to retrieve specific financial metrics from the knowledge graph,
        filtered by document if specified. Returns structured findings with sources.

        Args:
            metrics: List of metric names to analyze (e.g., ['revenue', 'ebitda', 'gross_margin'])
            document_ids: Optional list of document UUIDs to filter by.
                         If None, uses ctx.deps.document_ids or searches all deal documents.

        Returns:
            Dictionary containing:
            - metrics: List of found metrics with values and sources
            - missing: List of requested metrics not found
            - document_count: Number of documents searched

        Example:
            result = await analyze_financials(ctx, metrics=['revenue', 'ebitda'])
            # Returns: {'metrics': [...], 'missing': [], 'document_count': 3}
        """
        logger.debug(
            "analyze_financials_called",
            deal_id=ctx.deps.deal_id,
            requested_metrics=metrics,
            document_filter=document_ids or ctx.deps.document_ids,
        )

        # Use provided document_ids or fall back to deps
        docs_to_search = document_ids or ctx.deps.document_ids

        results: dict[str, Any] = {
            "metrics": [],
            "missing": [],
            "document_count": 0,
        }

        if not ctx.deps.graphiti:
            logger.warning("graphiti_not_available", deal_id=ctx.deps.deal_id)
            results["missing"] = metrics
            results["error"] = "Knowledge graph not available"
            return results

        try:
            # Build group_id for multi-tenant isolation (E12.9)
            group_id = f"{ctx.deps.organization_id}:{ctx.deps.deal_id}"

            # Query Graphiti for each metric
            for metric_name in metrics:
                search_query = f"financial metric {metric_name}"

                # Use public search method via _search_graphiti helper
                search_results = await _search_graphiti(
                    ctx.deps.graphiti,
                    query=search_query,
                    group_ids=[group_id],
                    num_results=20,
                )

                if search_results:
                    for result in search_results:
                        # Extract metric data from search result
                        metric_data = {
                            "name": metric_name,
                            "value": _extract_value_from_result(result, metric_name),
                            "source": {
                                "fact_id": getattr(result, "uuid", None),
                                "content": getattr(result, "fact", None) or getattr(result, "content", None),
                            },
                            "confidence": 0.8,  # Base confidence, could be refined
                        }
                        results["metrics"].append(metric_data)
                else:
                    results["missing"].append(metric_name)

            results["document_count"] = len(docs_to_search) if docs_to_search else "all"

        except GraphitiQueryError as e:
            logger.error(
                "analyze_financials_graphiti_error",
                error=str(e),
                deal_id=ctx.deps.deal_id,
            )
            results["error"] = f"Knowledge graph query failed: {e}"
            results["missing"] = metrics
        except (ConnectionError, TimeoutError) as e:
            logger.error(
                "analyze_financials_connection_error",
                error=str(e),
                deal_id=ctx.deps.deal_id,
            )
            results["error"] = f"Connection error: {e}"
            results["missing"] = metrics
        except Exception as e:
            logger.error(
                "analyze_financials_error",
                error=str(e),
                error_type=type(e).__name__,
                deal_id=ctx.deps.deal_id,
            )
            results["error"] = str(e)
            results["missing"] = metrics

        return results

    @agent.tool
    async def compare_periods(
        ctx: "RunContext[FinancialDependencies]",
        metric: str,
        period1: str,
        period2: str,
    ) -> dict[str, Any]:
        """
        Compare a financial metric across two time periods.

        Use this tool for YoY (Year-over-Year), QoQ (Quarter-over-Quarter),
        or MoM (Month-over-Month) comparisons. Returns absolute and percentage changes.

        Args:
            metric: Name of the metric to compare (e.g., 'revenue', 'ebitda')
            period1: Earlier period label (e.g., 'Q3 2023', 'FY2022')
            period2: Later period label (e.g., 'Q3 2024', 'FY2023')

        Returns:
            Dictionary containing:
            - metric: Name of the compared metric
            - period1_value: Value in earlier period (or None if not found)
            - period2_value: Value in later period (or None if not found)
            - change_absolute: Absolute change (period2 - period1)
            - change_percent: Percentage change
            - trend: 'increasing', 'stable', or 'decreasing'
            - data_quality: Assessment of data completeness

        Example:
            result = await compare_periods(ctx, 'revenue', 'Q3 2023', 'Q3 2024')
            # Returns: {'metric': 'revenue', 'period1_value': 5000000, ...}
        """
        logger.debug(
            "compare_periods_called",
            deal_id=ctx.deps.deal_id,
            metric=metric,
            period1=period1,
            period2=period2,
        )

        result: dict[str, Any] = {
            "metric": metric,
            "period1": period1,
            "period2": period2,
            "period1_value": None,
            "period2_value": None,
            "change_absolute": None,
            "change_percent": None,
            "trend": None,
            "data_quality": "incomplete",
        }

        if not ctx.deps.graphiti:
            result["error"] = "Knowledge graph not available"
            return result

        try:
            group_id = f"{ctx.deps.organization_id}:{ctx.deps.deal_id}"

            # Search for metric in period1
            p1_results = await _search_graphiti(
                ctx.deps.graphiti,
                query=f"{metric} {period1}",
                group_ids=[group_id],
                num_results=5,
            )

            # Search for metric in period2
            p2_results = await _search_graphiti(
                ctx.deps.graphiti,
                query=f"{metric} {period2}",
                group_ids=[group_id],
                num_results=5,
            )

            # Extract values
            if p1_results:
                result["period1_value"] = _extract_numeric_value(p1_results[0], metric)
            if p2_results:
                result["period2_value"] = _extract_numeric_value(p2_results[0], metric)

            # Calculate changes if both values present
            if result["period1_value"] is not None and result["period2_value"] is not None:
                p1 = float(result["period1_value"])
                p2 = float(result["period2_value"])

                result["change_absolute"] = p2 - p1

                if p1 != 0:
                    result["change_percent"] = ((p2 - p1) / abs(p1)) * 100
                else:
                    result["change_percent"] = 100.0 if p2 > 0 else 0.0

                # Determine trend
                if result["change_percent"] > 5:
                    result["trend"] = "increasing"
                elif result["change_percent"] < -5:
                    result["trend"] = "decreasing"
                else:
                    result["trend"] = "stable"

                result["data_quality"] = "complete"
            elif result["period1_value"] is not None or result["period2_value"] is not None:
                result["data_quality"] = "partial"

        except Exception as e:
            logger.error(
                "compare_periods_error",
                error=str(e),
                deal_id=ctx.deps.deal_id,
            )
            result["error"] = str(e)

        return result

    @agent.tool
    async def calculate_ratios(
        ctx: "RunContext[FinancialDependencies]",
        ratio_types: list[str],
        period: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Calculate financial ratios from available metrics.

        Use this tool to compute standard financial ratios like margins,
        leverage ratios, and liquidity ratios. Retrieves required component
        metrics from the knowledge graph and performs calculations.

        Args:
            ratio_types: List of ratio types to calculate. Supported:
                - 'gross_margin': (Revenue - COGS) / Revenue
                - 'operating_margin': Operating Income / Revenue
                - 'ebitda_margin': EBITDA / Revenue
                - 'net_margin': Net Income / Revenue
                - 'current_ratio': Current Assets / Current Liabilities
                - 'debt_equity': Total Debt / Total Equity
                - 'revenue_growth': (Current Revenue - Prior Revenue) / Prior Revenue
            period: Optional period to calculate for (e.g., 'Q3 2024', 'FY2023')

        Returns:
            Dictionary containing:
            - ratios: List of calculated ratios with formulas and values
            - missing_data: List of ratios that couldn't be calculated and why
            - period: The period these ratios apply to

        Example:
            result = await calculate_ratios(ctx, ['gross_margin', 'ebitda_margin'], 'Q3 2024')
            # Returns: {'ratios': [{'name': 'gross_margin', 'value': 0.35, ...}], ...}
        """
        logger.debug(
            "calculate_ratios_called",
            deal_id=ctx.deps.deal_id,
            ratio_types=ratio_types,
            period=period,
        )

        # Ratio definitions: name -> (formula_display, required_metrics, calculation_fn)
        RATIO_DEFINITIONS = {
            "gross_margin": {
                "formula": "(Revenue - COGS) / Revenue",
                "required": ["revenue", "cogs"],
                "calc": lambda m: (m["revenue"] - m["cogs"]) / m["revenue"] if m["revenue"] else None,
                "interpretation": "Percentage of revenue retained after direct costs",
            },
            "operating_margin": {
                "formula": "Operating Income / Revenue",
                "required": ["operating_income", "revenue"],
                "calc": lambda m: m["operating_income"] / m["revenue"] if m["revenue"] else None,
                "interpretation": "Percentage of revenue retained after operating expenses",
            },
            "ebitda_margin": {
                "formula": "EBITDA / Revenue",
                "required": ["ebitda", "revenue"],
                "calc": lambda m: m["ebitda"] / m["revenue"] if m["revenue"] else None,
                "interpretation": "Cash earnings efficiency relative to revenue",
            },
            "net_margin": {
                "formula": "Net Income / Revenue",
                "required": ["net_income", "revenue"],
                "calc": lambda m: m["net_income"] / m["revenue"] if m["revenue"] else None,
                "interpretation": "Percentage of revenue converted to profit",
            },
            "current_ratio": {
                "formula": "Current Assets / Current Liabilities",
                "required": ["current_assets", "current_liabilities"],
                "calc": lambda m: m["current_assets"] / m["current_liabilities"] if m["current_liabilities"] else None,
                "interpretation": "Short-term liquidity - ability to pay current obligations",
            },
            "debt_equity": {
                "formula": "Total Debt / Total Equity",
                "required": ["total_debt", "total_equity"],
                "calc": lambda m: m["total_debt"] / m["total_equity"] if m["total_equity"] else None,
                "interpretation": "Financial leverage - proportion of debt vs equity financing",
            },
            "revenue_growth": {
                "formula": "(Current Revenue - Prior Revenue) / Prior Revenue",
                "required": ["current_revenue", "prior_revenue"],
                "calc": lambda m: (m["current_revenue"] - m["prior_revenue"]) / m["prior_revenue"] if m["prior_revenue"] else None,
                "interpretation": "Year-over-year or period-over-period revenue change",
            },
        }

        result: dict[str, Any] = {
            "ratios": [],
            "missing_data": [],
            "period": period,
        }

        # Collect all required metrics
        all_required_metrics: set[str] = set()
        for ratio_type in ratio_types:
            if ratio_type in RATIO_DEFINITIONS:
                all_required_metrics.update(RATIO_DEFINITIONS[ratio_type]["required"])

        # Fetch metrics from knowledge graph
        fetched_metrics: dict[str, float] = {}

        if ctx.deps.graphiti:
            try:
                group_id = f"{ctx.deps.organization_id}:{ctx.deps.deal_id}"

                for metric_name in all_required_metrics:
                    search_query = f"{metric_name} {period}" if period else metric_name
                    search_results = await _search_graphiti(
                        ctx.deps.graphiti,
                        query=search_query,
                        group_ids=[group_id],
                        num_results=5,
                    )

                    if search_results:
                        value = _extract_numeric_value(search_results[0], metric_name)
                        if value is not None:
                            fetched_metrics[metric_name] = value

            except GraphitiQueryError as e:
                logger.error("calculate_ratios_graphiti_error", error=str(e))
            except (ConnectionError, TimeoutError) as e:
                logger.error("calculate_ratios_connection_error", error=str(e))
            except Exception as e:
                logger.error("calculate_ratios_fetch_error", error=str(e), error_type=type(e).__name__)

        # Calculate each ratio
        for ratio_type in ratio_types:
            if ratio_type not in RATIO_DEFINITIONS:
                result["missing_data"].append({
                    "ratio": ratio_type,
                    "reason": f"Unknown ratio type: {ratio_type}",
                })
                continue

            defn = RATIO_DEFINITIONS[ratio_type]
            missing_metrics = [m for m in defn["required"] if m not in fetched_metrics]

            if missing_metrics:
                result["missing_data"].append({
                    "ratio": ratio_type,
                    "reason": f"Missing required metrics: {', '.join(missing_metrics)}",
                })
                continue

            try:
                value = defn["calc"](fetched_metrics)
                if value is not None:
                    result["ratios"].append({
                        "name": ratio_type,
                        "value": round(value, 4),
                        "formula": defn["formula"],
                        "interpretation": defn["interpretation"],
                        "period": period,
                    })
                else:
                    result["missing_data"].append({
                        "ratio": ratio_type,
                        "reason": "Calculation resulted in null (likely division by zero)",
                    })
            except Exception as e:
                result["missing_data"].append({
                    "ratio": ratio_type,
                    "reason": f"Calculation error: {str(e)}",
                })

        return result

    @agent.tool
    async def get_financial_metrics(
        ctx: "RunContext[FinancialDependencies]",
        metric_types: Optional[list[str]] = None,
        include_temporal: bool = True,
    ) -> dict[str, Any]:
        """
        Retrieve stored financial metrics from the knowledge graph.

        Use this tool to get an overview of available financial data for the deal.
        Can filter by specific metric types or retrieve all available metrics.

        Args:
            metric_types: Optional list of metric types to filter by.
                         Examples: ['revenue', 'ebitda', 'working_capital']
                         If None, retrieves all available financial metrics.
            include_temporal: Whether to include temporal context (valid_at dates)

        Returns:
            Dictionary containing:
            - metrics: List of metric objects with name, value, period, source
            - metric_count: Total number of metrics found
            - periods_covered: List of time periods with data
            - sources: List of source documents

        Example:
            result = await get_financial_metrics(ctx, metric_types=['revenue', 'ebitda'])
            # Returns: {'metrics': [...], 'metric_count': 12, 'periods_covered': ['Q1-Q4 2024']}
        """
        logger.debug(
            "get_financial_metrics_called",
            deal_id=ctx.deps.deal_id,
            metric_types=metric_types,
            include_temporal=include_temporal,
        )

        result: dict[str, Any] = {
            "metrics": [],
            "metric_count": 0,
            "periods_covered": [],
            "sources": [],
        }

        if not ctx.deps.graphiti:
            result["error"] = "Knowledge graph not available"
            return result

        try:
            group_id = f"{ctx.deps.organization_id}:{ctx.deps.deal_id}"

            # Build search query
            if metric_types:
                search_query = f"financial metrics {' '.join(metric_types)}"
            else:
                search_query = "financial metrics revenue ebitda margin"

            # Search for financial metrics
            search_results = await _search_graphiti(
                ctx.deps.graphiti,
                query=search_query,
                group_ids=[group_id],
                num_results=50,  # Get more results for overview
            )

            periods_seen: set[str] = set()
            sources_seen: set[str] = set()

            for sr in search_results or []:
                metric_data = {
                    "name": _infer_metric_name(sr),
                    "value": _extract_value_from_result(sr, None),
                    "content": getattr(sr, "fact", None) or getattr(sr, "content", None),
                    "source_id": getattr(sr, "uuid", None),
                }

                if include_temporal:
                    valid_at = getattr(sr, "valid_at", None)
                    if valid_at:
                        metric_data["valid_at"] = str(valid_at)
                        # Try to extract period from valid_at
                        period = _extract_period_from_date(valid_at)
                        if period:
                            metric_data["period"] = period
                            periods_seen.add(period)

                # Track sources
                source_desc = getattr(sr, "source_description", None)
                if source_desc:
                    sources_seen.add(source_desc)

                result["metrics"].append(metric_data)

            result["metric_count"] = len(result["metrics"])
            result["periods_covered"] = sorted(list(periods_seen))
            result["sources"] = list(sources_seen)

        except Exception as e:
            logger.error(
                "get_financial_metrics_error",
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
        # TODO: Refactor GraphitiClient to expose a public search method
        if hasattr(graphiti, "_instance") and graphiti._instance is not None:
            return await graphiti._instance.search(
                query=query,
                group_ids=group_ids,
                num_results=num_results,
            )
        elif hasattr(graphiti, "search"):
            # Use public method if available
            return await graphiti.search(
                query=query,
                group_ids=group_ids,
                num_results=num_results,
            )
        else:
            raise GraphitiQueryError("GraphitiClient has no search method available")
    except GraphitiQueryError:
        raise
    except Exception as e:
        raise GraphitiQueryError(f"Search failed: {e}") from e


def _extract_value_from_result(result: Any, metric_name: Optional[str]) -> Any:
    """
    Extract a value from a Graphiti search result.

    Attempts to extract numeric values from various result formats:
    1. From 'properties' dict ('value' or 'amount' keys)
    2. From text content using regex pattern matching

    Args:
        result: A Graphiti search result object
        metric_name: Optional metric name to help with text extraction

    Returns:
        Extracted value (numeric or string) or raw content if extraction fails
    """
    # Try to get value from various possible attributes
    if hasattr(result, "properties"):
        props = result.properties
        if isinstance(props, dict):
            value = props.get("value") or props.get("amount")
            if value is not None:
                return value

    # Try to parse from fact/content text
    content = getattr(result, "fact", None) or getattr(result, "content", None)
    if content and metric_name:
        import re

        # Normalize metric name for case-insensitive matching
        metric_pattern = re.escape(metric_name.lower())

        # Enhanced pattern for currency amounts including negative values
        # Handles: $5.2 million, -$3.5M, (1,234.56), 1.234,56 (European)
        patterns = [
            # Standard US format: $5.2 million, -$1,234.56
            rf"{metric_pattern}[^$0-9-]*-?\$?([\d,]+\.?\d*)\s*(million|billion|M|B|k|K)?",
            # Negative in parentheses: (1,234.56)
            rf"{metric_pattern}[^(0-9]*\(([\d,]+\.?\d*)\)\s*(million|billion|M|B|k|K)?",
            # European format with comma decimal: 1.234,56
            rf"{metric_pattern}[^0-9]*(\d{{1,3}}(?:\.\d{{3}})*,\d{{2}})\s*(million|billion|M|B|k|K)?",
        ]

        content_lower = str(content).lower()

        for idx, pattern in enumerate(patterns):
            match = re.search(pattern, content_lower, re.IGNORECASE)
            if match:
                value_str = match.group(1)
                multiplier = match.group(2) if len(match.groups()) > 1 else None

                # Handle European format (1.234,56 -> 1234.56)
                if "," in value_str and "." in value_str:
                    if value_str.index(",") > value_str.index("."):
                        # European: 1.234,56
                        value_str = value_str.replace(".", "").replace(",", ".")

                # Clean and convert
                value = float(value_str.replace(",", ""))

                # Check for negative: pattern index 1 is the parentheses pattern
                # Pattern: metric[^(0-9]*\((...)\) - captures values in accounting notation
                if idx == 1:
                    value = -value

                # Apply multiplier
                if multiplier:
                    multiplier = multiplier.lower()
                    if multiplier in ("million", "m"):
                        value *= 1_000_000
                    elif multiplier in ("billion", "b"):
                        value *= 1_000_000_000
                    elif multiplier in ("k",):
                        value *= 1_000

                return value

    return content  # Return raw content if can't extract value


def _extract_numeric_value(result: Any, metric_name: str) -> Optional[float]:
    """
    Extract a numeric value from a search result.

    Wrapper around _extract_value_from_result that ensures a float return type.

    Args:
        result: A Graphiti search result object
        metric_name: Name of the metric to extract

    Returns:
        Extracted float value or None if extraction fails
    """
    value = _extract_value_from_result(result, metric_name)
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            # Try to parse as number - handle various formats
            clean = value.replace(",", "").replace("$", "").replace("(", "-").replace(")", "").strip()
            return float(clean)
        except ValueError:
            pass
    return None


def _infer_metric_name(result: Any) -> str:
    """
    Infer the metric name from a search result.

    Attempts to determine what type of financial metric is represented
    by examining the result's attributes and content.

    Args:
        result: A Graphiti search result object

    Returns:
        Inferred metric name string (defaults to "Financial Metric" if unknown)
    """
    # Try name attribute
    name = getattr(result, "name", None)
    if name:
        return str(name)

    # Try to infer from content
    content = getattr(result, "fact", None) or getattr(result, "content", None)
    if content:
        content_lower = str(content).lower()
        # Check for common metric keywords
        keywords = [
            "revenue", "ebitda", "margin", "profit", "cost", "expense",
            "asset", "liability", "equity", "debt", "income", "cash flow",
        ]
        for kw in keywords:
            if kw in content_lower:
                return kw.title()

    return "Financial Metric"


def _extract_period_from_date(date_value: Any) -> Optional[str]:
    """
    Extract a period label from a date value.

    Converts a date/datetime to a quarter-year format (e.g., "Q3 2024").

    Args:
        date_value: Date value (string, datetime, or None)

    Returns:
        Period string in "Q# YYYY" format, or None if extraction fails
    """
    from datetime import datetime

    if date_value is None:
        return None

    try:
        if isinstance(date_value, str):
            # Handle ISO format with optional timezone
            dt = datetime.fromisoformat(date_value.replace("Z", "+00:00"))
        elif isinstance(date_value, datetime):
            dt = date_value
        else:
            return None

        quarter = (dt.month - 1) // 3 + 1
        return f"Q{quarter} {dt.year}"
    except (ValueError, AttributeError):
        return None


__all__ = ["register_tools"]
