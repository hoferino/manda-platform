"""
Specialist agents for M&A analysis.
Story: E13.5 - Financial Analyst Specialist Agent

This package provides domain-specific agents that can be invoked by the
supervisor pattern (E13.4) for complex queries.

Available agents:
- FinancialAnalystAgent: M&A financial analysis specialist (EBITDA, QoE, working capital)
- KnowledgeGraphAgent: Entity resolution and relationship traversal (E13.6 - future)
"""

from src.agents.financial_analyst import (
    FinancialDependencies,
    create_financial_analyst_agent,
    get_financial_analyst_agent,
)
from src.agents.schemas.financial import (
    FinancialAnalysisResult,
    FinancialFinding,
    FinancialRatio,
    PeriodComparison,
    SourceReference,
)

__all__ = [
    # Agent
    "FinancialDependencies",
    "create_financial_analyst_agent",
    "get_financial_analyst_agent",
    # Schemas
    "FinancialAnalysisResult",
    "FinancialFinding",
    "FinancialRatio",
    "PeriodComparison",
    "SourceReference",
]
