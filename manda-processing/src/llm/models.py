"""
Model tier selection logic for Gemini LLM analysis.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #2)

This module provides:
- ModelTier enum for different Gemini model tiers
- Model selection logic based on document type and analysis depth
"""

from enum import Enum


class ModelTier(str, Enum):
    """Available Gemini model tiers with pricing and use cases.

    Pricing (as of 2024):
    - FLASH: $0.30/1M input, $2.50/1M output - Standard extraction
    - PRO: $1.25/1M input, $10/1M output - Deep financial analysis
    - LITE: $0.10/1M input, $0.40/1M output - Batch processing
    """

    FLASH = "gemini-2.5-flash"  # Default for standard documents
    PRO = "gemini-2.5-pro"  # Complex financial analysis
    LITE = "gemini-2.5-flash-lite"  # Batch/bulk processing


# MIME types that indicate financial documents requiring deeper analysis
FINANCIAL_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/vnd.ms-excel",  # xls
    "application/vnd.ms-excel.sheet.macroenabled.12",  # xlsm
}


def select_model_tier(
    file_type: str,
    analysis_depth: str = "standard",
) -> ModelTier:
    """
    Select appropriate Gemini model tier based on document type and analysis needs.

    Model selection logic:
    - Financial documents (Excel) → Pro model for deeper analysis
    - analysis_depth="deep" → Pro model
    - analysis_depth="batch" → Lite model (cost-optimized)
    - Standard documents → Flash model

    Args:
        file_type: MIME type of the document
        analysis_depth: One of "standard", "deep", or "batch"

    Returns:
        ModelTier enum value indicating which model to use

    Examples:
        >>> select_model_tier("application/pdf")
        ModelTier.FLASH

        >>> select_model_tier("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        ModelTier.PRO

        >>> select_model_tier("text/plain", analysis_depth="batch")
        ModelTier.LITE
    """
    # Deep analysis always uses Pro
    if analysis_depth == "deep":
        return ModelTier.PRO

    # Batch processing uses Lite for cost efficiency
    if analysis_depth == "batch":
        return ModelTier.LITE

    # Financial documents use Pro for deeper analysis
    if file_type in FINANCIAL_MIME_TYPES:
        return ModelTier.PRO

    # Default to Flash for standard processing
    return ModelTier.FLASH


def get_model_pricing(tier: ModelTier) -> dict[str, float]:
    """
    Get pricing information for a model tier.

    Args:
        tier: The ModelTier to get pricing for

    Returns:
        Dict with 'input' and 'output' prices per million tokens
    """
    pricing = {
        ModelTier.FLASH: {"input": 0.30, "output": 2.50},
        ModelTier.PRO: {"input": 1.25, "output": 10.00},
        ModelTier.LITE: {"input": 0.10, "output": 0.40},
    }
    return pricing[tier]


def estimate_cost(
    tier: ModelTier,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """
    Estimate API cost for a given token usage.

    Args:
        tier: The model tier used
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Estimated cost in USD
    """
    pricing = get_model_pricing(tier)
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return input_cost + output_cost


__all__ = [
    "ModelTier",
    "FINANCIAL_MIME_TYPES",
    "select_model_tier",
    "get_model_pricing",
    "estimate_cost",
]
