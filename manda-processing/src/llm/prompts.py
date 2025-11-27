"""
Prompt templates for M&A document analysis and finding extraction.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #3)

This module provides:
- System prompts for M&A-specific analysis
- Extraction prompt templates with context injection
- Response parsing utilities for structured findings
"""

import json
import re
from typing import Any, Optional

import structlog

logger = structlog.get_logger(__name__)


# System prompt for M&A document analysis
SYSTEM_PROMPT = """You are an expert M&A (Mergers and Acquisitions) analyst reviewing due diligence documents.
Your task is to extract key findings from document chunks that would be relevant for investment decisions.

For each finding, you must provide:
1. A concise but complete statement of the finding (the actual content)
2. A finding_type: one of "metric", "fact", "risk", "opportunity", or "contradiction"
3. A domain: one of "financial", "operational", "market", "legal", or "technical"
4. A confidence_score: 0-100 based on how clearly and explicitly the information is stated
5. Source reference information (page, section, etc.)

Finding type definitions:
- metric: Quantitative data (revenue, margins, growth rates, employee counts, etc.)
- fact: Qualitative statements about the company (history, products, customers, partnerships)
- risk: Potential concerns, red flags, or negative indicators
- opportunity: Growth potential, positive indicators, or strategic advantages
- contradiction: Information that conflicts with previously stated facts (within or across documents)

Domain definitions:
- financial: Revenue, costs, profitability, cash flow, valuations, funding
- operational: Processes, efficiency, capacity, supply chain, manufacturing
- market: Industry trends, competition, market position, TAM/SAM/SOM
- legal: Contracts, compliance, litigation, IP, regulatory issues
- technical: Technology stack, systems, infrastructure, R&D, patents

Confidence scoring guide:
- 90-100: Explicitly stated with clear source (e.g., "Revenue was $50M in 2023")
- 70-89: Strongly implied or can be calculated from given data
- 50-69: Inferred with moderate certainty, requires some interpretation
- Below 50: Uncertain, based on hints, or needs validation

IMPORTANT: Only extract findings you are confident about. Quality over quantity.
Return findings as a JSON array. If no significant findings exist, return an empty array []."""


# Extraction prompt for single chunk analysis
EXTRACTION_PROMPT_TEMPLATE = """Analyze the following document chunk and extract key M&A-relevant findings.

Document: {document_name}
Page: {page_number}
Chunk Type: {chunk_type}

Content:
---
{chunk_content}
---

Extract findings as a JSON array with this exact structure:
[
  {{
    "content": "The specific finding text",
    "finding_type": "metric|fact|risk|opportunity|contradiction",
    "domain": "financial|operational|market|legal|technical",
    "confidence_score": 0-100,
    "source_reference": {{
      "page": {page_number},
      "section": "section name if identifiable",
      "context": "brief quote or reference from source"
    }}
  }}
]

Important:
- Focus on material information that would matter for an M&A transaction
- Be precise with numbers - include units and time periods
- Note any assumptions or limitations in the source_reference.context
- Return ONLY the JSON array, no other text"""


# Batch extraction prompt for multiple chunks
BATCH_EXTRACTION_PROMPT_TEMPLATE = """Analyze the following document chunks and extract key M&A-relevant findings.

Document: {document_name}
Project: {project_name}

The following chunks are from the same document, processed in order:

{chunk_contents}

For each finding, indicate which chunk it came from using source_chunk_index (0-based).

Extract findings as a JSON array with this exact structure:
[
  {{
    "content": "The specific finding text",
    "finding_type": "metric|fact|risk|opportunity|contradiction",
    "domain": "financial|operational|market|legal|technical",
    "confidence_score": 0-100,
    "source_chunk_index": 0,
    "source_reference": {{
      "page": null,
      "section": "section name if identifiable",
      "context": "brief quote or reference from source"
    }}
  }}
]

Important:
- Focus on material information that would matter for an M&A transaction
- Identify cross-chunk patterns or contradictions
- Be precise with numbers - include units and time periods
- Return ONLY the JSON array, no other text"""


def get_system_prompt() -> str:
    """Get the system prompt for M&A document analysis."""
    return SYSTEM_PROMPT


def get_extraction_prompt(
    chunk_content: str,
    document_name: str,
    page_number: Optional[int] = None,
    chunk_type: str = "text",
) -> str:
    """
    Generate an extraction prompt for a single chunk.

    Args:
        chunk_content: The text content to analyze
        document_name: Name of the source document
        page_number: Page number (or None if unknown)
        chunk_type: Type of chunk (text, table, formula, etc.)

    Returns:
        Formatted prompt string
    """
    page_str = str(page_number) if page_number is not None else "unknown"

    return EXTRACTION_PROMPT_TEMPLATE.format(
        chunk_content=chunk_content,
        document_name=document_name,
        page_number=page_str,
        chunk_type=chunk_type,
    )


