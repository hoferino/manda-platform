"""
LLM module for document analysis using Gemini 2.5.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach)

This module provides:
- GeminiClient: Tiered Gemini client for document analysis
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

__all__ = [
    # Client
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
]
