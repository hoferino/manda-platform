"""
Type-safe tools for Pydantic AI agent.
Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI (AC: #2, #3, #4)

This package provides:
- Type-safe tools decorated with @agent.tool
- Tools receive RunContext[AnalysisDependencies] for type-checked dependency access
- Comprehensive docstrings that become tool descriptions for the LLM
"""

from src.llm.tools.extraction_tools import (
    extract_finding,
    classify_chunk,
)

__all__ = [
    "extract_finding",
    "classify_chunk",
]
