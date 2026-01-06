"""
Specialist agents for M&A analysis.
Story: E13.5 - Financial Analyst Specialist Agent
Story: E13.6 - Knowledge Graph Specialist Agent

This package provides domain-specific agents that can be invoked by the
supervisor pattern (E13.4) for complex queries.

Available agents:
- FinancialAnalystAgent: M&A financial analysis specialist (EBITDA, QoE, working capital)
- KnowledgeGraphAgent: Entity resolution and relationship traversal
"""

from src.agents.financial_analyst import (
    FinancialDependencies,
    create_financial_analyst_agent,
    get_financial_analyst_agent,
)
from src.agents.knowledge_graph import (
    KGDependencies,
    create_knowledge_graph_agent,
    get_knowledge_graph_agent,
)
from src.agents.schemas.financial import (
    FinancialAnalysisResult,
    FinancialFinding,
    FinancialRatio,
    PeriodComparison,
    SourceReference,
)
from src.agents.schemas.knowledge_graph import (
    ContradictionResult,
    EntityMatch,
    KGAnalysisResult,
    RelationshipPath,
    RelationshipStep,
    TemporalFact,
)

__all__ = [
    # Financial Analyst Agent
    "FinancialDependencies",
    "create_financial_analyst_agent",
    "get_financial_analyst_agent",
    # Knowledge Graph Agent
    "KGDependencies",
    "create_knowledge_graph_agent",
    "get_knowledge_graph_agent",
    # Financial Schemas
    "FinancialAnalysisResult",
    "FinancialFinding",
    "FinancialRatio",
    "PeriodComparison",
    "SourceReference",
    # Knowledge Graph Schemas
    "KGAnalysisResult",
    "EntityMatch",
    "RelationshipStep",
    "RelationshipPath",
    "ContradictionResult",
    "TemporalFact",
]
