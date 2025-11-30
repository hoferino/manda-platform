"""
Contradiction Detector - LLM service for comparing findings and detecting contradictions.
Story: E4.7 - Detect Contradictions Using Neo4j (AC: #3, #4)

This module provides:
- Pairwise comparison of findings to detect contradictions
- Batch processing for efficiency (5 pairs per request)
- Structured output parsing with confidence scores
- 70% confidence threshold application
"""

from dataclasses import dataclass, field
from typing import Any, Optional

import structlog
from pydantic import BaseModel, Field

from src.config import Settings, get_settings
from src.llm.client import GeminiClient, GeminiError, get_gemini_client
from src.llm.models import ModelTier

logger = structlog.get_logger(__name__)


# Confidence threshold for flagging contradictions (AC: #4)
CONTRADICTION_CONFIDENCE_THRESHOLD = 0.70


class ComparisonResult(BaseModel):
    """Result of comparing two findings for contradiction."""

    contradicts: bool = Field(description="Whether the two findings contradict each other")
    confidence: float = Field(
        ge=0.0, le=1.0,
        description="Confidence score from 0.0 to 1.0"
    )
    reason: str = Field(description="Explanation of why they do or don't contradict")


@dataclass
class ContradictionResult:
    """Result of a contradiction comparison between two findings."""

    finding_a_id: str
    finding_b_id: str
    contradicts: bool
    confidence: float
    reason: str

    @property
    def above_threshold(self) -> bool:
        """Check if this contradiction is above the confidence threshold."""
        return self.contradicts and self.confidence >= CONTRADICTION_CONFIDENCE_THRESHOLD


@dataclass
class BatchComparisonResult:
    """Aggregated result of batch contradiction comparison."""

    comparisons: list[ContradictionResult]
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    batch_count: int = 0
    failed_comparisons: list[tuple[str, str]] = field(default_factory=list)

    @property
    def contradictions_found(self) -> list[ContradictionResult]:
        """Get contradictions that are above the confidence threshold."""
        return [c for c in self.comparisons if c.above_threshold]

    @property
    def contradictions_below_threshold(self) -> list[ContradictionResult]:
        """Get contradictions that are below the confidence threshold."""
        return [
            c for c in self.comparisons
            if c.contradicts and not c.above_threshold
        ]


# System prompt for contradiction detection
CONTRADICTION_SYSTEM_PROMPT = """You are an expert M&A analyst specialized in identifying contradictory information across due diligence documents. Your task is to compare pairs of findings and determine if they contradict each other.

A contradiction exists when two findings make incompatible claims about:
- The same metric or measurement (e.g., different revenue figures for the same period)
- The same fact or characteristic (e.g., different employee counts at the same time)
- The same assessment or conclusion (e.g., opposite statements about financial health)

Important distinction - these are NOT contradictions:
- Different metrics (revenue vs profit)
- Different time periods (Q2 vs Q3, 2023 vs 2024)
- Complementary or additional information
- Different levels of detail about the same topic
- Approximations vs precise figures (unless wildly different)

Always provide structured JSON output with your analysis."""


def _get_comparison_prompt(
    finding_a: dict[str, Any],
    finding_b: dict[str, Any],
) -> str:
    """Generate the comparison prompt for two findings."""
    return f"""Compare the following two findings from M&A due diligence documents and determine if they contradict each other.

## Finding A
**Text:** {finding_a.get('text', '')}
**Source Document:** {finding_a.get('source_document', 'Unknown')}
**Domain:** {finding_a.get('domain', 'Unknown')}
**Date Referenced:** {finding_a.get('date_referenced', 'Not specified')}
**Page/Location:** {finding_a.get('page_number', 'Unknown')}

## Finding B
**Text:** {finding_b.get('text', '')}
**Source Document:** {finding_b.get('source_document', 'Unknown')}
**Domain:** {finding_b.get('domain', 'Unknown')}
**Date Referenced:** {finding_b.get('date_referenced', 'Not specified')}
**Page/Location:** {finding_b.get('page_number', 'Unknown')}

## Task
Analyze whether these findings contradict each other. Consider:
1. Do they refer to the same metric, fact, or topic?
2. Do they cover the same time period?
3. Are the claims mutually exclusive?

Respond with JSON in this exact format:
```json
{{
  "contradicts": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation"
}}
```"""


