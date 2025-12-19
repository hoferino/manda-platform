"""
LLM module for document analysis using Gemini 2.5 and Pydantic AI.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach)
Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI

This module provides:
- GeminiClient: Tiered Gemini client for document analysis (legacy)
- Pydantic AI: Type-safe agent with structured output (E11.5)
- ModelTier: Enum for model selection (Flash, Pro, Lite)
- Prompt templates for M&A-specific finding extraction
- Response parsing utilities
"""

from src.llm.client import (
    GeminiClient,
    GeminiError,
    GeminiRateLimitError,
    GeminiAPIError,
    GeminiInvalidResponseError,
    AnalysisResult,
    BatchAnalysisResult,
    get_gemini_client,
)
from src.llm.models import (
    ModelTier,
    FINANCIAL_MIME_TYPES,
    select_model_tier,
    get_model_pricing,
    estimate_cost,
)
from src.llm.prompts import (
    SYSTEM_PROMPT,
    get_system_prompt,
    get_extraction_prompt,
    get_batch_extraction_prompt,
    parse_findings_response,
)
# E11.5 & E11.6: Pydantic AI exports
from src.llm.pydantic_agent import (
    AnalysisDependencies,
    create_analysis_agent,
    get_analysis_agent,
    log_usage,
)
from src.llm.schemas import (
    FindingResult,
    ChunkClassification,
    BatchAnalysisResult as PydanticBatchAnalysisResult,
)

__all__ = [
    # Client (legacy)
    "GeminiClient",
    "GeminiError",
    "GeminiRateLimitError",
    "GeminiAPIError",
    "GeminiInvalidResponseError",
    "AnalysisResult",
    "BatchAnalysisResult",
    "get_gemini_client",
    # Models
    "ModelTier",
    "FINANCIAL_MIME_TYPES",
    "select_model_tier",
    "get_model_pricing",
    "estimate_cost",
    # Prompts
    "SYSTEM_PROMPT",
    "get_system_prompt",
    "get_extraction_prompt",
    "get_batch_extraction_prompt",
    "parse_findings_response",
    # Pydantic AI (E11.5 & E11.6)
    "AnalysisDependencies",
    "create_analysis_agent",
    "get_analysis_agent",
    "log_usage",
    "FindingResult",
    "ChunkClassification",
    "PydanticBatchAnalysisResult",
]
