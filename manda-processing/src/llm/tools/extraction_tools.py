"""
Extraction tools for Pydantic AI agent.
Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI (AC: #2, #3, #4, #7)

Note: The actual tool implementations are in pydantic_agent.py because tools
must be decorated with @agent.tool on a specific agent instance.

This module provides documentation and type hints for the tools.
The tools themselves are registered via _register_tools() in pydantic_agent.py.

Tools available:
- classify_chunk: Classify a document chunk for extraction priority
- get_existing_findings_count: Get count of existing findings for document

To add new tools:
1. Define the tool function in pydantic_agent.py's _register_tools()
2. Use RunContext[AnalysisDependencies] as first parameter for type-safe dependency access
3. Add comprehensive docstring - it becomes the tool description for the LLM
4. Return structured data (Pydantic models preferred)

Example tool pattern:
    @agent.tool
    async def my_new_tool(
        ctx: RunContext[AnalysisDependencies],
        param1: str,
        param2: int,
    ) -> MyResultModel:
        '''
        Tool description here - shown to the LLM.

        Args:
            param1: Description of param1
            param2: Description of param2

        Returns:
            Description of return value
        '''
        # Access dependencies with full type safety
        result = await ctx.deps.db.some_method(...)
        return MyResultModel(...)
"""

# Re-export for documentation purposes
# Actual implementations are in pydantic_agent._register_tools

# Tool function signatures for type checking and documentation
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pydantic_ai import RunContext
    from src.llm.pydantic_agent import AnalysisDependencies

    async def extract_finding(
        ctx: "RunContext[AnalysisDependencies]",
        content: str,
        finding_type: str,
        confidence: float,
        source_reference: dict,
    ) -> dict:
        """Extract and store a finding from document content."""
        ...

    async def classify_chunk(
        ctx: "RunContext[AnalysisDependencies]",
        chunk_content: str,
        chunk_type: str,
    ) -> str:
        """Classify a document chunk for extraction priority."""
        ...


__all__ = [
    "extract_finding",
    "classify_chunk",
]