def _get_batch_comparison_prompt(
    pairs: list[tuple[dict[str, Any], dict[str, Any]]],
) -> str:
    """Generate a batch comparison prompt for multiple finding pairs."""
    prompt_parts = [
        "Compare the following pairs of findings and determine if any contradict each other.\n"
    ]

    for i, (finding_a, finding_b) in enumerate(pairs):
        prompt_parts.append(f"""
---
## Pair {i + 1}

### Finding A
**Text:** {finding_a.get('text', '')}
**Source:** {finding_a.get('source_document', 'Unknown')}
**Domain:** {finding_a.get('domain', 'Unknown')}
**Date Referenced:** {finding_a.get('date_referenced', 'Not specified')}

### Finding B
**Text:** {finding_b.get('text', '')}
**Source:** {finding_b.get('source_document', 'Unknown')}
**Domain:** {finding_b.get('domain', 'Unknown')}
**Date Referenced:** {finding_b.get('date_referenced', 'Not specified')}
""")

    prompt_parts.append("""
---
## Task
For each pair, analyze whether the findings contradict each other.

Respond with JSON array in this exact format:
```json
[
  {"pair": 1, "contradicts": true/false, "confidence": 0.0-1.0, "reason": "explanation"},
  {"pair": 2, "contradicts": true/false, "confidence": 0.0-1.0, "reason": "explanation"},
  ...
]
```""")

    return "\n".join(prompt_parts)


def _parse_comparison_response(response: str) -> ComparisonResult:
    """Parse a single comparison response from the LLM."""
    import json
    import re

    # Try to extract JSON from the response
    json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON object found in response")

    data = json.loads(json_match.group())

    return ComparisonResult(
        contradicts=bool(data.get('contradicts', False)),
        confidence=float(data.get('confidence', 0.0)),
        reason=str(data.get('reason', ''))
    )


def _parse_batch_response(response: str, pair_count: int) -> list[dict[str, Any]]:
    """Parse a batch comparison response from the LLM."""
    import json
    import re

    # Try to extract JSON array from the response
    json_match = re.search(r'\[[\s\S]*?\]', response)
    if not json_match:
        raise ValueError("No JSON array found in response")

    data = json.loads(json_match.group())

    if not isinstance(data, list):
        raise ValueError("Response is not a JSON array")

    return data


