"""
Pydantic schemas for specialist agents.
Story: E13.5 - Financial Analyst Specialist Agent (AC: #1, #3)
Story: E13.6 - Knowledge Graph Specialist Agent (AC: #1, #3)
"""

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
    # Financial schemas
    "FinancialAnalysisResult",
    "FinancialFinding",
    "FinancialRatio",
    "PeriodComparison",
    "SourceReference",
    # Knowledge Graph schemas
    "KGAnalysisResult",
    "EntityMatch",
    "RelationshipStep",
    "RelationshipPath",
    "ContradictionResult",
    "TemporalFact",
]