def get_batch_extraction_prompt(
    chunks: list[dict[str, Any]],
    document_name: str,
    project_name: str = "",
) -> str:
    """
    Generate an extraction prompt for a batch of chunks.

    Args:
        chunks: List of chunk dicts with 'content', 'page_number', 'chunk_type'
        document_name: Name of the source document
        project_name: Name of the project (optional)

    Returns:
        Formatted prompt string
    """
    # Format each chunk with index
    chunk_parts = []
    for i, chunk in enumerate(chunks):
        page = chunk.get("page_number", "unknown")
        chunk_type = chunk.get("chunk_type", "text")
        content = chunk.get("content", "")

        chunk_parts.append(
            f"--- CHUNK {i} (Page: {page}, Type: {chunk_type}) ---\n{content}"
        )

    chunk_contents = "\n\n".join(chunk_parts)

    return BATCH_EXTRACTION_PROMPT_TEMPLATE.format(
        document_name=document_name,
        project_name=project_name or "Not specified",
        chunk_contents=chunk_contents,
    )


def parse_findings_response(response_text: str) -> list[dict[str, Any]]:
    """
    Parse the LLM response into structured findings.

    Handles various response formats:
    - Clean JSON array
    - JSON wrapped in markdown code blocks
    - Partial/malformed JSON (attempts recovery)

    Args:
        response_text: The raw response from the LLM

    Returns:
        List of finding dictionaries

    Raises:
        ValueError: If response cannot be parsed
    """
    if not response_text or not response_text.strip():
        return []

    text = response_text.strip()

    # Try to extract JSON from markdown code blocks
    json_match = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text)
    if json_match:
        text = json_match.group(1)
    else:
        # Try to find a raw JSON array
        array_match = re.search(r"\[\s*\{[\s\S]*\}\s*\]", text)
        if array_match:
            text = array_match.group(0)
        elif text.startswith("[") and text.endswith("]"):
            pass  # Already looks like JSON array
        elif "[]" in text or text.strip() == "":
            return []  # Empty result
        else:
            logger.warning(
                "Could not find JSON array in response",
                response_preview=text[:100],
            )
            raise ValueError("Response does not contain a valid JSON array")

    try:
        findings = json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(
            "Failed to parse JSON response",
            error=str(e),
            response_preview=text[:200],
        )
        raise ValueError(f"Invalid JSON in response: {str(e)}")

    if not isinstance(findings, list):
        raise ValueError(f"Expected list, got {type(findings).__name__}")

    # Validate and normalize each finding
    validated_findings = []
    for i, finding in enumerate(findings):
        try:
            validated = _validate_finding(finding, i)
            validated_findings.append(validated)
        except ValueError as e:
            logger.warning(
                "Skipping invalid finding",
                finding_index=i,
                error=str(e),
            )

    return validated_findings


def _validate_finding(finding: dict[str, Any], index: int) -> dict[str, Any]:
    """
    Validate and normalize a single finding.

    Args:
        finding: Raw finding dict from LLM
        index: Index for error reporting

    Returns:
        Validated and normalized finding dict

    Raises:
        ValueError: If finding is invalid
    """
    if not isinstance(finding, dict):
        raise ValueError(f"Finding {index} is not a dict")

    # Required fields
    content = finding.get("content", "").strip()
    if not content:
        raise ValueError(f"Finding {index} missing content")

    # Validate and normalize finding_type
    finding_type = finding.get("finding_type", "").lower().strip()
    valid_types = {"metric", "fact", "risk", "opportunity", "contradiction"}
    if finding_type not in valid_types:
        # Try to infer from content or default to 'fact'
        finding_type = "fact"

    # Validate and normalize domain
    domain = finding.get("domain", "").lower().strip()
    valid_domains = {"financial", "operational", "market", "legal", "technical"}
    if domain not in valid_domains:
        # Default to 'operational' if unclear
        domain = "operational"

    # Validate confidence score
    confidence = finding.get("confidence_score", 70)
    if isinstance(confidence, str):
        try:
            confidence = float(confidence)
        except ValueError:
            confidence = 70
    confidence = max(0, min(100, float(confidence)))

    # Normalize source reference
    source_ref = finding.get("source_reference", {})
    if not isinstance(source_ref, dict):
        source_ref = {}

    # Include chunk index if present
    source_chunk_index = finding.get("source_chunk_index")

    return {
        "content": content,
        "finding_type": finding_type,
        "domain": domain,
        "confidence_score": confidence,
        "source_reference": source_ref,
        "source_chunk_index": source_chunk_index,
        "chunk_id": finding.get("chunk_id"),
    }


__all__ = [
    "SYSTEM_PROMPT",
    "get_system_prompt",
    "get_extraction_prompt",
    "get_batch_extraction_prompt",
    "parse_findings_response",
]