class ContradictionDetector:
    """
    Service for detecting contradictions between findings using LLM analysis.

    Features:
    - Pairwise comparison with Gemini 2.5 Pro (AC: #3)
    - Batch processing for efficiency (5 pairs per request)
    - 70% confidence threshold (AC: #4)
    - Structured logging for debugging/tuning
    """

    def __init__(
        self,
        llm_client: Optional[GeminiClient] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the contradiction detector.

        Args:
            llm_client: Gemini LLM client (uses default if not provided)
            config: Application settings
        """
        self.llm_client = llm_client or get_gemini_client()
        self.config = config or get_settings()

        logger.info("ContradictionDetector initialized")

    async def compare_findings(
        self,
        finding_a: dict[str, Any],
        finding_b: dict[str, Any],
    ) -> ContradictionResult:
        """
        Compare two findings for contradiction.

        Args:
            finding_a: First finding dict with text, domain, date_referenced, etc.
            finding_b: Second finding dict

        Returns:
            ContradictionResult with comparison details

        Raises:
            GeminiError: If LLM call fails
        """
        finding_a_id = str(finding_a.get('id', ''))
        finding_b_id = str(finding_b.get('id', ''))

        logger.debug(
            "Comparing findings for contradiction",
            finding_a_id=finding_a_id,
            finding_b_id=finding_b_id,
        )

        prompt = _get_comparison_prompt(finding_a, finding_b)

        # Use PRO tier for nuanced analysis (AC: #3)
        response_text, input_tokens, output_tokens = await self.llm_client._invoke_model(
            model_name=ModelTier.PRO.value,
            prompt=prompt,
            system_prompt=CONTRADICTION_SYSTEM_PROMPT,
        )

        try:
            comparison = _parse_comparison_response(response_text)
        except Exception as e:
            logger.warning(
                "Failed to parse comparison response",
                error=str(e),
                response_preview=response_text[:200] if response_text else "empty",
            )
            # Default to no contradiction on parse failure
            comparison = ComparisonResult(
                contradicts=False,
                confidence=0.0,
                reason=f"Parse error: {str(e)}"
            )

        result = ContradictionResult(
            finding_a_id=finding_a_id,
            finding_b_id=finding_b_id,
            contradicts=comparison.contradicts,
            confidence=comparison.confidence,
            reason=comparison.reason,
        )

        # Log all comparison results for debugging/tuning (AC: #4)
        logger.info(
            "Comparison result",
            finding_a_id=finding_a_id,
            finding_b_id=finding_b_id,
            contradicts=result.contradicts,
            confidence=result.confidence,
            above_threshold=result.above_threshold,
            reason=result.reason[:100] if result.reason else None,
        )

        return result

    async def compare_batch(
        self,
        pairs: list[tuple[dict[str, Any], dict[str, Any]]],
        batch_size: int = 5,
    ) -> BatchComparisonResult:
        """
        Compare multiple pairs of findings in batches.

        Args:
            pairs: List of (finding_a, finding_b) tuples to compare
            batch_size: Number of pairs per LLM request (default: 5)

        Returns:
            BatchComparisonResult with all comparison results
        """
        if not pairs:
            return BatchComparisonResult(comparisons=[])

        logger.info(
            "Starting batch contradiction comparison",
            pair_count=len(pairs),
            batch_size=batch_size,
        )

        all_results: list[ContradictionResult] = []
        total_input_tokens = 0
        total_output_tokens = 0
        batch_count = 0
        failed_pairs: list[tuple[str, str]] = []

        # Process in batches
        for i in range(0, len(pairs), batch_size):
            batch_pairs = pairs[i:i + batch_size]
            batch_idx = i // batch_size

            try:
                prompt = _get_batch_comparison_prompt(batch_pairs)

                response_text, input_tokens, output_tokens = await self.llm_client._invoke_model(
                    model_name=ModelTier.PRO.value,
                    prompt=prompt,
                    system_prompt=CONTRADICTION_SYSTEM_PROMPT,
                )

                total_input_tokens += input_tokens
                total_output_tokens += output_tokens
                batch_count += 1

                # Parse batch response
                batch_results = _parse_batch_response(response_text, len(batch_pairs))

                # Match results to pairs
                for j, (finding_a, finding_b) in enumerate(batch_pairs):
                    finding_a_id = str(finding_a.get('id', ''))
                    finding_b_id = str(finding_b.get('id', ''))

                    # Find matching result in parsed response
                    pair_result = None
                    for result_data in batch_results:
                        if result_data.get('pair') == j + 1:
                            pair_result = result_data
                            break

                    if pair_result:
                        result = ContradictionResult(
                            finding_a_id=finding_a_id,
                            finding_b_id=finding_b_id,
                            contradicts=bool(pair_result.get('contradicts', False)),
                            confidence=float(pair_result.get('confidence', 0.0)),
                            reason=str(pair_result.get('reason', '')),
                        )
                        all_results.append(result)

                        # Log each result (AC: #4)
                        logger.debug(
                            "Batch comparison result",
                            batch_idx=batch_idx,
                            pair_idx=j,
                            finding_a_id=finding_a_id,
                            finding_b_id=finding_b_id,
                            contradicts=result.contradicts,
                            confidence=result.confidence,
                            above_threshold=result.above_threshold,
                        )
                    else:
                        # No result for this pair - log and continue
                        logger.warning(
                            "No result found for pair in batch response",
                            batch_idx=batch_idx,
                            pair_idx=j,
                            finding_a_id=finding_a_id,
                            finding_b_id=finding_b_id,
                        )
                        failed_pairs.append((finding_a_id, finding_b_id))

                logger.debug(
                    "Batch completed",
                    batch_idx=batch_idx,
                    results_count=len([r for r in batch_results if r]),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )

            except GeminiError as e:
                logger.warning(
                    "Batch comparison failed (Gemini error)",
                    batch_idx=batch_idx,
                    error=str(e),
                    retryable=e.retryable,
                )
                # Track failed pairs
                for finding_a, finding_b in batch_pairs:
                    failed_pairs.append((
                        str(finding_a.get('id', '')),
                        str(finding_b.get('id', ''))
                    ))

                if not e.retryable:
                    # Non-retryable - continue with next batch
                    continue
                else:
                    # Re-raise retryable errors
                    raise

            except Exception as e:
                logger.warning(
                    "Batch comparison failed (parse error)",
                    batch_idx=batch_idx,
                    error=str(e),
                )
                # Track failed pairs
                for finding_a, finding_b in batch_pairs:
                    failed_pairs.append((
                        str(finding_a.get('id', '')),
                        str(finding_b.get('id', ''))
                    ))

        result = BatchComparisonResult(
            comparisons=all_results,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            batch_count=batch_count,
            failed_comparisons=failed_pairs,
        )

        logger.info(
            "Batch comparison complete",
            total_comparisons=len(all_results),
            contradictions_above_threshold=len(result.contradictions_found),
            contradictions_below_threshold=len(result.contradictions_below_threshold),
            failed_pairs=len(failed_pairs),
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
        )

        return result


# Global detector instance
_detector: Optional[ContradictionDetector] = None


def get_contradiction_detector() -> ContradictionDetector:
    """Get or create the global contradiction detector instance."""
    global _detector
    if _detector is None:
        _detector = ContradictionDetector()
    return _detector


__all__ = [
    "ContradictionDetector",
    "ContradictionResult",
    "BatchComparisonResult",
    "ComparisonResult",
    "CONTRADICTION_CONFIDENCE_THRESHOLD",
    "get_contradiction_detector",
]
