"""
Type-safe tools for specialist agents.
Story: E13.5 - Financial Analyst Specialist Agent (AC: #2)
Story: E13.6 - Knowledge Graph Specialist Agent (AC: #2)

Tools are registered on agents via the register_tools() function pattern,
which receives the agent instance and decorates tool functions with @agent.tool.
"""

from src.agents.tools import financial_tools, kg_tools

__all__ = ["financial_tools", "kg_tools"]
